#!/usr/bin/env node
/**
 * End-to-end verification harness for the transaction APPROVAL flow
 * (feature 4.6): creator attribution + credit-limit-vs-active-debt data.
 *
 * Scope under test:
 *   - createTransaction records `createdById` (cashier vs owner).
 *   - Over-limit creation -> paymentStatus "need_approval"; within limit -> "confirmed".
 *   - /dashboard/approval is owner-only and renders "Diinput oleh <name> · <role>".
 *   - approveTransaction / rejectTransaction are owner-only, scoped to the actor's
 *     business (IDOR-safe) and require a note on reject. Rejecting cancels the
 *     transaction; because scoring counts only CONFIRMED history, a customer whose
 *     only transaction was the rejected one ends up with zero confirmed history, so
 *     the scorer SKIPs (risk/trust untouched, no ScoreHistory row).
 *
 * Infrastructure mirrors scripts/verify-transaction-cancel.mjs / verify-authz.mjs:
 *  1. Reuses the existing build when SKIP_BUILD=1 and .next/BUILD_ID exists.
 *  2. Starts `next start` on port 3200 (honours E2E_PORT; NEVER touches 3000 where
 *     the product owner's dev server runs) and stops ONLY its own child process.
 *  3. Resolves createTransaction / approveTransaction / rejectTransaction server-action
 *     ids from the built client chunks (`createServerReference("<id>", ..., "<name>")`)
 *     cross-checked against `.next/server/server-reference-manifest.json` (fails loudly
 *     if the two disagree).
 *  4. Seeds an isolated fixture set (business A with owner + cashier + customers,
 *     business B with an owner for the IDOR case) via Prisma, `@e2e.test` emails +
 *     a per-run suffix.
 *  5. Drives the real HTTP surface: NextAuth credentials login, a cookie jar, real
 *     server-action POSTs (`Next-Action` id + same-origin `Origin` + React `encodeReply`),
 *     real page GETs.
 *  6. Judges every scenario by observed DB state + the action's own { ok, error },
 *     never by HTTP 200 (refusals also return 200 with { ok:false }).
 *  7. Cleans fixtures up in `finally` and proves pre-existing real rows are UNCHANGED.
 *
 * Usage:
 *   node scripts/verify-approval.mjs
 *   SKIP_BUILD=1 node scripts/verify-approval.mjs
 *   E2E_PORT=3300 node scripts/verify-approval.mjs
 *   E2E_DEBUG=1  node scripts/verify-approval.mjs
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

// Port 3200 per spec (3100 is used by the other harnesses; 3000 belongs to the owner).
const PORT = Number(process.env.E2E_PORT || 3200);
const BASE = `http://localhost:${PORT}`;
const E2E_SUFFIX = "@e2e.test";
const PASSWORD = "E2e-Passw0rd!";
const DEBUG = process.env.E2E_DEBUG === "1";
const RUN = Date.now().toString(36);
const DUE_STR = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
const PERIOD = 202609;

// Verbatim guard strings from app/actions/transactions.js (frozen contract).
const ERR = {
  APPROVE_OWNER_ONLY: "Hanya pemilik yang dapat menyetujui transaksi.",
  REJECT_OWNER_ONLY: "Hanya pemilik yang dapat menolak transaksi.",
  NOT_PENDING: "Transaksi ini tidak menunggu persetujuan.",
  REJECT_NOTE: "Alasan penolakan wajib diisi.",
  NOT_FOUND: "Transaksi tidak ditemukan.",
};

// Action names to resolve (name -> server-action export).
const ACTION_NAMES = ["createTransaction", "approveTransaction", "rejectTransaction"];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

/** Extracts the action's own { ok, error, transactionId } payload from the flight response. */
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
  const txIdMatch = text.match(/"transactionId":\s*(\d+)/);
  if (txIdMatch) out.transactionId = Number(txIdMatch[1]);
  return out;
}

async function callAction(name, jar, args) {
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
      `  [action] ${name} ${JSON.stringify(args)} -> ${res.status} ${JSON.stringify(parsed)}`,
    );
  }
  return { status: res.status, text, parsed, id: resolved.id, page, args };
}

async function mustAction(name, jar, args) {
  const run = await callAction(name, jar, args);
  assert(
    run.status === 200,
    `action ${name} expected HTTP 200, got ${run.status}: ${run.text.slice(0, 240)}`,
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
      if (res.status >= 200 && res.status < 500) return;
      lastError = new Error(`GET /login -> ${res.status}`);
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

function createCustomer({ businessId, name, creditLimit }) {
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

/** Directly seeds a transaction (used where the scenario is not about createTransaction itself). */
function seedTransaction({
  businessId,
  customerId,
  sequenceNumber,
  amount,
  status = "unpaid",
  paymentStatus = "confirmed",
  createdById = null,
}) {
  return prisma.transaction.create({
    data: {
      businessId,
      customerId,
      period: PERIOD,
      sequenceNumber,
      amount,
      dueDate: new Date(DUE_STR),
      paymentStatus,
      status,
      createdById,
    },
  });
}

const txById = (id) => prisma.transaction.findUnique({ where: { id } });
const scoreHistoryCount = (customerId) =>
  prisma.scoreHistory.count({ where: { customerId } });

// ─────────────────────────────────────────────────────────────────────────────
// Visible-HTML helper
// ─────────────────────────────────────────────────────────────────────────────

/** Rendered VISIBLE text only: the RSC flight payload in <script> legitimately embeds props. */
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

const fmtTx = (tx) =>
  `paymentStatus=${tx?.paymentStatus} status=${tx?.status} createdById=${tx?.createdById} cancelledNote=${JSON.stringify(tx?.cancelledNote ?? null)}`;

async function main() {
  console.log(`TrustBon approval verification harness (run suffix: ${RUN})`);
  console.log(`  node ${process.version} · base ${BASE}`);

  await buildIfNeeded();
  server = startServer();
  await waitForServer(server);

  actionIndex = resolveActions();
  const resolution = ACTION_NAMES.map((name) => ({
    name,
    ...verifyAction(name, actionIndex),
  }));
  for (const r of resolution) {
    console.log(`· resolved ${r.name} -> id ${r.id} on ${r.page}`);
  }

  const realBefore = await prisma.user.findMany({
    where: { NOT: { email: { endsWith: E2E_SUFFIX } } },
    select: { id: true, email: true, name: true, role: true, status: true, businessId: true },
    orderBy: { id: "asc" },
  });
  const businessCountBefore = await prisma.business.count();
  const userCountBefore = await prisma.user.count();

  await preClean();

  // ── Seed ──────────────────────────────────────────────────────────────────
  fx.businessA = await createBusiness(`E2E Approval A ${RUN}`, `E2E-APR-A-${RUN}`);
  fx.businessB = await createBusiness(`E2E Approval B ${RUN}`, `E2E-APR-B-${RUN}`);

  fx.ownerA = await createUser({
    email: `owner.a.${RUN}${E2E_SUFFIX}`,
    name: `Owner A ${RUN}`,
    role: "owner",
    status: "active",
    businessId: fx.businessA.id,
  });
  fx.kasirA = await createUser({
    email: `kasir.a.${RUN}${E2E_SUFFIX}`,
    name: `Kasir A ${RUN}`,
    role: "cashier",
    status: "active",
    businessId: fx.businessA.id,
  });
  fx.ownerB = await createUser({
    email: `owner.b.${RUN}${E2E_SUFFIX}`,
    name: `Owner B ${RUN}`,
    role: "owner",
    status: "active",
    businessId: fx.businessB.id,
  });

  // Customers: two with a LOW limit for the over-limit cases, one with room.
  fx.cOver = await createCustomer({
    businessId: fx.businessA.id,
    name: `C Over ${RUN}`,
    creditLimit: 100000,
  });
  fx.cWithin = await createCustomer({
    businessId: fx.businessA.id,
    name: `C Within ${RUN}`,
    creditLimit: 1000000,
  });
  fx.cReject = await createCustomer({
    businessId: fx.businessA.id,
    name: `C Reject ${RUN}`,
    creditLimit: 100000,
  });

  // Pre-seeded pending transactions for the reject and IDOR scenarios.
  fx.txRejectH = await seedTransaction({
    businessId: fx.businessA.id,
    customerId: fx.cReject.id,
    sequenceNumber: 1,
    amount: 200000,
    paymentStatus: "need_approval",
    createdById: fx.kasirA.id,
  });
  fx.txIdor = await seedTransaction({
    businessId: fx.businessA.id,
    customerId: fx.cOver.id,
    sequenceNumber: 2,
    amount: 120000,
    paymentStatus: "need_approval",
    createdById: fx.kasirA.id,
  });

  // ── Scenarios (spec order a..k) ─────────────────────────────────────────────

  await scenario(
    1,
    "a. Cashier creates over-limit kasbon -> need_approval + createdById=cashier",
    async () => {
      const jar = await jarFor(fx.kasirA.email);
      const run = await mustAction("createTransaction", jar, [
        { customerId: fx.cOver.id, amount: 200000, dueDate: DUE_STR },
      ]);
      assertEq(run.parsed.ok, true, `ok:true expected (raw ${JSON.stringify(run.parsed)})`);
      assert(
        typeof run.parsed.transactionId === "number",
        `transactionId missing in response (raw ${JSON.stringify(run.parsed)})`,
      );
      fx.txPendA = await txById(run.parsed.transactionId);
      assertEq(fx.txPendA.paymentStatus, "need_approval", "paymentStatus");
      assertEq(fx.txPendA.createdById, fx.kasirA.id, "createdById");
      return `ok:true transactionId=${fx.txPendA.id} · ${fmtTx(fx.txPendA)} (cashier.id=${fx.kasirA.id})`;
    },
  );

  await scenario(
    2,
    "b. Owner creates within-limit kasbon -> confirmed + createdById=owner",
    async () => {
      const jar = await jarFor(fx.ownerA.email);
      const run = await mustAction("createTransaction", jar, [
        { customerId: fx.cWithin.id, amount: 100000, dueDate: DUE_STR },
      ]);
      assertEq(run.parsed.ok, true, `ok:true expected (raw ${JSON.stringify(run.parsed)})`);
      assert(
        typeof run.parsed.transactionId === "number",
        `transactionId missing in response (raw ${JSON.stringify(run.parsed)})`,
      );
      fx.txWithin = await txById(run.parsed.transactionId);
      assertEq(fx.txWithin.paymentStatus, "confirmed", "paymentStatus");
      assertEq(fx.txWithin.createdById, fx.ownerA.id, "createdById");
      return `ok:true transactionId=${fx.txWithin.id} · ${fmtTx(fx.txWithin)} (owner.id=${fx.ownerA.id})`;
    },
  );

  await scenario(
    3,
    "c. Owner GET /dashboard/approval -> pending kasbon listed with cashier name next to 'Diinput oleh'",
    async () => {
      const jar = await jarFor(fx.ownerA.email);
      const res = await getPage("/dashboard/approval", jar);
      assertEq(res.status, 200, "GET status");
      const text = visibleText(res.body);
      assert(
        text.includes(fx.cOver.name),
        `visible text does not list pending customer "${fx.cOver.name}"`,
      );
      assert(text.includes("Diinput oleh"), "visible text lacks 'Diinput oleh'");
      const re = new RegExp(`Diinput oleh\\s+${escapeRegExp(fx.kasirA.name)}`);
      const match = text.match(re);
      assert(
        match,
        `visible text lacks "${fx.kasirA.name}" right after 'Diinput oleh'`,
      );
      const window = text.slice(match.index, match.index + 90).replace(/\s+/g, " ");
      return `GET /dashboard/approval -> 200 · listed "${fx.cOver.name}" · visible="${window}"`;
    },
  );

  await scenario(
    4,
    "d. Cashier GET /dashboard/approval -> redirected away (owner-only)",
    async () => {
      const jar = await jarFor(fx.kasirA.email);
      const res = await getPage("/dashboard/approval", jar);
      assertEq(res.status, 307, "cashier approval GET must be a redirect (307)");
      assert(
        res.location && res.location.includes("/dashboard"),
        `redirect location should target /dashboard, got ${res.location}`,
      );
      assert(
        !res.location.includes("/login"),
        `cashier is authenticated; must not be sent to /login (got ${res.location})`,
      );
      assert(
        !res.body.includes("Diinput oleh"),
        "cashier received the rendered approval page body",
      );
      return `GET /dashboard/approval as cashier -> ${res.status} location=${res.location}`;
    },
  );

  await scenario(
    5,
    "e. Cashier approves pending tx -> {ok:false,error} + DB unchanged",
    async () => {
      const jar = await jarFor(fx.kasirA.email);
      const run = await mustAction("approveTransaction", jar, [
        { transactionId: fx.txPendA.id },
      ]);
      assertEq(run.parsed.ok, false, `ok:false expected (raw ${JSON.stringify(run.parsed)})`);
      assertEq(run.parsed.error, ERR.APPROVE_OWNER_ONLY, "error string");
      const after = await txById(fx.txPendA.id);
      assertEq(after.paymentStatus, "need_approval", "paymentStatus unchanged");
      return `ok:false error="${run.parsed.error}" · DB ${fmtTx(after)}`;
    },
  );

  await scenario(
    6,
    "f. Cashier rejects pending tx -> {ok:false,error} + DB unchanged",
    async () => {
      const jar = await jarFor(fx.kasirA.email);
      const run = await mustAction("rejectTransaction", jar, [
        { transactionId: fx.txPendA.id, note: "kasir mencoba menolak" },
      ]);
      assertEq(run.parsed.ok, false, `ok:false expected (raw ${JSON.stringify(run.parsed)})`);
      assertEq(run.parsed.error, ERR.REJECT_OWNER_ONLY, "error string");
      const after = await txById(fx.txPendA.id);
      assertEq(after.paymentStatus, "need_approval", "paymentStatus unchanged");
      return `ok:false error="${run.parsed.error}" · DB ${fmtTx(after)}`;
    },
  );

  await scenario(
    7,
    "g. Owner approves pending tx -> {ok:true}, confirmed/unpaid, cancelledNote=null",
    async () => {
      const jar = await jarFor(fx.ownerA.email);
      const run = await mustAction("approveTransaction", jar, [
        { transactionId: fx.txPendA.id },
      ]);
      assertEq(run.parsed.ok, true, `ok:true expected (raw ${JSON.stringify(run.parsed)})`);
      const after = await txById(fx.txPendA.id);
      assertEq(after.paymentStatus, "confirmed", "paymentStatus");
      assertEq(after.status, "unpaid", "status");
      assertEq(after.cancelledNote, null, "cancelledNote");
      return `ok:true · DB ${fmtTx(after)}`;
    },
  );

  await scenario(
    8,
    "h. Owner rejects WITHOUT a note -> {ok:false}, DB unchanged",
    async () => {
      const jar = await jarFor(fx.ownerA.email);
      const before = await txById(fx.txRejectH.id);
      const run = await mustAction("rejectTransaction", jar, [
        { transactionId: fx.txRejectH.id },
      ]);
      assertEq(run.parsed.ok, false, `ok:false expected (raw ${JSON.stringify(run.parsed)})`);
      assertEq(run.parsed.error, ERR.REJECT_NOTE, "error string");
      const after = await txById(fx.txRejectH.id);
      assertEq(after.paymentStatus, "need_approval", "paymentStatus unchanged");
      assertEq(after.cancelledNote, null, "cancelledNote unchanged");
      assertEq(
        after.paymentStatus,
        before.paymentStatus,
        "DB state identical before/after",
      );
      return `ok:false error="${run.parsed.error}" · DB ${fmtTx(after)}`;
    },
  );

  await scenario(
    9,
    "i. Owner rejects WITH a note -> {ok:true}, cancelled + note; scoring SKIPs (no confirmed history)",
    async () => {
      const jar = await jarFor(fx.ownerA.email);
      const note = `stok habis ${RUN}`;
      const pre = await prisma.customer.findUnique({
        where: { id: fx.cReject.id },
        select: { riskScore: true, trustStatus: true },
      });
      // Fixture precondition: createCustomer seeds 50/"unrated" and cReject's only
      // transaction is txRejectH (need_approval), which was never scored.
      assertEq(pre.riskScore, 50, "pre riskScore");
      assertEq(pre.trustStatus, "unrated", "pre trustStatus");
      const preCount = await scoreHistoryCount(fx.cReject.id);
      const run = await mustAction("rejectTransaction", jar, [
        { transactionId: fx.txRejectH.id, note },
      ]);
      assertEq(run.parsed.ok, true, `ok:true expected (raw ${JSON.stringify(run.parsed)})`);
      const after = await txById(fx.txRejectH.id);
      assertEq(after.paymentStatus, "cancelled", "paymentStatus");
      assertEq(after.cancelledNote, note, "cancelledNote equals the note");
      // Rejection is a scoring NO-OP. Step 1 counts only confirmed transactions,
      // and cancelling txRejectH leaves cReject with ZERO confirmed history, so
      // calculateRiskScore SKIPs: risk/trust stay put and no ScoreHistory row is added.
      const post = await prisma.customer.findUnique({
        where: { id: fx.cReject.id },
        select: { riskScore: true, trustStatus: true },
      });
      assertEq(post.riskScore, pre.riskScore, "riskScore unchanged after reject");
      assertEq(post.trustStatus, pre.trustStatus, "trustStatus unchanged after reject");
      const postCount = await scoreHistoryCount(fx.cReject.id);
      assertEq(postCount, preCount, "no new ScoreHistory row after reject");
      return `ok:true · DB ${fmtTx(after)} · riskScore ${pre.riskScore}->${post.riskScore} trustStatus ${pre.trustStatus}->${post.trustStatus} · scoreHistory ${preCount}->${postCount} (skip: zero confirmed history)`;
    },
  );

  await scenario(
    10,
    "j. IDOR: business-B owner approves/rejects business-A tx -> both {ok:false}, tx unchanged",
    async () => {
      const jar = await jarFor(fx.ownerB.email);
      const approve = await mustAction("approveTransaction", jar, [
        { transactionId: fx.txIdor.id },
      ]);
      assertEq(approve.parsed.ok, false, `approve ok:false (raw ${JSON.stringify(approve.parsed)})`);
      assertEq(approve.parsed.error, ERR.NOT_FOUND, "approve error");
      const reject = await mustAction("rejectTransaction", jar, [
        { transactionId: fx.txIdor.id, note: "idor" },
      ]);
      assertEq(reject.parsed.ok, false, `reject ok:false (raw ${JSON.stringify(reject.parsed)})`);
      assertEq(reject.parsed.error, ERR.NOT_FOUND, "reject error");
      const after = await txById(fx.txIdor.id);
      assertEq(after.paymentStatus, "need_approval", "paymentStatus unchanged");
      assertEq(after.cancelledNote, null, "cancelledNote unchanged");
      return `approve ok:false error="${approve.parsed.error}" · reject ok:false error="${reject.parsed.error}" · DB ${fmtTx(after)}`;
    },
  );

  await scenario(
    11,
    "k. Approve an already-confirmed tx -> {ok:false} + DB unchanged",
    async () => {
      const jar = await jarFor(fx.ownerA.email);
      const before = await txById(fx.txWithin.id);
      assertEq(before.paymentStatus, "confirmed", "precondition: tx is confirmed");
      const run = await mustAction("approveTransaction", jar, [
        { transactionId: fx.txWithin.id },
      ]);
      assertEq(run.parsed.ok, false, `ok:false expected (raw ${JSON.stringify(run.parsed)})`);
      assertEq(run.parsed.error, ERR.NOT_PENDING, "error string");
      const after = await txById(fx.txWithin.id);
      assertEq(after.paymentStatus, "confirmed", "paymentStatus unchanged");
      assertEq(after.cancelledNote, null, "cancelledNote unchanged");
      return `ok:false error="${run.parsed.error}" · DB ${fmtTx(after)}`;
    },
  );

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
  console.log(`\nexit code ${failed ? 1 : 0}`);
  await prisma.$disconnect().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(failed ? 1 : 0);
}
