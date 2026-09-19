#!/usr/bin/env node
/**
 * End-to-end verification harness for the Pembayaran (customer payment) feature.
 *
 * Mirrors scripts/verify-authz.mjs for infrastructure:
 *  1. Reuses the existing build unless SKIP_BUILD is unset and no .next/BUILD_ID.
 *  2. Starts `next start` on port 3100 (honours E2E_PORT; NEVER touches 3000 where
 *     the product owner's dev server runs) and stops it again.
 *  3. Resolves `createPayment`'s server-action id from the BUILT CLIENT CHUNKS
 *     (`createServerReference("<id>", ..., "<name>")`) cross-checked against
 *     `.next/server/server-reference-manifest.json`.
 *  4. Seeds isolated fixtures directly via Prisma (every email ends in @e2e.test,
 *     every run gets a unique suffix so unique constraints never collide).
 *  5. Drives the real HTTP surface: real NextAuth credentials login, a cookie jar,
 *     real server-action POSTs (`Next-Action` id + same-origin `Origin` + React
 *     `encodeReply`), and real page GETs.
 *  6. Judges every scenario by observed DATABASE STATE, never by HTTP 200.
 *  7. Cleans fixtures up in `finally` and verifies real rows were never touched.
 *
 * Usage:
 *   node scripts/verify-payments.mjs
 *   SKIP_BUILD=1 node scripts/verify-payments.mjs   # reuse existing .next build
 *   E2E_DEBUG=1  node scripts/verify-payments.mjs   # verbose request/action logging
 *
 * Exit code: 0 only when every scenario passes.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

// Neon over IPv6 can be very slow; disabling happy-eyeballs forces IPv4 first.
if (typeof net.setDefaultAutoSelectFamily === "function") {
  net.setDefaultAutoSelectFamily(false);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const dotenv = require("dotenv");
dotenv.config({ path: path.join(ROOT, ".env") });

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const pg = require("pg");
const bcrypt = require("bcryptjs");
const { encodeReply } = require(
  "next/dist/compiled/react-server-dom-webpack/cjs/react-server-dom-webpack-client.node.production.js",
);

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.E2E_PORT || 3100);
const BASE = `http://localhost:${PORT}`;
const E2E_SUFFIX = "@e2e.test";
const PASSWORD = "E2e-Passw0rd!";
const DEBUG = process.env.E2E_DEBUG === "1";
// Per-run suffix: makes every unique column (email, inviteCode) collision-free.
const RUN = Date.now().toString(36);

// Verbatim guard/validation strings from app/actions/payments.js (frozen contract).
const PAYMENT_ERR = {
  NO_SESSION: "Sesi tidak ditemukan. Silakan masuk kembali.",
  ACTOR_NOT_ACTIVE: "Akun Anda tidak aktif.",
  NOT_AUTHORIZED: "Hanya pemilik atau kasir yang dapat melakukan tindakan ini.",
  TX_NOT_FOUND: "Kasbon tidak ditemukan.",
  TX_NOT_CONFIRMED: "Kasbon belum dikonfirmasi sehingga belum bisa dibayar.",
  TX_ALREADY_PAID: "Kasbon ini sudah lunas.",
  AMOUNT_INVALID: "Jumlah pembayaran harus lebih dari 0.",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─────────────────────────────────────────────────────────────────────────────
// Prisma
// ─────────────────────────────────────────────────────────────────────────────

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("FATAL: DATABASE_URL is not set (checked process.env and .env).");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString, max: 5 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─────────────────────────────────────────────────────────────────────────────
// Tiny assertion + scenario framework
// ─────────────────────────────────────────────────────────────────────────────

const results = [];
let failed = false;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEq(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `${message} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`,
    );
  }
}

async function scenario(id, title, fn) {
  const name = `${id}. ${title}`;
  try {
    const observed = await fn();
    results.push({ id, name, ok: true, observed });
    console.log(`\nPASS  ${name}\n      ${observed}`);
  } catch (error) {
    failed = true;
    results.push({ id, name, ok: false, observed: error.message });
    console.log(`\nFAIL  ${name}\n      ${error.message}`);
    if (DEBUG) console.error(error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Server-action resolution (built client chunks + server-reference manifest)
// ─────────────────────────────────────────────────────────────────────────────

function walkFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

function manifestPageToPath(workerKey) {
  // "app/dashboard/pembayaran/page" -> "/dashboard/pembayaran"
  let p = workerKey.replace(/^app/, "");
  p = p.replace(/\/page$/, "");
  return p === "" ? "/" : p;
}

/**
 * Reads action ids straight out of the built client chunks. The minified call
 * looks like:
 *   (0,n.createServerReference)("<id>",n.callServer,void 0,n.findSourceMapURL,"<name>")
 * so the exported name is recoverable without guessing.
 */
function scanChunkServerReferences() {
  const map = new Map(); // id -> exportedName
  const re =
    /createServerReference\)?\("([0-9a-f]{16,})"[^)]*?"([A-Za-z_$][\w$]*)"\)/g;
  for (const file of walkFiles(path.join(ROOT, ".next", "static", "chunks"))) {
    let content;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    let match;
    while ((match = re.exec(content)) !== null) {
      map.set(match[1], match[2]);
    }
  }
  return map;
}

function resolveActions() {
  const manifestPath = path.join(
    ROOT,
    ".next",
    "server",
    "server-reference-manifest.json",
  );
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`missing build artifact: ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const node = manifest.node || {};

  const byName = new Map(); // name -> { id, file }
  const pageByName = new Map(); // name -> "/page"
  for (const [id, entry] of Object.entries(node)) {
    const name = entry.exportedName;
    if (!name) continue;
    if (!byName.has(name)) byName.set(name, { id, file: entry.filename });
    const workers = Object.keys(entry.workers || {});
    if (workers.length && !pageByName.has(name)) {
      pageByName.set(name, manifestPageToPath(workers[0]));
    }
  }

  const chunkMap = scanChunkServerReferences();
  return { byName, pageByName, chunkMap, manifestPath };
}

/** Fail loudly if the client chunks and the server manifest disagree for an action. */
function verifyAction(name, index) {
  const resolved = index.byName.get(name);
  assert(resolved, `action "${name}" not present in server-reference-manifest.json`);
  const chunkName = index.chunkMap.get(resolved.id);
  assert(
    chunkName === name,
    `client-chunk/server-manifest mismatch for "${name}": ` +
      `manifest id ${resolved.id} from ${resolved.file}, ` +
      `chunk name ${JSON.stringify(chunkName)}`,
  );
  const page = index.pageByName.get(name);
  assert(page, `no worker page resolved for action "${name}"`);
  return { id: resolved.id, page, file: resolved.file };
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP helpers
// ─────────────────────────────────────────────────────────────────────────────

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }
  store(setCookies) {
    for (const raw of setCookies || []) {
      const pair = raw.split(";")[0];
      const idx = pair.indexOf("=");
      if (idx <= 0) continue;
      this.cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
  }
  has(fragment) {
    return [...this.cookies.keys()].some((key) => key.includes(fragment));
  }
  header() {
    return [...this.cookies.entries()]
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }
}

async function getPage(pathname, jar) {
  const res = await fetch(BASE + pathname, {
    redirect: "manual",
    headers: jar ? { cookie: jar.header() } : {},
  });
  const body = await res.text();
  const out = {
    status: res.status,
    location: res.headers.get("location"),
    body,
  };
  if (DEBUG) {
    console.log(`  [GET] ${pathname} -> ${res.status} ${out.location || ""}`);
  }
  return out;
}

async function login(jar, email, password) {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, {
    redirect: "manual",
    headers: { cookie: jar.header() },
  });
  jar.store(csrfRes.headers.getSetCookie());
  const csrfBody = await csrfRes.text();
  if (csrfRes.status !== 200) {
    throw new Error(
      `GET /api/auth/csrf failed for ${email}: ${csrfRes.status} ${csrfBody.slice(0, 200)}`,
    );
  }
  let csrfToken;
  try {
    csrfToken = JSON.parse(csrfBody).csrfToken;
  } catch {
    throw new Error(`csrf response was not JSON: ${csrfBody.slice(0, 200)}`);
  }
  assert(csrfToken, `csrf token missing for ${email}`);

  const form = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: `${BASE}/dashboard`,
  });
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: jar.header(),
      origin: BASE,
    },
    body: form,
  });
  jar.store(res.headers.getSetCookie());
  const body = await res.text();
  if (!jar.has("session-token")) {
    throw new Error(
      `login failed for ${email}: status ${res.status}, location ${res.headers.get("location")}, body ${body.slice(0, 200)}`,
    );
  }
  if (DEBUG) {
    console.log(`  [login] ${email} -> ${res.status} (session cookie set)`);
  }
  return res.status;
}

/** Extracts the action's return shape from the flight response for reporting. */
function parseActionResult(text) {
  const out = {};
  const okMatch = text.match(/"ok":\s*(true|false)/);
  if (okMatch) out.ok = okMatch[1] === "true";
  const errMatch = text.match(/"error":\s*"((?:[^"\\]|\\.)*)"/);
  if (errMatch) {
    try {
      out.error = JSON.parse(`"${errMatch[1]}"`);
    } catch {
      out.error = errMatch[1];
    }
  }
  const statusMatch = text.match(/"transactionStatus":\s*"([a-z]+)"/);
  if (statusMatch) out.transactionStatus = statusMatch[1];
  const paymentIdMatch = text.match(/"paymentId":\s*(\d+)/);
  if (paymentIdMatch) out.paymentId = Number(paymentIdMatch[1]);
  const txIdMatch = text.match(/"transactionId":\s*(\d+)/);
  if (txIdMatch) out.transactionId = Number(txIdMatch[1]);
  const customerIdMatch = text.match(/"customerId":\s*(\d+)/);
  if (customerIdMatch) out.customerId = Number(customerIdMatch[1]);
  const riskMatch = text.match(/"riskScore":\s*(null|\d+)/);
  if (riskMatch) out.riskScore = riskMatch[1] === "null" ? null : Number(riskMatch[1]);
  const trustMatch = text.match(/"trustStatus":\s*(null|"([a-z_]+)")/);
  if (trustMatch) out.trustStatus = trustMatch[1] === "null" ? null : trustMatch[2];
  return out;
}

/**
 * Invokes a server action exactly the way the browser does: POST to the page that
 * registers it, with the `Next-Action` id header, session cookies, a same-origin
 * `Origin`, and the argument array encoded by React's own `encodeReply`.
 */
async function callAction(jar, name, args) {
  const resolved = actionIndex.byName.get(name);
  assert(resolved, `cannot call "${name}": action id not resolved`);
  const page = actionIndex.pageByName.get(name);
  assert(page, `cannot call "${name}": worker page not resolved`);

  const encoded = await encodeReply(args);
  const headers = {
    "next-action": resolved.id,
    origin: BASE,
    cookie: jar.header(),
    accept: "text/x-component",
  };
  let body;
  if (typeof encoded === "string") {
    headers["content-type"] = "text/plain;charset=UTF-8";
    body = encoded;
  } else {
    body = encoded; // FormData: let fetch set the multipart boundary
  }

  const res = await fetch(BASE + page, {
    method: "POST",
    headers,
    body,
    redirect: "manual",
  });
  const text = await res.text();
  const parsed = parseActionResult(text);
  if (DEBUG) {
    console.log(
      `  [action] ${name} ${JSON.stringify(args)} -> ${res.status} ${JSON.stringify(parsed)}`,
    );
  }
  return { status: res.status, text, parsed, id: resolved.id, page, args };
}

async function mustAction(jar, name, args) {
  const run = await callAction(jar, name, args);
  assert(
    run.status === 200,
    `action ${name} expected HTTP 200, got ${run.status}: ${run.text.slice(0, 240)}`,
  );
  return run;
}

// ─────────────────────────────────────────────────────────────────────────────
// Build / start / stop the app
// ─────────────────────────────────────────────────────────────────────────────

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function buildIfNeeded() {
  const buildId = path.join(ROOT, ".next", "BUILD_ID");
  if (process.env.SKIP_BUILD === "1" && fs.existsSync(buildId)) {
    console.log("· SKIP_BUILD=1 and .next/BUILD_ID exists — reusing existing build.");
    return;
  }
  console.log("· Building with `bun run build` …");
  await runCommand("bun", ["run", "build"]);
  assert(fs.existsSync(buildId), "build finished but .next/BUILD_ID is missing");
}

function startServer() {
  console.log(`· Starting \`bun run start -- -p ${PORT}\` …`);
  const child = spawn("bun", ["run", "start", "--", "-p", String(PORT)], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      AUTH_URL: BASE,
      NEXTAUTH_URL: BASE,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  const capture = (chunk) => {
    log += chunk.toString();
    if (log.length > 20000) log = log.slice(-20000);
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  child.getLog = () => log;
  return child;
}

async function waitForServer(child, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `server exited early with code ${child.exitCode}\n--- server log ---\n${child.getLog()}`,
      );
    }
    try {
      const res = await fetch(`${BASE}/login`, { redirect: "manual" });
      await res.text();
      if (res.status > 0) return true;
    } catch (error) {
      lastError = error;
    }
    await sleep(300);
  }
  throw new Error(
    `server not ready after ${timeoutMs}ms (${lastError?.message || "no response"})\n--- server log ---\n${child.getLog()}`,
  );
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  const exited = await Promise.race([
    once(child, "exit").then(() => true),
    sleep(5000).then(() => false),
  ]);
  if (!exited && child.exitCode === null) {
    child.kill("SIGKILL");
    await Promise.race([once(child, "exit"), sleep(2000)]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const fx = {};

/**
 * Deletes businesses together with their NON-cascading descendants in dependency
 * order: payment -> transaction -> reminder -> scoreHistory -> customer -> user
 * -> business. `Business` relations do not cascade, so deleting a business
 * directly throws an FK violation once it owns customers/transactions.
 */
async function deleteBusinessesCascade(businessIds) {
  const ids = [
    ...new Set(businessIds.filter((id) => Number.isInteger(id) && id > 0)),
  ];
  if (!ids.length) return;

  const users = await prisma.user.findMany({
    where: { businessId: { in: ids } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  if (userIds.length) {
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  }

  const customers = await prisma.customer.findMany({
    where: { businessId: { in: ids } },
    select: { id: true },
  });
  const customerIds = customers.map((c) => c.id);

  const transactions = await prisma.transaction.findMany({
    where: { businessId: { in: ids } },
    select: { id: true },
  });
  const transactionIds = transactions.map((t) => t.id);
  if (transactionIds.length) {
    await prisma.payment.deleteMany({
      where: { transactionId: { in: transactionIds } },
    });
    await prisma.transaction.deleteMany({ where: { id: { in: transactionIds } } });
  }

  if (customerIds.length) {
    await prisma.reminder.deleteMany({ where: { customerId: { in: customerIds } } });
    await prisma.scoreHistory.deleteMany({
      where: { customerId: { in: customerIds } },
    });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
  }

  if (userIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  await prisma.business.deleteMany({ where: { id: { in: ids } } });
}

async function preClean() {
  const stale = await prisma.user.findMany({
    where: { email: { endsWith: E2E_SUFFIX } },
    select: { id: true, businessId: true, email: true },
  });
  const userIds = stale.map((u) => u.id);
  const emails = stale.map((u) => u.email);

  // Catch businesses created by a prior crashed run whose users were already removed.
  const orphanBusinesses = await prisma.business.findMany({
    where: {
      OR: [
        { name: { startsWith: "E2E " } },
        { inviteCode: { startsWith: "E2E-" } },
      ],
    },
    select: { id: true },
  });
  const businessIds = [
    ...new Set([
      ...stale.map((u) => u.businessId).filter(Boolean),
      ...orphanBusinesses.map((b) => b.id),
    ]),
  ];

  if (userIds.length) {
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.notification.deleteMany({ where: { body: { in: emails } } });
  }
  await deleteBusinessesCascade(businessIds);
}

const createBusiness = (name, inviteCode) =>
  prisma.business.create({
    data: {
      name,
      ownerName: `Owner of ${name}`,
      ownerPhoneNumber: "0812000000",
      inviteCode,
    },
  });

async function createUser({ email, name, role, status, businessId }) {
  return prisma.user.create({
    data: {
      email,
      name,
      role,
      status,
      businessId,
      password: await bcrypt.hash(PASSWORD, 12),
    },
  });
}

function createCustomer({ businessId, name, creditLimit = 10000000 }) {
  return prisma.customer.create({
    data: {
      businessId,
      name,
      phoneNumber: "081200000123",
      creditLimit,
      riskScore: 50,
      trustStatus: "unrated",
    },
  });
}

const FUTURE_DUE = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

function createTransaction({
  businessId,
  customerId,
  sequenceNumber,
  period = 202609,
  amount,
  paymentStatus = "confirmed",
  status = "unpaid",
}) {
  return prisma.transaction.create({
    data: {
      businessId,
      customerId,
      period,
      sequenceNumber,
      amount,
      dueDate: FUTURE_DUE,
      paymentStatus,
      status,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Visible-text extraction (scripts/styles stripped: the RSC flight payload
// legitimately carries ids/props, so only rendered text may be asserted on)
// ─────────────────────────────────────────────────────────────────────────────

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// DB observation helpers
// ─────────────────────────────────────────────────────────────────────────────

function confirmedPayments(transactionId) {
  return prisma.payment.findMany({
    where: { transactionId, status: "confirmed" },
    orderBy: { id: "asc" },
  });
}

async function transactionById(id) {
  return prisma.transaction.findUnique({ where: { id } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

let actionIndex = null;
let server = null;
const jars = new Map();

async function jarFor(email) {
  if (!jars.has(email)) {
    const jar = new CookieJar();
    await login(jar, email, PASSWORD);
    jars.set(email, jar);
  }
  return jars.get(email);
}

async function main() {
  console.log(`TrustBon payments verification harness (run suffix: ${RUN})`);
  console.log(`  node ${process.version} · base ${BASE}`);

  await buildIfNeeded();
  server = startServer();
  await waitForServer(server);

  actionIndex = resolveActions();
  const resolution = [
    { name: "createPayment", ...verifyAction("createPayment", actionIndex) },
  ];

  // Capture the pre-existing real rows so we can prove we never touched them.
  const realBefore = await prisma.user.findMany({
    where: { NOT: { email: { endsWith: E2E_SUFFIX } } },
    select: { id: true, email: true, name: true, role: true, status: true, businessId: true },
    orderBy: { id: "asc" },
  });
  const businessCountBefore = await prisma.business.count();
  const userCountBefore = await prisma.user.count();

  await preClean();

  // ── 1. Seed fixtures ──────────────────────────────────────────────────────
  await scenario(1, "Seed fixtures (isolated @e2e.test data)", async () => {
    fx.businessA = await createBusiness(`E2E Payments A ${RUN}`, `E2E-PAY-A-${RUN}`);
    fx.businessB = await createBusiness(`E2E Payments B ${RUN}`, `E2E-PAY-B-${RUN}`);

    fx.ownerA = await createUser({
      email: `owner.a.${RUN}${E2E_SUFFIX}`,
      name: "Owner A",
      role: "owner",
      status: "active",
      businessId: fx.businessA.id,
    });
    fx.kasirA = await createUser({
      email: `kasir.a.${RUN}${E2E_SUFFIX}`,
      name: "Kasir A",
      role: "cashier",
      status: "active",
      businessId: fx.businessA.id,
    });
    fx.ownerB = await createUser({
      email: `owner.b.${RUN}${E2E_SUFFIX}`,
      name: "Owner B",
      role: "owner",
      status: "active",
      businessId: fx.businessB.id,
    });

    fx.c1 = await createCustomer({
      businessId: fx.businessA.id,
      name: `Pelanggan A ${RUN}`,
    });
    fx.c2 = await createCustomer({
      businessId: fx.businessA.id,
      name: `Pelanggan C2 ${RUN}`,
    });
    fx.cb = await createCustomer({
      businessId: fx.businessB.id,
      name: `Pelanggan B ${RUN}`,
    });

    // K1 + K2 belong to C1; K3 to C2; K4 is a DRAFT for C1; K5 is fresh for C1.
    fx.k1 = await createTransaction({
      businessId: fx.businessA.id,
      customerId: fx.c1.id,
      sequenceNumber: 1,
      amount: 300000,
    });
    fx.k2 = await createTransaction({
      businessId: fx.businessA.id,
      customerId: fx.c1.id,
      sequenceNumber: 2,
      amount: 500000,
    });
    fx.k3 = await createTransaction({
      businessId: fx.businessA.id,
      customerId: fx.c2.id,
      sequenceNumber: 3,
      amount: 100000,
    });
    fx.k4 = await createTransaction({
      businessId: fx.businessA.id,
      customerId: fx.c1.id,
      sequenceNumber: 4,
      amount: 200000,
      paymentStatus: "draft",
    });
    fx.k5 = await createTransaction({
      businessId: fx.businessA.id,
      customerId: fx.c1.id,
      sequenceNumber: 5,
      amount: 150000,
    });
    // Cross-tenant payable kasbon in business B.
    fx.kb = await createTransaction({
      businessId: fx.businessB.id,
      customerId: fx.cb.id,
      sequenceNumber: 1,
      amount: 400000,
    });

    return (
      `A=${fx.businessA.id} B=${fx.businessB.id} · ` +
      `K1=${fx.k1.id} K2=${fx.k2.id} K3=${fx.k3.id} K4=${fx.k4.id} K5=${fx.k5.id} KB=${fx.kb.id}`
    );
  });

  const jarKasir = await jarFor(fx.kasirA.email);
  const jarOwnerA = await jarFor(fx.ownerA.email);

  // ── 2. Kasir partial payment on K1 ────────────────────────────────────────
  await scenario(2, "Kasir records partial payment 100000 on K1 -> partial", async () => {
    const scoreBefore = await prisma.scoreHistory.count({
      where: { customerId: fx.c1.id },
    });
    const run = await mustAction(jarKasir, "createPayment", [
      { transactionId: fx.k1.id, amountPaid: 100000 },
    ]);
    assertEq(run.parsed.ok, true, `createPayment returned ${JSON.stringify(run.parsed)}`);
    assertEq(run.parsed.transactionStatus, "partial", "returned transactionStatus");

    const pays = await confirmedPayments(fx.k1.id);
    assertEq(pays.length, 1, "confirmed payment rows for K1");
    assertEq(Number(pays[0].amountPaid), 100000, "amountPaid of the row");
    assertEq(pays[0].status, "confirmed", "Payment.status");

    const k1 = await transactionById(fx.k1.id);
    assertEq(k1.status, "partial", "K1.status");

    const scoreAfter = await prisma.scoreHistory.count({
      where: { customerId: fx.c1.id },
    });
    assert(scoreAfter > scoreBefore, `ScoreHistory rows ${scoreBefore} -> ${scoreAfter}`);
    const c1 = await prisma.customer.findUnique({ where: { id: fx.c1.id } });
    assert(
      Number.isInteger(run.parsed.riskScore) && run.parsed.riskScore === c1.riskScore,
      `riskScore returned=${run.parsed.riskScore} db=${c1.riskScore}`,
    );
    assert(
      run.parsed.trustStatus === c1.trustStatus,
      `trustStatus returned=${run.parsed.trustStatus} db=${c1.trustStatus}`,
    );

    return (
      `ok:true paymentId=${run.parsed.paymentId} transactionStatus=partial · ` +
      `rows=1 amount=100000 K1.status=partial · scoreHistory ${scoreBefore}->${scoreAfter} ` +
      `riskScore=${c1.riskScore} trustStatus=${c1.trustStatus}`
    );
  });

  // ── 3. Second partial settles K1 ──────────────────────────────────────────
  await scenario(3, "Second partial 200000 settles K1 -> paid", async () => {
    const run = await mustAction(jarKasir, "createPayment", [
      { transactionId: fx.k1.id, amountPaid: 200000 },
    ]);
    assertEq(run.parsed.ok, true, `createPayment returned ${JSON.stringify(run.parsed)}`);
    assertEq(run.parsed.transactionStatus, "paid", "returned transactionStatus");

    const pays = await confirmedPayments(fx.k1.id);
    assertEq(pays.length, 2, "confirmed payment rows for K1");
    const total = pays.reduce((sum, p) => sum + Number(p.amountPaid), 0);
    assertEq(total, 300000, "total confirmed payments for K1");

    const k1 = await transactionById(fx.k1.id);
    assertEq(k1.status, "paid", "K1.status");
    return `ok:true transactionStatus=paid · rows=2 total=300000 K1.status=paid`;
  });

  // ── 4. Over-payment on K3 ─────────────────────────────────────────────────
  await scenario(4, "Over-payment 100001 on K3 (remaining 100000) refused", async () => {
    const run = await mustAction(jarKasir, "createPayment", [
      { transactionId: fx.k3.id, amountPaid: 100001 },
    ]);
    assertEq(run.parsed.ok, false, `createPayment returned ${JSON.stringify(run.parsed)}`);
    assert(
      (run.parsed.error || "").includes("melebihi sisa utang"),
      `error mentions remaining: ${JSON.stringify(run.parsed.error)}`,
    );
    const pays = await confirmedPayments(fx.k3.id);
    assertEq(pays.length, 0, "confirmed payment rows for K3");
    const k3 = await transactionById(fx.k3.id);
    assertEq(k3.status, "unpaid", "K3.status");
    return `ok:false error="${run.parsed.error}" · rows=0 K3.status=unpaid`;
  });

  // ── 5. Amount 0 / negative ────────────────────────────────────────────────
  await scenario(5, "amountPaid 0 and negative are refused", async () => {
    const zero = await mustAction(jarKasir, "createPayment", [
      { transactionId: fx.k3.id, amountPaid: 0 },
    ]);
    assertEq(zero.parsed.ok, false, `amount 0 returned ${JSON.stringify(zero.parsed)}`);
    assertEq(zero.parsed.error, PAYMENT_ERR.AMOUNT_INVALID, "amount 0 error");

    const negative = await mustAction(jarKasir, "createPayment", [
      { transactionId: fx.k3.id, amountPaid: -5 },
    ]);
    assertEq(
      negative.parsed.ok,
      false,
      `amount -5 returned ${JSON.stringify(negative.parsed)}`,
    );
    assertEq(negative.parsed.error, PAYMENT_ERR.AMOUNT_INVALID, "amount -5 error");

    const pays = await confirmedPayments(fx.k3.id);
    assertEq(pays.length, 0, "confirmed payment rows for K3");
    return `ok:false/ok:false error="${PAYMENT_ERR.AMOUNT_INVALID}" · rows=0`;
  });

  // ── 6. Non-numeric amount ─────────────────────────────────────────────────
  await scenario(6, "amountPaid \"abc\" is refused", async () => {
    const run = await mustAction(jarKasir, "createPayment", [
      { transactionId: fx.k3.id, amountPaid: "abc" },
    ]);
    assertEq(run.parsed.ok, false, `amount "abc" returned ${JSON.stringify(run.parsed)}`);
    assertEq(run.parsed.error, PAYMENT_ERR.AMOUNT_INVALID, "amount \"abc\" error");
    const pays = await confirmedPayments(fx.k3.id);
    assertEq(pays.length, 0, "confirmed payment rows for K3");
    return `ok:false error="${run.parsed.error}" · rows=0`;
  });

  // ── 7. Payment on already-paid K1 ─────────────────────────────────────────
  await scenario(7, "Payment on already-paid K1 is refused", async () => {
    const run = await mustAction(jarKasir, "createPayment", [
      { transactionId: fx.k1.id, amountPaid: 1000 },
    ]);
    assertEq(run.parsed.ok, false, `createPayment returned ${JSON.stringify(run.parsed)}`);
    assertEq(run.parsed.error, PAYMENT_ERR.TX_ALREADY_PAID, "already-paid error");
    const pays = await confirmedPayments(fx.k1.id);
    assertEq(pays.length, 2, "confirmed payment rows for K1 unchanged");
    return `ok:false error="${run.parsed.error}" · K1 rows=2`;
  });

  // ── 8. Payment on draft K4 ────────────────────────────────────────────────
  await scenario(8, "Payment on draft K4 is refused", async () => {
    const run = await mustAction(jarKasir, "createPayment", [
      { transactionId: fx.k4.id, amountPaid: 10000 },
    ]);
    assertEq(run.parsed.ok, false, `createPayment returned ${JSON.stringify(run.parsed)}`);
    assertEq(run.parsed.error, PAYMENT_ERR.TX_NOT_CONFIRMED, "draft error");
    const pays = await confirmedPayments(fx.k4.id);
    assertEq(pays.length, 0, "confirmed payment rows for K4");
    return `ok:false error="${run.parsed.error}" · K4 rows=0`;
  });

  // ── 9. Paying K2 leaves K1 untouched ──────────────────────────────────────
  await scenario(9, "Paying K2 in full leaves K1 untouched", async () => {
    const run = await mustAction(jarOwnerA, "createPayment", [
      { transactionId: fx.k2.id, amountPaid: 500000 },
    ]);
    assertEq(run.parsed.ok, true, `createPayment returned ${JSON.stringify(run.parsed)}`);
    assertEq(run.parsed.transactionStatus, "paid", "K2 transactionStatus");
    const k1 = await transactionById(fx.k1.id);
    assertEq(k1.status, "paid", "K1.status");
    const k1Pays = await confirmedPayments(fx.k1.id);
    assertEq(k1Pays.length, 2, "K1 payment rows unchanged");
    const k2Pays = await confirmedPayments(fx.k2.id);
    assertEq(k2Pays.length, 1, "K2 payment rows");
    return `K2 ok:true status=paid rows=1 · K1.status=paid rows=2`;
  });

  // ── 10. Cross-tenant IDOR ─────────────────────────────────────────────────
  await scenario(10, "Cross-tenant IDOR: A cannot pay KB", async () => {
    const run = await mustAction(jarOwnerA, "createPayment", [
      { transactionId: fx.kb.id, amountPaid: 1000 },
    ]);
    assertEq(run.parsed.ok, false, `IDOR returned ${JSON.stringify(run.parsed)}`);
    assertEq(run.parsed.error, PAYMENT_ERR.TX_NOT_FOUND, "IDOR error is the not-found message");
    const pays = await confirmedPayments(fx.kb.id);
    assertEq(pays.length, 0, "confirmed payment rows for KB");
    const kb = await transactionById(fx.kb.id);
    assertEq(kb.status, "unpaid", "KB.status");
    return `ok:false error="${run.parsed.error}" · KB rows=0 KB.status=unpaid`;
  });

  // ── 11. Unauthenticated call ──────────────────────────────────────────────
  await scenario(11, "Unauthenticated call is refused and writes nothing", async () => {
    const anonJar = new CookieJar();
    const run = await callAction(anonJar, "createPayment", [
      { transactionId: fx.k3.id, amountPaid: 1000 },
    ]);
    assert(run.parsed.ok !== true, `anon call returned ${JSON.stringify(run.parsed)}`);
    const pays = await confirmedPayments(fx.k3.id);
    assertEq(pays.length, 0, "confirmed payment rows for K3");
    return `HTTP ${run.status} ok=${JSON.stringify(run.parsed.ok)} error="${run.parsed.error ?? ""}" · K3 rows=0`;
  });

  // ── 12. Owner can record on fresh K5 ──────────────────────────────────────
  await scenario(12, "Owner records payment on fresh K5", async () => {
    const run = await mustAction(jarOwnerA, "createPayment", [
      { transactionId: fx.k5.id, amountPaid: 150000 },
    ]);
    assertEq(run.parsed.ok, true, `createPayment returned ${JSON.stringify(run.parsed)}`);
    assertEq(run.parsed.transactionStatus, "paid", "K5 transactionStatus");
    const pays = await confirmedPayments(fx.k5.id);
    assertEq(pays.length, 1, "confirmed payment rows for K5");
    const k5 = await transactionById(fx.k5.id);
    assertEq(k5.status, "paid", "K5.status");
    return `ok:true status=paid · K5 rows=1 amount=${Number(pays[0].amountPaid)} K5.status=paid`;
  });

  // ── 13. Rendered page ─────────────────────────────────────────────────────
  await scenario(13, "Rendered /dashboard/pembayaran (owner + kasir)", async () => {
    const res = await getPage("/dashboard/pembayaran", jarOwnerA);
    assertEq(res.status, 200, "owner GET /dashboard/pembayaran status");
    const text = visibleText(res.body);
    assert(text.includes(fx.c1.name), `visible text is missing C1 name "${fx.c1.name}"`);
    assert(text.includes("Terkonfirmasi"), "visible text is missing the Terkonfirmasi badge");
    assert(
      !text.includes(fx.cb.name),
      `visible text leaked business B customer "${fx.cb.name}"`,
    );

    const kasirRes = await getPage("/dashboard/pembayaran", jarKasir);
    assertEq(kasirRes.status, 200, "kasir GET /dashboard/pembayaran status");
    assert(
      !(kasirRes.location || "").includes("/login"),
      `kasir was redirected to ${kasirRes.location}`,
    );
    return (
      `owner GET 200, text has "${fx.c1.name}" + "Terkonfirmasi", no "${fx.cb.name}"; ` +
      `kasir GET ${kasirRes.status} location=${kasirRes.location ?? "-"}`
    );
  });

  // ── Resolved mapping report ───────────────────────────────────────────────
  console.log("\nResolved action-id mapping (client chunks ∩ server manifest):");
  for (const entry of resolution) {
    console.log(`  ${entry.name.padEnd(24)} ${entry.id}  ${entry.page}  (${entry.file})`);
  }

  return { realBefore, businessCountBefore, userCountBefore };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cleanup + real-row protection
// ─────────────────────────────────────────────────────────────────────────────

async function cleanupFixtures() {
  const stale = await prisma.user.findMany({
    where: { email: { endsWith: E2E_SUFFIX } },
    select: { id: true, businessId: true, email: true },
  });
  const userIds = stale.map((u) => u.id);
  const emails = stale.map((u) => u.email);

  // Catch-all: E2E-named/invite businesses from a crashed run (users may be gone).
  const orphanBusinesses = await prisma.business.findMany({
    where: {
      OR: [
        { name: { startsWith: "E2E " } },
        { inviteCode: { startsWith: "E2E-" } },
      ],
    },
    select: { id: true },
  });
  const businessIds = [
    ...new Set(
      [
        ...stale.map((u) => u.businessId).filter(Boolean),
        fx.businessA?.id,
        fx.businessB?.id,
        ...orphanBusinesses.map((b) => b.id),
      ].filter(Boolean),
    ),
  ];

  if (userIds.length) {
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.notification.deleteMany({ where: { body: { in: emails } } });
  }
  await deleteBusinessesCascade(businessIds);
}

async function verifyRealRowsUntouched(snapshot) {
  const realAfter = await prisma.user.findMany({
    where: { NOT: { email: { endsWith: E2E_SUFFIX } } },
    select: { id: true, email: true, name: true, role: true, status: true, businessId: true },
    orderBy: { id: "asc" },
  });
  const same = JSON.stringify(realAfter) === JSON.stringify(snapshot.realBefore);
  const businessCountAfter = await prisma.business.count();
  const userCountAfter = await prisma.user.count();

  console.log("\nReal-row protection:");
  console.log(
    `  pre-existing users before=${snapshot.realBefore.length} after=${realAfter.length} ` +
      `(${snapshot.realBefore.map((u) => u.email).join(", ") || "none"}) — ${same ? "UNCHANGED" : "CHANGED"}`,
  );
  console.log(
    `  totals before users=${snapshot.userCountBefore} businesses=${snapshot.businessCountBefore} · ` +
      `after users=${userCountAfter} businesses=${businessCountAfter}`,
  );
  return same;
}

function printSummary() {
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("SCENARIO SUMMARY");
  console.log("══════════════════════════════════════════════════════════════");
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}`);
  }
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} scenarios passed`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

let realSnapshot = null;
try {
  realSnapshot = await main();
} catch (error) {
  failed = true;
  console.error(`\nFATAL: ${error.message}`);
  if (DEBUG) console.error(error);
} finally {
  await stopServer(server);
  try {
    await cleanupFixtures();
  } catch (error) {
    failed = true;
    console.error(`cleanup failed: ${error.message}`);
  }
  if (realSnapshot) {
    try {
      const untouched = await verifyRealRowsUntouched(realSnapshot);
      if (!untouched) failed = true;
    } catch (error) {
      failed = true;
      console.error(`real-row verification failed: ${error.message}`);
    }
  }
  printSummary();
  await prisma.$disconnect().catch(() => {});
  await pool.end().catch(() => {});
}

process.exit(failed || results.some((r) => !r.ok) ? 1 : 0);
