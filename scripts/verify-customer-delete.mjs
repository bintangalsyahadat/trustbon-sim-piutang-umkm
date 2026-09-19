#!/usr/bin/env node
/**
 * End-to-end verification harness for the `deleteCustomer` fix in
 * app/actions/customers.js.
 *
 * Infrastructure mirrors scripts/verify-payments.mjs / verify-authz.mjs:
 *  1. Reuses the existing build unless SKIP_BUILD is unset and no .next/BUILD_ID.
 *  2. Starts `next start` on port 3100 (honours E2E_PORT; NEVER touches 3000 where
 *     the product owner's dev server runs) and stops it again.
 *  3. Resolves `deleteCustomer`'s server-action id from the built client chunks
 *     (`createServerReference("<id>", ..., "deleteCustomer")`) cross-checked against
 *     `.next/server/server-reference-manifest.json`.
 *  4. Seeds isolated fixtures directly via Prisma (@e2e.test emails + a per-run
 *     suffix so unique constraints never collide).
 *  5. Drives the real HTTP surface: NextAuth credentials login, a cookie jar, real
 *     server-action POSTs (`Next-Action` id + `Origin` + React `encodeReply`), page GETs.
 *  6. Judges every scenario by observed DB state + the action's own { ok, error },
 *     never by HTTP 200.
 *  7. Cleans fixtures up in `finally` and proves pre-existing real rows are UNCHANGED.
 *
 * Usage:
 *   node scripts/verify-customer-delete.mjs
 *   SKIP_BUILD=1 node scripts/verify-customer-delete.mjs
 *   E2E_DEBUG=1  node scripts/verify-customer-delete.mjs
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
const RUN = Date.now().toString(36);

// Verbatim guard/validation strings from app/actions/customers.js (frozen contract).
const CUSTOMER_ERR = {
  OWNER_ONLY: "Hanya pemilik bisnis yang dapat melakukan tindakan ini.",
  NOT_FOUND: "Pelanggan tidak ditemukan.",
  HAS_DEBT: "Pelanggan masih memiliki utang aktif dan tidak dapat dihapus.",
  HAS_HISTORY: "Pelanggan tidak dapat dihapus karena masih memiliki riwayat transaksi.",
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
// Assertion + scenario framework
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
  let p = workerKey.replace(/^app/, "");
  p = p.replace(/\/page$/, "");
  return p === "" ? "/" : p;
}

function scanChunkServerReferences() {
  const map = new Map();
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
    while ((match = re.exec(content)) !== null) map.set(match[1], match[2]);
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

  const byName = new Map();
  const pageByName = new Map();
  for (const [id, entry] of Object.entries(node)) {
    const name = entry.exportedName;
    if (!name) continue;
    if (!byName.has(name)) byName.set(name, { id, file: entry.filename });
    const workers = Object.keys(entry.workers || {});
    if (workers.length && !pageByName.has(name)) {
      pageByName.set(name, manifestPageToPath(workers[0]));
    }
  }

  return {
    byName,
    pageByName,
    chunkMap: scanChunkServerReferences(),
    manifestPath,
  };
}

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

const ACTION_NAME = "deleteCustomer";

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
  const out = { status: res.status, location: res.headers.get("location"), body };
  if (DEBUG) console.log(`  [GET] ${pathname} -> ${res.status} ${out.location || ""}`);
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
  if (DEBUG) console.log(`  [login] ${email} -> ${res.status} (session cookie set)`);
  return res.status;
}

/** Extracts the action's own { ok, error } payload from the flight response. */
function parseActionResult(text) {
  const out = {};
  const okMatch = text.match(/"ok":\s*(true|false)/);
  if (okMatch) out.ok = okMatch[1] === "true";
  const errMatch = text.match(/"error":\s*"((?:[^"\\]|\\.)*)"/);
  if (errMatch && errMatch[1] !== "$undefined") {
    try {
      out.error = JSON.parse(`"${errMatch[1]}"`);
    } catch {
      out.error = errMatch[1];
    }
  }
  const customerIdMatch = text.match(/"customerId":\s*(\d+)/);
  if (customerIdMatch) out.customerId = Number(customerIdMatch[1]);
  return out;
}

async function callAction(jar, args) {
  const resolved = actionIndex.byName.get(ACTION_NAME);
  assert(resolved, `cannot call "${ACTION_NAME}": action id not resolved`);
  const page = actionIndex.pageByName.get(ACTION_NAME);
  assert(page, `cannot call "${ACTION_NAME}": worker page not resolved`);

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
    body = encoded;
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
      `  [action] ${ACTION_NAME} ${JSON.stringify(args)} -> ${res.status} ${JSON.stringify(parsed)}`,
    );
  }
  return { status: res.status, text, parsed, id: resolved.id, page, args };
}

async function mustAction(jar, args) {
  const run = await callAction(jar, args);
  assert(
    run.status === 200,
    `action ${ACTION_NAME} expected HTTP 200, got ${run.status}: ${run.text.slice(0, 240)}`,
  );
  return run;
}

// ─────────────────────────────────────────────────────────────────────────────
// Build / start / stop
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
    env: { ...process.env, PORT: String(PORT), AUTH_URL: BASE, NEXTAUTH_URL: BASE },
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
    await prisma.scoreHistory.deleteMany({ where: { customerId: { in: customerIds } } });
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

function createCustomer({ businessId, name }) {
  return prisma.customer.create({
    data: {
      businessId,
      name,
      phoneNumber: "081200000123",
      creditLimit: 10000000,
      riskScore: 50,
      trustStatus: "unrated",
    },
  });
}

const FUTURE_DUE = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

function createTransaction({ businessId, customerId, sequenceNumber, amount, status }) {
  return prisma.transaction.create({
    data: {
      businessId,
      customerId,
      period: 202609,
      sequenceNumber,
      amount,
      dueDate: FUTURE_DUE,
      paymentStatus: "confirmed",
      status,
    },
  });
}

const customerExists = async (id) =>
  (await prisma.customer.findUnique({ where: { id } })) !== null;

// ─────────────────────────────────────────────────────────────────────────────
// Visible-HTML helpers
// ─────────────────────────────────────────────────────────────────────────────

function stripScriptsAndStyles(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
}

/** True when the non-script HTML contains <a href="href">...label...</a>. */
function hasNavLink(html, href, label) {
  const markup = stripScriptsAndStyles(html);
  const pattern = new RegExp(
    `<a\\b[^>]*href="${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>([\\s\\S]*?)</a>`,
    "i",
  );
  const match = markup.match(pattern);
  if (!match) return false;
  const text = match[1]
    .replace(/<[^>]+>/g, " ")
    .replace(/&[^;]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.includes(label);
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
  console.log(`TrustBon deleteCustomer verification harness (run suffix: ${RUN})`);
  console.log(`  node ${process.version} · base ${BASE}`);

  await buildIfNeeded();
  server = startServer();
  await waitForServer(server);

  actionIndex = resolveActions();
  const resolution = [
    { name: ACTION_NAME, ...verifyAction(ACTION_NAME, actionIndex) },
  ];

  const realBefore = await prisma.user.findMany({
    where: { NOT: { email: { endsWith: E2E_SUFFIX } } },
    select: { id: true, email: true, name: true, role: true, status: true, businessId: true },
    orderBy: { id: "asc" },
  });
  const businessCountBefore = await prisma.business.count();
  const userCountBefore = await prisma.user.count();

  await preClean();

  // ── Seed ──────────────────────────────────────────────────────────────────
  await scenario(1, "Seed fixtures (isolated @e2e.test data)", async () => {
    fx.businessA = await createBusiness(`E2E Delete A ${RUN}`, `E2E-DEL-A-${RUN}`);
    fx.businessB = await createBusiness(`E2E Delete B ${RUN}`, `E2E-DEL-B-${RUN}`);

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

    // D1: no transactions at all.
    fx.d1 = await createCustomer({ businessId: fx.businessA.id, name: `D1 No History ${RUN}` });
    // D1b: a second fresh no-history customer, used by the kasir scenario.
    fx.d1b = await createCustomer({ businessId: fx.businessA.id, name: `D1b No History ${RUN}` });
    // D2: confirmed kasbon with outstanding (unpaid) debt.
    fx.d2 = await createCustomer({ businessId: fx.businessA.id, name: `D2 Debt ${RUN}` });
    fx.d2tx = await createTransaction({
      businessId: fx.businessA.id,
      customerId: fx.d2.id,
      sequenceNumber: 1,
      amount: 100000,
      status: "unpaid",
    });
    // D3: confirmed kasbon fully paid — no active debt, but history survives.
    fx.d3 = await createCustomer({ businessId: fx.businessA.id, name: `D3 Settled ${RUN}` });
    fx.d3tx = await createTransaction({
      businessId: fx.businessA.id,
      customerId: fx.d3.id,
      sequenceNumber: 2,
      amount: 100000,
      status: "paid",
    });
    fx.d3pay = await prisma.payment.create({
      data: { transactionId: fx.d3tx.id, amountPaid: 100000, status: "confirmed" },
    });
    // D4: customer in Business B (cross-tenant target).
    fx.d4 = await createCustomer({ businessId: fx.businessB.id, name: `D4 Tenant B ${RUN}` });

    return (
      `A=${fx.businessA.id} B=${fx.businessB.id} · ` +
      `D1=${fx.d1.id} D1b=${fx.d1b.id} D2=${fx.d2.id} D3=${fx.d3.id} D4=${fx.d4.id}`
    );
  });

  const jarOwnerA = await jarFor(fx.ownerA.email);
  const jarKasirA = await jarFor(fx.kasirA.email);

  // ── 2. Owner deletes D1 (no history) ──────────────────────────────────────
  await scenario(2, "Owner deletes D1 (no history) -> ok:true, row gone", async () => {
    const run = await mustAction(jarOwnerA, [{ id: fx.d1.id }]);
    assertEq(run.parsed.ok, true, `deleteCustomer D1 returned ${JSON.stringify(run.parsed)}`);
    assertEq(
      await customerExists(fx.d1.id),
      false,
      "D1 Customer row should be gone",
    );
    return `ok:true error=${JSON.stringify(run.parsed.error ?? null)} · D1 exists=${await customerExists(fx.d1.id)}`;
  });

  // ── 3. Owner deletes D2 (outstanding debt) ────────────────────────────────
  await scenario(3, "Owner deletes D2 (active debt) -> refused, row + kasbon untouched", async () => {
    const run = await mustAction(jarOwnerA, [{ id: fx.d2.id }]);
    assertEq(run.parsed.ok, false, `deleteCustomer D2 returned ${JSON.stringify(run.parsed)}`);
    assertEq(run.parsed.error, CUSTOMER_ERR.HAS_DEBT, "D2 error is the active-debt message");
    assertEq(await customerExists(fx.d2.id), true, "D2 Customer row must still exist");
    const tx = await prisma.transaction.findUnique({ where: { id: fx.d2tx.id } });
    assert(tx, "D2 kasbon must still exist");
    assertEq(tx.status, "unpaid", "D2 kasbon status unchanged");
    assertEq(Number(tx.amount), 100000, "D2 kasbon amount unchanged");
    const pays = await prisma.payment.count({ where: { transactionId: fx.d2tx.id } });
    assertEq(pays, 0, "D2 kasbon payment count unchanged");
    return `ok:false error="${run.parsed.error}" · D2 exists=true kasbon status=unpaid amount=100000 payments=0`;
  });

  // ── 4. Owner deletes D3 (settled, history survives) ───────────────────────
  await scenario(4, "Owner deletes D3 (settled, has history) -> refused with has-history error", async () => {
    const run = await mustAction(jarOwnerA, [{ id: fx.d3.id }]);
    assertEq(run.parsed.ok, false, `deleteCustomer D3 returned ${JSON.stringify(run.parsed)}`);
    assertEq(
      run.parsed.error,
      CUSTOMER_ERR.HAS_HISTORY,
      "D3 error is the distinct has-history message",
    );
    assert(
      run.parsed.error !== CUSTOMER_ERR.NOT_FOUND,
      "D3 must NOT report the misleading not-found message",
    );
    assertEq(await customerExists(fx.d3.id), true, "D3 Customer row must still exist");
    const tx = await prisma.transaction.findUnique({ where: { id: fx.d3tx.id } });
    assert(tx, "D3 Transaction row must still exist (no cascade)");
    const pay = await prisma.payment.findUnique({ where: { id: fx.d3pay.id } });
    assert(pay, "D3 Payment row must still exist (no cascade)");
    assertEq(pay.status, "confirmed", "D3 Payment.status unchanged");
    return `ok:false error="${run.parsed.error}" · D3 exists=true tx=${tx.id} payment=${pay.id} (none deleted)`;
  });

  // ── 5. Kasir (non-owner) delete attempt ───────────────────────────────────
  await scenario(5, "Kasir attempts to delete D1b -> refused, row still exists", async () => {
    const run = await mustAction(jarKasirA, [{ id: fx.d1b.id }]);
    assertEq(run.parsed.ok, false, `kasir delete returned ${JSON.stringify(run.parsed)}`);
    assertEq(run.parsed.error, CUSTOMER_ERR.OWNER_ONLY, "kasir error is owner-only");
    assertEq(await customerExists(fx.d1b.id), true, "D1b Customer row must still exist");
    return `ok:false error="${run.parsed.error}" · D1b exists=true`;
  });

  // ── 6. Cross-tenant delete ────────────────────────────────────────────────
  await scenario(6, "Cross-tenant: owner A cannot delete D4 (tenant B) -> refused", async () => {
    const run = await mustAction(jarOwnerA, [{ id: fx.d4.id }]);
    assertEq(run.parsed.ok, false, `cross-tenant delete returned ${JSON.stringify(run.parsed)}`);
    assertEq(
      run.parsed.error,
      CUSTOMER_ERR.NOT_FOUND,
      "cross-tenant error is the not-found message",
    );
    assertEq(await customerExists(fx.d4.id), true, "D4 must still exist in Business B");
    const d4 = await prisma.customer.findUnique({ where: { id: fx.d4.id } });
    assertEq(d4.businessId, fx.businessB.id, "D4 still belongs to Business B");
    return `ok:false error="${run.parsed.error}" · D4 exists=true businessId=${d4.businessId}`;
  });

  // ── 7. Nonexistent customer id ────────────────────────────────────────────
  await scenario(7, "Nonexistent customer id -> ok:false, no crash", async () => {
    const missingId = 999999999;
    const run = await mustAction(jarOwnerA, [{ id: missingId }]);
    assertEq(run.parsed.ok, false, `missing id returned ${JSON.stringify(run.parsed)}`);
    assertEq(run.parsed.error, CUSTOMER_ERR.NOT_FOUND, "missing id error is not-found");
    assert(run.status === 200, `expected HTTP 200, got ${run.status}`);
    return `ok:false error="${run.parsed.error}" · HTTP ${run.status} (no crash)`;
  });

  // ── 8. Regression: plain customer still deletes cleanly ───────────────────
  await scenario(8, "Regression: plain customer delete no longer hits a schema error", async () => {
    const fresh = await createCustomer({
      businessId: fx.businessA.id,
      name: `D5 Regression ${RUN}`,
    });
    const run = await mustAction(jarOwnerA, [{ id: fresh.id }]);
    assertEq(run.parsed.ok, true, `fresh delete returned ${JSON.stringify(run.parsed)}`);
    assertEq(await customerExists(fresh.id), false, "fresh customer should be gone");
    return `ok:true (pre-fix this path threw on the dropped Transaction.type column) · exists=false`;
  });

  // ── 9. Nav check: payments reachable from sidebar ─────────────────────────
  await scenario(9, "Sidebar exposes a Pembayaran link to /dashboard/pembayaran", async () => {
    const res = await getPage("/dashboard", jarOwnerA);
    assertEq(res.status, 200, "GET /dashboard status");
    assert(
      hasNavLink(res.body, "/dashboard/pembayaran", "Pembayaran"),
      "no visible <a href=\"/dashboard/pembayaran\">…Pembayaran…</a> found",
    );
    return `GET /dashboard ${res.status} · nav link href="/dashboard/pembayaran" label="Pembayaran" present`;
  });

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
