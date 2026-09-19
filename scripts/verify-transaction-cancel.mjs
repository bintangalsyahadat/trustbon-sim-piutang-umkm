#!/usr/bin/env node
/**
 * End-to-end verification harness for the payment guard in `cancelTransaction`
 * (app/actions/transactions.js).
 *
 * Rule under test: an owner may only cancel a `confirmed` transaction that has
 * ZERO confirmed payments. Any confirmed payment (partial or settled) must make
 * the cancel fail, regardless of what `Transaction.status` claims.
 *
 * Infrastructure mirrors scripts/verify-customer-delete.mjs / verify-payments.mjs:
 *  1. Reuses the existing build when SKIP_BUILD=1 and .next/BUILD_ID exists.
 *  2. Starts `next start` on port 3100 (honours E2E_PORT; NEVER touches 3000 where
 *     the product owner's dev server runs) and stops it again.
 *  3. Resolves `cancelTransaction`'s server-action id from the built client chunks
 *     (`createServerReference("<id>", ..., "cancelTransaction")`) cross-checked
 *     against `.next/server/server-reference-manifest.json`.
 *  4. Seeds isolated fixtures directly via Prisma (@e2e.test emails + a per-run
 *     suffix so unique constraints never collide).
 *  5. Drives the real HTTP surface: NextAuth credentials login, a cookie jar, real
 *     server-action POSTs (`Next-Action` id + `Origin` + React `encodeReply`), page GETs.
 *  6. Judges every scenario by observed DB state + the action's own { ok, error },
 *     never by HTTP 200.
 *  7. Cleans fixtures up in `finally` and proves pre-existing real rows are UNCHANGED.
 *
 * Usage:
 *   node scripts/verify-transaction-cancel.mjs
 *   SKIP_BUILD=1 node scripts/verify-transaction-cancel.mjs
 *   E2E_DEBUG=1  node scripts/verify-transaction-cancel.mjs
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

// Verbatim guard strings from app/actions/transactions.js (frozen contract).
const TX_ERR = {
  OWNER_ONLY: "Hanya pemilik yang dapat membatalkan transaksi.",
  NOT_CONFIRMED: "Hanya transaksi terkonfirmasi yang dapat dibatalkan.",
  NOTE_REQUIRED: "Alasan pembatalan wajib diisi.",
  NOT_FOUND: "Transaksi tidak ditemukan.",
  SETTLED: "Transaksi yang sudah lunas tidak dapat dibatalkan.",
  HAS_PAYMENT: "Transaksi yang sudah memiliki pembayaran tidak dapat dibatalkan.",
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

const ACTION_NAME = "cancelTransaction";

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
  if (DEBUG) console.log(`  [login] ${email} -> ${res.status}`);
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

function createTransaction({
  businessId,
  customerId,
  sequenceNumber,
  amount,
  status,
  paymentStatus = "confirmed",
  cancelledNote = null,
}) {
  return prisma.transaction.create({
    data: {
      businessId,
      customerId,
      period: 202609,
      sequenceNumber,
      amount,
      dueDate: FUTURE_DUE,
      paymentStatus,
      status,
      cancelledNote,
    },
  });
}

function createPayment({ transactionId, amountPaid }) {
  return prisma.payment.create({
    data: { transactionId, amountPaid, status: "confirmed" },
  });
}

const txById = (id) => prisma.transaction.findUnique({ where: { id } });

// ─────────────────────────────────────────────────────────────────────────────
// Visible-HTML helpers
// ─────────────────────────────────────────────────────────────────────────────

function countOccurrences(html, needle) {
  return html.split(needle).length - 1;
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
  console.log(`TrustBon cancelTransaction verification harness (run suffix: ${RUN})`);
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
  {
    const observed = await (async () => {
    fx.businessA = await createBusiness(`E2E Cancel A ${RUN}`, `E2E-CAN-A-${RUN}`);
    fx.businessB = await createBusiness(`E2E Cancel B ${RUN}`, `E2E-CAN-B-${RUN}`);

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

    const cust = async (key, name) => {
      fx[key] = await createCustomer({ businessId: fx.businessA.id, name: `${name} ${RUN}` });
      return fx[key];
    };

    const cUnpaid = await cust("cUnpaid", "C Unpaid");
    const cUnpaid2 = await cust("cUnpaid2", "C Unpaid2");
    const cUnpaid3 = await cust("cUnpaid3", "C Unpaid3");
    const cPartial = await cust("cPartial", "C Partial");
    const cPaid = await cust("cPaid", "C Paid");
    const cDraft = await cust("cDraft", "C Draft");
    const cNeed = await cust("cNeed", "C NeedApproval");
    const cCancelled = await cust("cCancelled", "C Cancelled");
    fx.cB = await createCustomer({
      businessId: fx.businessB.id,
      name: `C Tenant B ${RUN}`,
    });

    fx.tUnpaid = await createTransaction({
      businessId: fx.businessA.id,
      customerId: cUnpaid.id,
      sequenceNumber: 1,
      amount: 100000,
      status: "unpaid",
    });
    fx.tUnpaid2 = await createTransaction({
      businessId: fx.businessA.id,
      customerId: cUnpaid2.id,
      sequenceNumber: 2,
      amount: 100000,
      status: "unpaid",
    });
    fx.tUnpaid3 = await createTransaction({
      businessId: fx.businessA.id,
      customerId: cUnpaid3.id,
      sequenceNumber: 3,
      amount: 100000,
      status: "unpaid",
    });
    fx.tPartial = await createTransaction({
      businessId: fx.businessA.id,
      customerId: cPartial.id,
      sequenceNumber: 4,
      amount: 300000,
      status: "partial",
    });
    fx.partialPay = await createPayment({
      transactionId: fx.tPartial.id,
      amountPaid: 100000,
    });
    fx.tPaid = await createTransaction({
      businessId: fx.businessA.id,
      customerId: cPaid.id,
      sequenceNumber: 5,
      amount: 150000,
      status: "paid",
    });
    fx.paidPay = await createPayment({
      transactionId: fx.tPaid.id,
      amountPaid: 150000,
    });
    fx.tDraft = await createTransaction({
      businessId: fx.businessA.id,
      customerId: cDraft.id,
      sequenceNumber: 6,
      amount: 100000,
      status: "unpaid",
      paymentStatus: "draft",
    });
    fx.tNeed = await createTransaction({
      businessId: fx.businessA.id,
      customerId: cNeed.id,
      sequenceNumber: 7,
      amount: 100000,
      status: "unpaid",
      paymentStatus: "need_approval",
    });
    fx.tCancelled = await createTransaction({
      businessId: fx.businessA.id,
      customerId: cCancelled.id,
      sequenceNumber: 8,
      amount: 100000,
      status: "unpaid",
      paymentStatus: "cancelled",
      cancelledNote: "Dibatalkan karena salah input.",
    });
    fx.txB = await createTransaction({
      businessId: fx.businessB.id,
      customerId: fx.cB.id,
      sequenceNumber: 1,
      amount: 100000,
      status: "unpaid",
    });

    const countA = await prisma.transaction.count({ where: { businessId: fx.businessA.id } });
    assert(countA < 10, `Business A should have <10 transactions for a single page, got ${countA}`);

    return (
      `A=${fx.businessA.id} B=${fx.businessB.id} · ` +
      `unpaid=${fx.tUnpaid.id} unpaid2=${fx.tUnpaid2.id} unpaid3=${fx.tUnpaid3.id} ` +
      `partial=${fx.tPartial.id} paid=${fx.tPaid.id} draft=${fx.tDraft.id} ` +
      `need=${fx.tNeed.id} cancelled=${fx.tCancelled.id} txB=${fx.txB.id} · A txs=${countA}`
    );
    })();
    console.log(`\nSEED  fixtures (isolated @e2e.test data)\n      ${observed}`);
  }

  const jarOwnerA = await jarFor(fx.ownerA.email);
  const jarKasirA = await jarFor(fx.kasirA.email);

  // ── 2. Owner cancels T_unpaid (legitimate) ────────────────────────────────
  await scenario(1, "Owner cancels T_unpaid (confirmed, no payments) -> ok:true, cancelled + scoring no-op", async () => {
    const note = "Salah input dari kasir.";
    const pre = await prisma.customer.findUnique({
      where: { id: fx.tUnpaid.customerId },
      select: { riskScore: true, trustStatus: true },
    });
    assertEq(pre.riskScore, 50, "pre riskScore");
    assertEq(pre.trustStatus, "unrated", "pre trustStatus");
    const scoreBefore = await prisma.scoreHistory.count({
      where: { customerId: fx.tUnpaid.customerId },
    });
    const run = await mustAction(jarOwnerA, [{ transactionId: fx.tUnpaid.id, note }]);
    assertEq(run.parsed.ok, true, `cancel T_unpaid returned ${JSON.stringify(run.parsed)}`);

    const tx = await txById(fx.tUnpaid.id);
    assertEq(tx.paymentStatus, "cancelled", "T_unpaid paymentStatus");
    assertEq(tx.cancelledNote, note, "T_unpaid cancelledNote");
    assertEq(tx.status, "unpaid", "T_unpaid repayment status untouched");

    // Scoring counts only CONFIRMED transactions. Cancelling T_unpaid leaves this
    // customer (whose only transaction it was) with ZERO confirmed history, so the
    // scorer SKIPs: risk/trust stay put and no ScoreHistory row is appended.
    const post = await prisma.customer.findUnique({
      where: { id: fx.tUnpaid.customerId },
      select: { riskScore: true, trustStatus: true },
    });
    assertEq(post.riskScore, pre.riskScore, "riskScore unchanged after cancel");
    assertEq(post.trustStatus, pre.trustStatus, "trustStatus unchanged after cancel");
    const scoreAfter = await prisma.scoreHistory.count({
      where: { customerId: fx.tUnpaid.customerId },
    });
    assertEq(scoreAfter, scoreBefore, "no new ScoreHistory row after cancel");
    return (
      `ok:true error=none · paymentStatus=cancelled cancelledNote="${tx.cancelledNote}" ` +
      `status=unpaid · ScoreHistory ${scoreBefore}->${scoreAfter} (skip: zero confirmed history)`
    );
  });

  // ── 3. Owner cancels T_partial (has a payment) ────────────────────────────
  await scenario(2, "Owner cancels T_partial (has 1 confirmed payment) -> refused with has-payment message", async () => {
    const run = await mustAction(jarOwnerA, [{ transactionId: fx.tPartial.id, note: "Coba batalkan." }]);
    assertEq(run.parsed.ok, false, `cancel T_partial returned ${JSON.stringify(run.parsed)}`);
    assertEq(run.parsed.error, TX_ERR.HAS_PAYMENT, "T_partial error is the has-payment message");

    const tx = await txById(fx.tPartial.id);
    assertEq(tx.paymentStatus, "confirmed", "T_partial paymentStatus unchanged");
    assertEq(tx.status, "partial", "T_partial status unchanged");
    const pay = await prisma.payment.findUnique({ where: { id: fx.partialPay.id } });
    assert(pay, "T_partial Payment row must still exist");
    return (
      `ok:false error="${run.parsed.error}" · paymentStatus=confirmed status=partial · ` +
      `payment#${pay.id} amountPaid=${Number(pay.amountPaid)} intact`
    );
  });

  // ── 4. Owner cancels T_paid (settled) ─────────────────────────────────────
  await scenario(3, "Owner cancels T_paid (payments == amount) -> refused with lunas message", async () => {
    const run = await mustAction(jarOwnerA, [{ transactionId: fx.tPaid.id, note: "Coba batalkan." }]);
    assertEq(run.parsed.ok, false, `cancel T_paid returned ${JSON.stringify(run.parsed)}`);
    assertEq(run.parsed.error, TX_ERR.SETTLED, "T_paid error is the lunas message");

    const tx = await txById(fx.tPaid.id);
    assertEq(tx.paymentStatus, "confirmed", "T_paid paymentStatus unchanged");
    assertEq(tx.status, "paid", "T_paid status unchanged");
    const pays = await prisma.payment.findMany({ where: { transactionId: fx.tPaid.id } });
    assertEq(pays.length, 1, "T_paid Payment row count unchanged");
    assertEq(Number(pays[0].amountPaid), 150000, "T_paid Payment amount unchanged");
    return (
      `ok:false error="${run.parsed.error}" · paymentStatus=confirmed status=paid · ` +
      `payments=${pays.length} sum=${pays.reduce((s, p) => s + Number(p.amountPaid), 0)} intact`
    );
  });

  // ── 5. Whitespace note on a legitimate target ─────────────────────────────
  await scenario(4, "Whitespace-only note on T_unpaid2 -> note error (guard order still works)", async () => {
    const run = await mustAction(jarOwnerA, [{ transactionId: fx.tUnpaid2.id, note: "   " }]);
    assertEq(run.parsed.ok, false, `cancel T_unpaid2 returned ${JSON.stringify(run.parsed)}`);
    assertEq(run.parsed.error, TX_ERR.NOTE_REQUIRED, "T_unpaid2 error is the note message");
    const tx = await txById(fx.tUnpaid2.id);
    assertEq(tx.paymentStatus, "confirmed", "T_unpaid2 paymentStatus unchanged");
    return `ok:false error="${run.parsed.error}" · paymentStatus=confirmed (payment guard did not swallow the note guard)`;
  });

  // ── 6. Kasir (non-owner) ──────────────────────────────────────────────────
  await scenario(5, "Kasir cancels T_unpaid3 -> owner-only refusal, unchanged", async () => {
    const run = await mustAction(jarKasirA, [{ transactionId: fx.tUnpaid3.id, note: "Coba batalkan." }]);
    assertEq(run.parsed.ok, false, `kasir cancel returned ${JSON.stringify(run.parsed)}`);
    assertEq(run.parsed.error, TX_ERR.OWNER_ONLY, "kasir error is owner-only");
    const tx = await txById(fx.tUnpaid3.id);
    assertEq(tx.paymentStatus, "confirmed", "T_unpaid3 paymentStatus unchanged");
    return `ok:false error="${run.parsed.error}" · paymentStatus=confirmed`;
  });

  // ── 7. Cross-tenant ───────────────────────────────────────────────────────
  await scenario(6, "Cross-tenant: owner A cancels TX_B (tenant B) -> not found, unchanged", async () => {
    const run = await mustAction(jarOwnerA, [{ transactionId: fx.txB.id, note: "Coba batalkan." }]);
    assertEq(run.parsed.ok, false, `cross-tenant cancel returned ${JSON.stringify(run.parsed)}`);
    assertEq(run.parsed.error, TX_ERR.NOT_FOUND, "cross-tenant error is not-found");
    const tx = await txById(fx.txB.id);
    assertEq(tx.paymentStatus, "confirmed", "TX_B paymentStatus unchanged");
    assertEq(tx.cancelledNote, null, "TX_B cancelledNote must remain null");
    return `ok:false error="${run.parsed.error}" · TX_B paymentStatus=confirmed cancelledNote=null`;
  });

  // ── 8. Draft + need_approval ──────────────────────────────────────────────
  await scenario(7, "Draft + need_approval are not cancellable -> both refused, unchanged", async () => {
    const draftRun = await mustAction(jarOwnerA, [{ transactionId: fx.tDraft.id, note: "Coba batalkan." }]);
    assertEq(draftRun.parsed.ok, false, `draft cancel returned ${JSON.stringify(draftRun.parsed)}`);
    assertEq(draftRun.parsed.error, TX_ERR.NOT_CONFIRMED, "draft error is not-confirmed");

    const needRun = await mustAction(jarOwnerA, [{ transactionId: fx.tNeed.id, note: "Coba batalkan." }]);
    assertEq(needRun.parsed.ok, false, `need_approval cancel returned ${JSON.stringify(needRun.parsed)}`);
    assertEq(needRun.parsed.error, TX_ERR.NOT_CONFIRMED, "need_approval error is not-confirmed");

    const draft = await txById(fx.tDraft.id);
    const need = await txById(fx.tNeed.id);
    assertEq(draft.paymentStatus, "draft", "T_draft unchanged");
    assertEq(need.paymentStatus, "need_approval", "T_need_appr unchanged");
    return (
      `draft ok:false error="${draftRun.parsed.error}" status=draft · ` +
      `need_approval ok:false error="${needRun.parsed.error}" status=need_approval`
    );
  });

  // ── 9. Already-cancelled ──────────────────────────────────────────────────
  await scenario(8, "Already-cancelled T_cancelled -> refused, cancelledNote not overwritten", async () => {
    const originalNote = fx.tCancelled.cancelledNote;
    const run = await mustAction(jarOwnerA, [{ transactionId: fx.tCancelled.id, note: "Alasan baru." }]);
    assertEq(run.parsed.ok, false, `cancel T_cancelled returned ${JSON.stringify(run.parsed)}`);
    assertEq(run.parsed.error, TX_ERR.NOT_CONFIRMED, "T_cancelled error is not-confirmed");
    const tx = await txById(fx.tCancelled.id);
    assertEq(tx.paymentStatus, "cancelled", "T_cancelled paymentStatus unchanged");
    assertEq(tx.cancelledNote, originalNote, "T_cancelled cancelledNote must not be overwritten");
    return `ok:false error="${run.parsed.error}" · cancelledNote preserved="${tx.cancelledNote}"`;
  });

  // ── 10. Drift-proof: status forced to unpaid, payment data still blocks ───
  await scenario(9, "DRIFT: T_partial.status forced to 'unpaid' -> still refused (payment data blocks)", async () => {
    await prisma.transaction.update({
      where: { id: fx.tPartial.id },
      data: { status: "unpaid" },
    });
    const forced = await txById(fx.tPartial.id);
    assertEq(forced.status, "unpaid", "T_partial status should be forced to unpaid");

    const run = await mustAction(jarOwnerA, [{ transactionId: fx.tPartial.id, note: "Coba batalkan." }]);
    const pay = await prisma.payment.findUnique({ where: { id: fx.partialPay.id } });
    assert(pay, "T_partial Payment row must be intact after the drift cancel attempt");
    assertEq(pay.status, "confirmed", "T_partial Payment.status unchanged");

    // restore the realistic seed state for later scenarios
    await prisma.transaction.update({
      where: { id: fx.tPartial.id },
      data: { status: "partial" },
    });

    assertEq(run.parsed.ok, false, `drift cancel returned ${JSON.stringify(run.parsed)}`);
    assertEq(
      run.parsed.error,
      TX_ERR.HAS_PAYMENT,
      "drift cancel must still report the has-payment message",
    );
    return (
      `forced status="unpaid" then cancel -> ok:false error="${run.parsed.error}" · ` +
      `payment#${pay.id} amountPaid=${Number(pay.amountPaid)} intact · status restored=partial`
    );
  });

  // ── 11. Inverse drift: status forced to paid -> settled branch ────────────
  await scenario(10, "DRIFT: T_partial.status forced to 'paid' -> refused with lunas message (status branch)", async () => {
    await prisma.transaction.update({
      where: { id: fx.tPartial.id },
      data: { status: "paid" },
    });
    const forced = await txById(fx.tPartial.id);
    assertEq(forced.status, "paid", "T_partial status should be forced to paid");

    const run = await mustAction(jarOwnerA, [{ transactionId: fx.tPartial.id, note: "Coba batalkan." }]);

    await prisma.transaction.update({
      where: { id: fx.tPartial.id },
      data: { status: "partial" },
    });

    assertEq(run.parsed.ok, false, `inverse drift cancel returned ${JSON.stringify(run.parsed)}`);
    assertEq(
      run.parsed.error,
      TX_ERR.SETTLED,
      "inverse drift cancel must report the lunas message (settled via the status branch)",
    );
    return (
      `confirmed payments=100000 < amount=300000, forced status="paid" then cancel -> ` +
      `ok:false error="${run.parsed.error}" · status restored=partial`
    );
  });

  // ── 12. Regression: other transactions' payments survive a cancel ─────────
  await scenario(11, "Regression: payments of OTHER transactions untouched by a successful cancel", async () => {
    const partialBefore = await prisma.payment.findUnique({ where: { id: fx.partialPay.id } });
    const paidBefore = await prisma.payment.findUnique({ where: { id: fx.paidPay.id } });

    fx.cUnpaid4 = await createCustomer({
      businessId: fx.businessA.id,
      name: `C Unpaid4 ${RUN}`,
    });
    fx.tUnpaid4 = await createTransaction({
      businessId: fx.businessA.id,
      customerId: fx.cUnpaid4.id,
      sequenceNumber: 9,
      amount: 100000,
      status: "unpaid",
    });
    const run = await mustAction(jarOwnerA, [
      { transactionId: fx.tUnpaid4.id, note: "Pembatalan regresi." },
    ]);
    assertEq(run.parsed.ok, true, `fresh cancel returned ${JSON.stringify(run.parsed)}`);

    const partialAfter = await prisma.payment.findUnique({ where: { id: fx.partialPay.id } });
    const paidAfter = await prisma.payment.findUnique({ where: { id: fx.paidPay.id } });
    assertEq(
      JSON.stringify(partialAfter),
      JSON.stringify(partialBefore),
      "T_partial Payment row changed",
    );
    assertEq(
      JSON.stringify(paidAfter),
      JSON.stringify(paidBefore),
      "T_paid Payment row changed",
    );
    return (
      `fresh cancel ok:true · payment#${partialAfter.id} + payment#${paidAfter.id} byte-identical ` +
      `before/after (amounts ${Number(partialAfter.amountPaid)} / ${Number(paidAfter.amountPaid)})`
    );
  });

  // ── 13. UI gate: rendered transaksi table ─────────────────────────────────
  await scenario(12, "UI gate: transaksi table carries both guard tooltips + correct Batalkan count", async () => {
    const res = await getPage("/dashboard/transaksi", jarOwnerA);
    assertEq(res.status, 200, "GET /dashboard/transaksi status");

    const lunasAttr = 'title="Transaksi yang sudah lunas tidak dapat dibatalkan."';
    const hasPaymentAttr = 'title="Transaksi yang sudah memiliki pembayaran tidak dapat dibatalkan."';
    assert(
      res.body.includes(lunasAttr),
      `rendered HTML missing ${lunasAttr}`,
    );
    assert(
      res.body.includes(hasPaymentAttr),
      `rendered HTML missing ${hasPaymentAttr}`,
    );

    const enabled = countOccurrences(res.body, 'title="Batalkan"');
    const dbCancellable = await prisma.transaction.count({
      where: {
        businessId: fx.businessA.id,
        paymentStatus: "confirmed",
        status: "unpaid",
      },
    });
    assertEq(
      enabled,
      dbCancellable,
      "enabled Batalkan button count must match confirmed+unpaid rows",
    );
    return (
      `GET ${res.status} · lunas tooltip present · has-payment tooltip present · ` +
      `title="Batalkan" count=${enabled} == DB confirmed+unpaid=${dbCancellable}`
    );
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
