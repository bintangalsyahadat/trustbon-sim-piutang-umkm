#!/usr/bin/env node
/**
 * End-to-end authorization verification harness for TrustBon (sim-piutang-umkm).
 *
 * What it does
 * ------------
 *  1. Builds the app (`bun run build`) unless SKIP_BUILD=1 and `.next/BUILD_ID` exists.
 *  2. Starts `next start` on port 3100 (`bun run start -- -p 3100`) and stops it again.
 *  3. Resolves server-action ids from the BUILT CLIENT CHUNKS
 *     (`createServerReference("<id>", ..., "<exportedName>")`) and cross-checks the
 *     authoritative `.next/server/server-reference-manifest.json`.
 *  4. Seeds an isolated fixture set (every email ends in `@e2e.test`) directly via Prisma.
 *  5. Drives the real HTTP surface: real NextAuth login (CSRF + credentials callback),
 *     a cookie jar, `redirect: "manual"`, real server-action POSTs carrying the
 *     `Next-Action` id and a payload produced by React's own `encodeReply`, and real
 *     page GETs.
 *  6. Proves every action really executed by asserting DATABASE STATE, never by a 200.
 *  7. Cleans the fixtures up in a `finally` block and verifies the pre-existing real rows
 *     were never touched.
 *
 * Usage:
 *   node scripts/verify-authz.mjs
 *   SKIP_BUILD=1 node scripts/verify-authz.mjs   # reuse an existing .next build
 *   E2E_DEBUG=1  node scripts/verify-authz.mjs   # verbose request/action logging
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
const NEW_PASSWORD = "E2e-Passw0rd-New!";
const DEBUG = process.env.E2E_DEBUG === "1";

// Verbatim createCustomer guard/validation error strings (app/actions/customers.js).
const CUSTOMER_ERR = {
  NOT_OWNER: "Hanya pemilik bisnis yang dapat melakukan tindakan ini.",
  NAME: "Nama pelanggan wajib diisi (maksimal 100 karakter).",
  PHONE: "Nomor HP tidak valid. Gunakan 9–16 digit angka.",
  LIMIT: "Limit kredit tidak valid.",
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
  // "app/dashboard/bisnis/page" -> "/dashboard/bisnis"
  let p = workerKey.replace(/^app/, "");
  p = p.replace(/\/page$/, "");
  return p === "" ? "/" : p;
}

/**
 * Reads the action ids straight out of the built client chunks. The minified call
 * looks like:
 *   (0,n.createServerReference)("<id>",n.callServer,void 0,n.findSourceMapURL,"<name>")
 * so the exported name is recoverable without guessing.
 */
function scanChunkServerReferences() {
  const map = new Map(); // id -> exportedName
  // Turbopack emits the minified helper as `(0,n.createServerReference)("<id>", ..., "<name>")`,
  // so allow the extra `)` between the name and the opening paren.
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

const htmlBodies = []; // { path, body } for 200 HTML responses (used by the "no raw ids" scenario)

async function getPage(pathname, jar) {
  const res = await fetch(BASE + pathname, {
    redirect: "manual",
    headers: jar ? { cookie: jar.header() } : {},
  });
  const body = await res.text();
  if (res.status === 200) {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      htmlBodies.push({ path: pathname, body });
    }
  }
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

/**
 * Asserts that an owner-only route redirects an active cashier away (the pattern
 * already used for /dashboard/bisnis) and returns the observed `status location`
 * for the scenario report. Callers pass the cashier's cookie jar.
 */
async function assertCashierRedirected(pathname, cashierJar, label) {
  const res = await getPage(pathname, cashierJar);
  assert(
    res.status >= 300 && res.status < 400,
    `${label}: cashier GET ${pathname} expected redirect, got ${res.status}`,
  );
  assert(
    (res.location || "").includes("/dashboard"),
    `${label}: cashier GET ${pathname} redirected to ${res.location}`,
  );
  return `${pathname} -> ${res.status} ${res.location}`;
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
  const customerIdMatch = text.match(/"customerId":\s*(\d+)/);
  if (customerIdMatch) out.customerId = Number(customerIdMatch[1]);
  out.reauthRequired = /"reauthRequired":\s*(true|!0)/.test(text);
  return out;
}

/**
 * Invokes a server action exactly the way the browser does: POST to the page that
 * registers it, with the `Next-Action` id header, the session cookies, a same-origin
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
  // Business has no cascade: clear its descendants before the business rows.
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

// ─────────────────────────────────────────────────────────────────────────────
// Visible-text extraction (for the "no raw ids" assertion)
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

/** Removes dates, times, percentages, currency and "N menunggu" badges so a count
 *  or date can never be mistaken for a leaked database id. */
function stripNonIdNumbers(text) {
  return text
    .replace(/\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/g, " ")
    .replace(/\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g, " ")
    .replace(/\b\d{1,2}[:.]\d{2}\b/g, " ")
    .replace(/\b\d+\s*%/g, " ")
    .replace(/Rp\s?[\d.,]+/g, " ")
    .replace(/\b\d+\s+menunggu\b/gi, " ");
}

/** Counts non-overlapping matches of a global regex in a string. */
function countMatches(html, re) {
  return (html.match(re) || []).length;
}

/** Returns every `class="..."` attribute value that contains ALL the given substrings.
 *  Attribute-order and whitespace agnostic: callers pass plain class substrings. */
function classAttributesWith(html, ...needles) {
  const values = [];
  const re = /class="([^"]*)"/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    if (needles.every((needle) => match[1].includes(needle))) values.push(match[1]);
  }
  return values;
}

/** Extracts the collapsed visible text of the first `<tag ...>…</tag>` element. */
function firstElementText(html, tag) {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(html);
  if (!match) return null;
  return match[1]
    .replace(/<[^>]+>/g, " ")
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

async function main() {
  console.log(`TrustBon authz verification harness`);
  console.log(`  node ${process.version} · base ${BASE}`);

  await buildIfNeeded();
  server = startServer();
  await waitForServer(server);

  actionIndex = resolveActions();

  // Capture the pre-existing real rows so we can prove we never touched them.
  const realBefore = await prisma.user.findMany({
    where: { NOT: { email: { endsWith: E2E_SUFFIX } } },
    select: { id: true, email: true, name: true, role: true, status: true, businessId: true },
    orderBy: { id: "asc" },
  });
  const businessCountBefore = await prisma.business.count();
  const userCountBefore = await prisma.user.count();

  // Prove the ids we are about to drive came from the client chunks, not a guess.
  const requiredActions = [
    "approveMember",
    "rejectMember",
    "resubmitJoinAsCashier",
    "convertToOwnerBusiness",
    "updateUserProfile",
    "changePassword",
    "updateBusinessProfile",
    "regenerateInviteCode",
    "markNotificationsRead",
    "markNotificationRead",
    "removeMember",
    "createCustomer",
  ];
  const resolution = requiredActions.map((name) => ({
    name,
    ...verifyAction(name, actionIndex),
  }));

  await preClean();

  // ── 1. Seed fixtures ──────────────────────────────────────────────────────
  await scenario(1, "Seed fixtures (isolated @e2e.test data)", async () => {
    fx.businessA = await createBusiness("E2E Business A", "E2E-A-INVITE");
    fx.businessB = await createBusiness("E2E Business B", "E2E-B-INVITE");

    fx.ownerA = await createUser({
      email: "owner.a@e2e.test",
      name: "Owner A",
      role: "owner",
      status: "active",
      businessId: fx.businessA.id,
    });
    fx.ownerB = await createUser({
      email: "owner.b@e2e.test",
      name: "Owner B",
      role: "owner",
      status: "active",
      businessId: fx.businessB.id,
    });
    fx.activeA1 = await createUser({
      email: "active.a1@e2e.test",
      name: "Active A1",
      role: "cashier",
      status: "active",
      businessId: fx.businessA.id,
    });
    fx.pendingA1 = await createUser({
      email: "pending.a1@e2e.test",
      name: "Pending A1",
      role: "cashier",
      status: "pending",
      businessId: fx.businessA.id,
    });
    fx.pendingA2 = await createUser({
      email: "pending.a2@e2e.test",
      name: "Pending A2",
      role: "cashier",
      status: "pending",
      businessId: fx.businessA.id,
    });
    fx.pendingB1 = await createUser({
      email: "pending.b1@e2e.test",
      name: "Pending B1",
      role: "cashier",
      status: "pending",
      businessId: fx.businessB.id,
    });
    fx.rejectedA1 = await createUser({
      email: "rejected.a1@e2e.test",
      name: "Rejected A1",
      role: "cashier",
      status: "rejected",
      businessId: fx.businessA.id,
    });
    // Second active cashier in business A: the non-owner actor for the
    // removeMember role-gate test (activeA1 gets removed, so it cannot serve).
    fx.activeA2 = await createUser({
      email: "active.a2@e2e.test",
      name: "Active A2",
      role: "cashier",
      status: "active",
      businessId: fx.businessA.id,
    });
    // Second owner in business A: the "cannot remove another owner" target.
    fx.ownerA2 = await createUser({
      email: "owner.a2@e2e.test",
      name: "Owner A2",
      role: "owner",
      status: "active",
      businessId: fx.businessA.id,
    });
    // Active cashier in business B: the cross-business IDOR target.
    fx.activeB1 = await createUser({
      email: "active.b1@e2e.test",
      name: "Active B1",
      role: "cashier",
      status: "active",
      businessId: fx.businessB.id,
    });

    // Unread notification for ownerA (gives markNotificationsRead real work).
    fx.ownerANotif = await prisma.notification.create({
      data: {
        userId: fx.ownerA.id,
        type: "join_request",
        title: "Permintaan bergabung",
        body: fx.pendingA1.email,
        href: "/dashboard/bisnis",
      },
    });
    // Stale unread join_request for ownerB about pendingB1 (scenario 11 must delete it).
    fx.ownerBStaleNotif = await prisma.notification.create({
      data: {
        userId: fx.ownerB.id,
        type: "join_request",
        title: "Permintaan bergabung",
        body: fx.pendingB1.email,
        href: "/dashboard/bisnis",
      },
    });
    // A notification owned by someone else (pendingB1) for the cross-user test.
    fx.foreignNotif = await prisma.notification.create({
      data: {
        userId: fx.pendingB1.id,
        type: "join_approved",
        title: "Notifikasi milik orang lain",
        body: "jangan sentuh",
      },
    });

    const realAfter = await prisma.user.findMany({
      where: { NOT: { email: { endsWith: E2E_SUFFIX } } },
      select: { id: true, email: true },
      orderBy: { id: "asc" },
    });
    assertEq(
      realAfter.length,
      realBefore.length,
      "pre-existing real users changed during seeding",
    );

    // Fixture passwords really verify.
    const stored = await prisma.user.findUnique({
      where: { id: fx.ownerA.id },
      select: { password: true },
    });
    assert(
      await bcrypt.compare(PASSWORD, stored.password),
      "fixture password hash does not verify",
    );

    return (
      `businesses A#${fx.businessA.id} B#${fx.businessB.id}; ` +
      `users ownerA#${fx.ownerA.id} ownerB#${fx.ownerB.id} activeA1#${fx.activeA1.id} ` +
      `activeA2#${fx.activeA2.id} ownerA2#${fx.ownerA2.id} activeB1#${fx.activeB1.id} ` +
      `pendingA1#${fx.pendingA1.id} pendingA2#${fx.pendingA2.id} pendingB1#${fx.pendingB1.id} ` +
      `rejectedA1#${fx.rejectedA1.id}; pre-existing real users: ${realBefore.length}`
    );
  });

  // ── 2. Signed-out / pending gating ────────────────────────────────────────
  await scenario(2, "Signed-out + pending gating", async () => {
    const anon = new CookieJar();
    const dashboard = await getPage("/dashboard", anon);
    assert(
      dashboard.status >= 300 && dashboard.status < 400,
      `signed-out /dashboard expected redirect, got ${dashboard.status}`,
    );
    assert(
      (dashboard.location || "").includes("/login"),
      `signed-out /dashboard redirected to ${dashboard.location}`,
    );

    const pendingJar = await jarFor(fx.pendingA1.email); // SAME jar reused in scenario 8
    const waiting = await getPage("/dashboard", pendingJar);
    assert(
      waiting.status >= 300 && waiting.status < 400,
      `pending /dashboard expected redirect, got ${waiting.status}`,
    );
    assert(
      (waiting.location || "").includes("/menunggu-persetujuan"),
      `pending /dashboard redirected to ${waiting.location}`,
    );

    const waitingPage = await getPage("/menunggu-persetujuan", pendingJar);
    assertEq(waitingPage.status, 200, "pending /menunggu-persetujuan");
    assert(
      waitingPage.body.includes(fx.businessA.name),
      `waiting room does not mention "${fx.businessA.name}"`,
    );
    assert(
      /menunggu/i.test(waitingPage.body),
      "waiting room has no pending wording",
    );

    return `anon /dashboard -> ${dashboard.status} ${dashboard.location}; pending /dashboard -> ${waiting.status} ${waiting.location}; waiting room 200`;
  });

  // ── 3. Owner-only role gates ──────────────────────────────────────────────
  await scenario(3, "Owner-only /dashboard/bisnis redirects cashiers, allows owners", async () => {
    const cashier = await jarFor(fx.activeA1.email);
    const owner = await jarFor(fx.ownerA.email);

    // Member management (pending join requests + active member list + remove)
    // now lives on /dashboard/bisnis (owner-only). The old /dashboard/anggota
    // route has been deleted and is no longer exercised.
    const redirected = await assertCashierRedirected(
      "/dashboard/bisnis",
      cashier,
      "bisnis",
    );

    const ownerBisnis = await getPage("/dashboard/bisnis", owner);
    assertEq(ownerBisnis.status, 200, "owner /dashboard/bisnis");

    return `${redirected}; owner bisnis -> 200`;
  });

  // ── 4. Owner reads everything ─────────────────────────────────────────────
  await scenario(4, "Owner gets 200 on dashboard, bisnis, notifikasi, profil", async () => {
    const owner = await jarFor(fx.ownerA.email);
    const pages = [
      "/dashboard",
      "/dashboard/bisnis",
      "/dashboard/notifikasi",
      "/dashboard/profil",
    ];
    const statuses = {};
    for (const page of pages) {
      const res = await getPage(page, owner);
      assertEq(res.status, 200, `owner GET ${page}`);
      statuses[page] = res.status;
    }
    return JSON.stringify(statuses);
  });

  // ── 5. Member list business scoping ───────────────────────────────────────
  await scenario(5, "Member list on /dashboard/bisnis is business-scoped", async () => {
    const ownerA = await jarFor(fx.ownerA.email);
    const ownerB = await jarFor(fx.ownerB.email);

    const bisnisA = await getPage("/dashboard/bisnis", ownerA);
    const bisnisB = await getPage("/dashboard/bisnis", ownerB);
    assertEq(bisnisA.status, 200, "ownerA /dashboard/bisnis");
    assertEq(bisnisB.status, 200, "ownerB /dashboard/bisnis");

    assert(
      bisnisA.body.includes(fx.pendingA1.email),
      "ownerA /dashboard/bisnis does not show pendingA1 (own business)",
    );
    assert(
      !bisnisA.body.includes(fx.pendingB1.email),
      "ownerA /dashboard/bisnis leaks pendingB1 (other business)",
    );
    assert(
      bisnisB.body.includes(fx.pendingB1.email),
      "ownerB /dashboard/bisnis does not show pendingB1 (own business)",
    );
    assert(
      !bisnisB.body.includes(fx.pendingA1.email),
      "ownerB /dashboard/bisnis leaks pendingA1 (other business)",
    );

    return "ownerA sees pendingA1 only; ownerB sees pendingB1 only";
  });

  // ── 6. No raw database ids in the UI ──────────────────────────────────────
  await scenario(6, 'No "ID Bisnis", no bare numeric DB id, and the mobile nav drawer stays SSR-null', async () => {
    const listPaths = new Set(["/dashboard/bisnis", "/dashboard"]);
    const listBodies = htmlBodies.filter((b) => listPaths.has(b.path));
    assert(listBodies.length > 0, "no list pages were collected");

    const ids = [
      ["businessA", fx.businessA.id],
      ["businessB", fx.businessB.id],
      ["ownerA", fx.ownerA.id],
      ["ownerB", fx.ownerB.id],
      ["activeA1", fx.activeA1.id],
      ["pendingA1", fx.pendingA1.id],
      ["pendingA2", fx.pendingA2.id],
      ["pendingB1", fx.pendingB1.id],
      ["rejectedA1", fx.rejectedA1.id],
    ];

    // Hard, low-false-positive check on VISIBLE text across every HTML body. The raw
    // HTML necessarily embeds the RSC flight payload (ids and field names are passed
    // to the client components), so only text a user can actually read is a leak.
    for (const { path: p, body } of htmlBodies) {
      const text = visibleText(body);
      assert(!/ID\s*Bisnis/i.test(text), `${p} renders the literal "ID Bisnis"`);
      assert(
        !/\b(businessId|userId)\b/i.test(text),
        `${p} renders a raw id field name`,
      );
    }

    // The reworked /dashboard/profil must be covered too, not just the list pages.
    const profilBody = htmlBodies.find((b) => b.path === "/dashboard/profil");
    assert(profilBody, "no /dashboard/profil HTML was collected for the raw-id check");
    assert(
      !/ID\s*Bisnis/i.test(visibleText(profilBody.body)),
      '/dashboard/profil renders the literal "ID Bisnis"',
    );

    // Bare numeric id check on the list pages only, with dates/counts stripped.
    for (const { path: p, body } of listBodies) {
      const text = stripNonIdNumbers(visibleText(body));
      for (const [label, id] of ids) {
        const re = new RegExp(`(^|[^0-9])${id}([^0-9]|$)`);
        const m = re.exec(text);
        assert(
          !m,
          `${p} renders bare DB id ${id} (${label}) in visible text near ` +
            `"${text.slice(Math.max(0, m ? m.index - 40 : 0), (m ? m.index : 0) + 40)}"`,
        );
      }
    }

    // Shell-structure regression (drawer containing-block bug): the mobile nav drawer is
    // rendered inside `TopBar`'s `backdrop-blur-xl` header, and a backdrop-filter turns
    // that header into the containing block for `position: fixed` descendants. If the
    // drawer is server-rendered, its `fixed inset-y-0 left-0` resolves against the
    // 64px header and mobile users only see its Brand strip. The drawer must therefore
    // be portal-mounted to document.body only after mount (`getServerSnapshot` -> false).
    // Lock that in: every collected dashboard page ships the hamburger trigger but never
    // the drawer's dialog markup or its off-canvas transform class.
    const dashboardBodies = htmlBodies.filter((b) => b.path.startsWith("/dashboard"));
    for (const route of [
      "/dashboard",
      "/dashboard/bisnis",
      "/dashboard/notifikasi",
      "/dashboard/profil",
    ]) {
      assert(
        dashboardBodies.some((b) => b.path === route),
        `no collected dashboard HTML for ${route}; the drawer guard would silently skip it`,
      );
    }

    let hamburgerTriggers = 0;
    for (const { path: p, body } of dashboardBodies) {
      hamburgerTriggers += countMatches(body, /aria-label="Buka menu"/g);
      assert(
        body.includes('aria-label="Buka menu"'),
        `${p} lost the SSR hamburger trigger aria-label="Buka menu"`,
      );
      assert(
        !body.includes('aria-label="Menu navigasi"'),
        `${p} SSR-renders the mobile drawer (aria-label="Menu navigasi"); ` +
          "it must be portal-mounted only after client mount",
      );
      assert(
        !body.includes("-translate-x-full"),
        `${p} SSR-renders the drawer's off-canvas class "-translate-x-full"; ` +
          "the drawer must not resolve position:fixed against the backdrop-blur header",
      );
    }

    return (
      `${htmlBodies.length} HTML bodies checked; ${listBodies.length} list bodies checked for bare ids; ` +
      `drawer guard: ${dashboardBodies.length} dashboard bodies, ${hamburgerTriggers} SSR hamburger trigger(s), 0 SSR drawers`
    );
  });

  // ── 7. Owner approves pending member + notification ───────────────────────
  await scenario(7, "approveMember(pendingA1) flips status + emits join_approved", async () => {
    const owner = await jarFor(fx.ownerA.email);
    const before = await prisma.user.findUnique({
      where: { id: fx.pendingA1.id },
      select: { status: true },
    });
    assertEq(before.status, "pending", "pendingA1 status before approve");

    const run = await mustAction(owner, "approveMember", [fx.pendingA1.id]);
    assert(run.parsed.ok === true, `approveMember returned ${JSON.stringify(run.parsed)}`);

    const after = await prisma.user.findUnique({
      where: { id: fx.pendingA1.id },
      select: { status: true },
    });
    assertEq(after.status, "active", "pendingA1 status after approve");

    const notif = await prisma.notification.findFirst({
      where: { userId: fx.pendingA1.id, type: "join_approved" },
    });
    assert(notif, "no join_approved notification created for pendingA1");

    return `action id ${run.id} on ${run.page} -> pendingA1 active + join_approved notification`;
  });

  // ── 8. Stale-session regression ───────────────────────────────────────────
  await scenario(8, "Stale JWT status cannot keep an approved member out of /dashboard", async () => {
    // Reuse the SAME cookie jar created in scenario 2 (JWT still says "pending").
    const staleJar = jars.get(fx.pendingA1.email);
    assert(staleJar, "scenario 2 cookie jar for pendingA1 is missing");

    const dbStatus = await prisma.user.findUnique({
      where: { id: fx.pendingA1.id },
      select: { status: true },
    });
    assertEq(dbStatus.status, "active", "pendingA1 must be active in the DB for this test");

    const dashboard = await getPage("/dashboard", staleJar);
    assertEq(
      dashboard.status,
      200,
      "approved member with a stale pending JWT was blocked from /dashboard",
    );

    return "same pre-approval JWT session now gets /dashboard 200 (DB-authoritative)";
  });

  // ── 9. Cross-business IDOR + role gate on review ──────────────────────────
  await scenario(9, "approveMember cannot cross businesses and cashiers cannot review", async () => {
    const ownerA = await jarFor(fx.ownerA.email);
    const cashier = await jarFor(fx.activeA1.email);

    await mustAction(ownerA, "approveMember", [fx.pendingB1.id]);
    const b1 = await prisma.user.findUnique({
      where: { id: fx.pendingB1.id },
      select: { status: true, businessId: true },
    });
    assertEq(b1.status, "pending", "ownerA IDOR changed pendingB1 status");
    assertEq(b1.businessId, fx.businessB.id, "ownerA IDOR moved pendingB1");

    await mustAction(cashier, "approveMember", [fx.pendingA2.id]);
    const a2 = await prisma.user.findUnique({
      where: { id: fx.pendingA2.id },
      select: { status: true },
    });
    assertEq(a2.status, "pending", "cashier approveMember changed pendingA2 status");

    return "ownerA could not touch pendingB1; cashier could not approve pendingA2";
  });

  // ── 10. Owner rejects pending member + notification ───────────────────────
  await scenario(10, "rejectMember(pendingB1) flips status + emits join_rejected", async () => {
    const ownerB = await jarFor(fx.ownerB.email);
    const run = await mustAction(ownerB, "rejectMember", [fx.pendingB1.id]);
    assert(run.parsed.ok === true, `rejectMember returned ${JSON.stringify(run.parsed)}`);

    const after = await prisma.user.findUnique({
      where: { id: fx.pendingB1.id },
      select: { status: true },
    });
    assertEq(after.status, "rejected", "pendingB1 status after reject");

    const notif = await prisma.notification.findFirst({
      where: { userId: fx.pendingB1.id, type: "join_rejected" },
    });
    assert(notif, "no join_rejected notification created for pendingB1");

    return `action id ${run.id} on ${run.page} -> pendingB1 rejected + join_rejected notification`;
  });

  // ── 11. Re-submit join as cashier ─────────────────────────────────────────
  await scenario(11, "resubmitJoinAsCashier moves the user + clears stale owner pings", async () => {
    const pendingJar = await jarFor(fx.pendingB1.email);
    const run = await mustAction(pendingJar, "resubmitJoinAsCashier", [
      { inviteCode: fx.businessA.inviteCode },
    ]);
    assert(run.parsed.ok === true, `resubmitJoinAsCashier returned ${JSON.stringify(run.parsed)}`);

    const moved = await prisma.user.findUnique({
      where: { id: fx.pendingB1.id },
      select: { businessId: true, role: true, status: true },
    });
    assertEq(moved.businessId, fx.businessA.id, "pendingB1 businessId after resubmit");
    assertEq(moved.role, "cashier", "pendingB1 role after resubmit");
    assertEq(moved.status, "pending", "pendingB1 status after resubmit");

    const ownerA = await jarFor(fx.ownerA.email);
    const ownerB = await jarFor(fx.ownerB.email);
    const bisnisA = await getPage("/dashboard/bisnis", ownerA);
    const bisnisB = await getPage("/dashboard/bisnis", ownerB);
    assert(
      bisnisA.body.includes(fx.pendingB1.email),
      "ownerA /dashboard/bisnis does not show newly joined pendingB1",
    );
    assert(
      !bisnisB.body.includes(fx.pendingB1.email),
      "ownerB /dashboard/bisnis still shows pendingB1 after they left",
    );

    const stale = await prisma.notification.findUnique({
      where: { id: fx.ownerBStaleNotif.id },
      select: { readAt: true },
    });
    assert(
      stale === null || stale.readAt !== null,
      "ownerB's stale unread join_request about pendingB1 was not cleared",
    );

    const freshPing = await prisma.notification.findFirst({
      where: {
        userId: fx.ownerA.id,
        type: "join_request",
        body: fx.pendingB1.email,
        readAt: null,
      },
    });
    assert(freshPing, "ownerA did not receive a join_request for the new applicant");

    return `action id ${run.id} on ${run.page} -> pendingB1 now in A; ownerA lists them, ownerB does not; stale ownerB ping cleared`;
  });

  // ── 12. Convert pending user into a business owner ────────────────────────
  await scenario(12, "convertToOwnerBusiness creates a business and activates the user", async () => {
    const pendingJar = await jarFor(fx.pendingB1.email);
    const run = await mustAction(pendingJar, "convertToOwnerBusiness", [
      {
        name: "E2E Converted Co",
        ownerName: "Pending B1",
        ownerPhoneNumber: "0812333444",
      },
    ]);
    assert(run.parsed.ok === true, `convertToOwnerBusiness returned ${JSON.stringify(run.parsed)}`);

    const user = await prisma.user.findUnique({
      where: { id: fx.pendingB1.id },
      select: { role: true, status: true, businessId: true },
    });
    assertEq(user.role, "owner", "converted user role");
    assertEq(user.status, "active", "converted user status");
    assert(
      user.businessId !== fx.businessA.id,
      "converted user stayed in business A instead of a new business",
    );

    const business = await prisma.business.findUnique({
      where: { id: user.businessId },
      select: { name: true, inviteCode: true },
    });
    assert(business, "converted user has no business row");
    assertEq(business.name, "E2E Converted Co", "new business name");
    assert(business.inviteCode, "new business has no invite code");

    fx.convertedBusinessId = user.businessId;

    return `action id ${run.id} on ${run.page} -> user owner/active in new business #${user.businessId} (${business.inviteCode})`;
  });

  // ── 13. Profile update + reauth ───────────────────────────────────────────
  await scenario(13, "updateUserProfile updates name; email change needs the password", async () => {
    const owner = await jarFor(fx.ownerA.email);

    const nameOnly = await mustAction(owner, "updateUserProfile", [
      { name: "Owner A Renamed", email: fx.ownerA.email, currentPassword: "" },
    ]);
    assert(nameOnly.parsed.ok === true, `name-only update returned ${JSON.stringify(nameOnly.parsed)}`);
    assert(
      nameOnly.parsed.reauthRequired === false,
      "changing only the name reported reauthRequired",
    );
    const afterName = await prisma.user.findUnique({
      where: { id: fx.ownerA.id },
      select: { name: true, email: true },
    });
    assertEq(afterName.name, "Owner A Renamed", "name after profile update");
    assertEq(afterName.email, fx.ownerA.email, "email changed on a name-only update");

    const wrong = await mustAction(owner, "updateUserProfile", [
      {
        name: "Owner A Renamed",
        email: "owner.a.changed@e2e.test",
        currentPassword: "definitely-wrong",
      },
    ]);
    assert(wrong.parsed.ok === false, "email change accepted a wrong password");
    const afterWrong = await prisma.user.findUnique({
      where: { id: fx.ownerA.id },
      select: { email: true },
    });
    assertEq(afterWrong.email, fx.ownerA.email, "email changed despite a wrong password");

    const right = await mustAction(owner, "updateUserProfile", [
      {
        name: "Owner A Renamed",
        email: "owner.a.changed@e2e.test",
        currentPassword: PASSWORD,
      },
    ]);
    assert(right.parsed.ok === true, `email change returned ${JSON.stringify(right.parsed)}`);
    assert(
      right.parsed.reauthRequired === true,
      "changing the email did not return reauthRequired",
    );
    const afterRight = await prisma.user.findUnique({
      where: { id: fx.ownerA.id },
      select: { email: true },
    });
    assertEq(afterRight.email, "owner.a.changed@e2e.test", "email after correct password");
    fx.ownerA.email = "owner.a.changed@e2e.test";

    return "name update applied; wrong password refused; correct password changed email + reauthRequired";
  });

  // ── 14. Password change ───────────────────────────────────────────────────
  await scenario(14, "changePassword verifies the old password and hashes the new one", async () => {
    const owner = await jarFor(fx.ownerA.email);

    const wrong = await mustAction(owner, "changePassword", [
      { currentPassword: "definitely-wrong", newPassword: NEW_PASSWORD },
    ]);
    assert(wrong.parsed.ok === false, "changePassword accepted a wrong old password");
    const unchanged = await prisma.user.findUnique({
      where: { id: fx.ownerA.id },
      select: { password: true },
    });
    assert(
      await bcrypt.compare(PASSWORD, unchanged.password),
      "password changed despite a wrong old password",
    );

    const right = await mustAction(owner, "changePassword", [
      { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
    ]);
    assert(right.parsed.ok === true, `changePassword returned ${JSON.stringify(right.parsed)}`);
    const changed = await prisma.user.findUnique({
      where: { id: fx.ownerA.id },
      select: { password: true },
    });
    assert(
      await bcrypt.compare(NEW_PASSWORD, changed.password),
      "new password does not verify against the stored hash",
    );
    assert(
      !(await bcrypt.compare(PASSWORD, changed.password)),
      "old password still verifies after the change",
    );

    return "wrong old password refused; correct old password rotated the hash to the new password";
  });

  // ── 15. Business profile owner gate ───────────────────────────────────────
  await scenario(15, "updateBusinessProfile is owner-only and applies for the owner", async () => {
    const cashier = await jarFor(fx.activeA1.email);
    const owner = await jarFor(fx.ownerA.email);

    const refused = await mustAction(cashier, "updateBusinessProfile", [
      { name: "Hacked By Cashier", ownerName: "Cashier", ownerPhoneNumber: "0800" },
    ]);
    assert(refused.parsed.ok === false, "cashier updateBusinessProfile was accepted");
    const untouched = await prisma.business.findUnique({
      where: { id: fx.businessA.id },
      select: { name: true },
    });
    assertEq(untouched.name, fx.businessA.name, "cashier changed the business name");

    const applied = await mustAction(owner, "updateBusinessProfile", [
      { name: "E2E Business A Renamed", ownerName: "Owner A Renamed", ownerPhoneNumber: "0812999888" },
    ]);
    assert(applied.parsed.ok === true, `owner updateBusinessProfile returned ${JSON.stringify(applied.parsed)}`);
    const updated = await prisma.business.findUnique({
      where: { id: fx.businessA.id },
      select: { name: true, ownerName: true, ownerPhoneNumber: true },
    });
    assertEq(updated.name, "E2E Business A Renamed", "business name after owner update");
    assertEq(updated.ownerName, "Owner A Renamed", "business ownerName after owner update");
    assertEq(updated.ownerPhoneNumber, "0812999888", "business phone after owner update");

    fx.businessA.name = "E2E Business A Renamed";

    return "cashier refused and business unchanged; owner applied name/owner/phone";
  });

  // ── 16. Regenerate invite code ────────────────────────────────────────────
  await scenario(16, "regenerateInviteCode changes the owner's code in the DB", async () => {
    const owner = await jarFor(fx.ownerA.email);
    const before = await prisma.business.findUnique({
      where: { id: fx.businessA.id },
      select: { inviteCode: true },
    });

    const run = await mustAction(owner, "regenerateInviteCode", []);
    assert(run.parsed.ok === true, `regenerateInviteCode returned ${JSON.stringify(run.parsed)}`);

    const after = await prisma.business.findUnique({
      where: { id: fx.businessA.id },
      select: { inviteCode: true },
    });
    assert(after.inviteCode, "business has no invite code after regeneration");
    assert(
      after.inviteCode !== before.inviteCode,
      `invite code did not change (still ${after.inviteCode})`,
    );

    return `invite code ${before.inviteCode} -> ${after.inviteCode}`;
  });

  // ── 17. Notification ownership ────────────────────────────────────────────
  await scenario(17, "Notifications are scoped to the signed-in user", async () => {
    const owner = await jarFor(fx.ownerA.email);

    const unreadBefore = await prisma.notification.count({
      where: { userId: fx.ownerA.id, readAt: null },
    });
    assert(unreadBefore > 0, "ownerA had no unread notifications to mark");

    const run = await mustAction(owner, "markNotificationsRead", []);
    assert(run.parsed.ok === true, `markNotificationsRead returned ${JSON.stringify(run.parsed)}`);

    const unreadAfter = await prisma.notification.count({
      where: { userId: fx.ownerA.id, readAt: null },
    });
    assertEq(unreadAfter, 0, "ownerA still has unread notifications after markNotificationsRead");

    // pendingB1's own notification must be untouched by ownerA's mark-all.
    const foreignAfter = await prisma.notification.findUnique({
      where: { id: fx.foreignNotif.id },
      select: { userId: true, readAt: true },
    });
    assert(foreignAfter, "foreign notification disappeared");
    assertEq(foreignAfter.readAt, null, "markNotificationsRead touched another user's row");

    // A single-id call for someone else's notification must also be a no-op.
    const one = await mustAction(owner, "markNotificationRead", [fx.foreignNotif.id]);
    assertEq(one.status, 200, "markNotificationRead(other) HTTP status");
    const foreignAfterOne = await prisma.notification.findUnique({
      where: { id: fx.foreignNotif.id },
      select: { readAt: true },
    });
    assertEq(foreignAfterOne.readAt, null, "markNotificationRead marked another user's row");

    return `ownerA unread ${unreadBefore} -> 0; pendingB1's notification stayed unread through both calls`;
  });

  // ── 18. Owner removes an active cashier + exactly one notification ────────
  await scenario(
    18,
    "removeMember(activeA1) flips status to removed + emits exactly one member_removed",
    async () => {
      const owner = await jarFor(fx.ownerA.email);

      const before = await prisma.user.findUnique({
        where: { id: fx.activeA1.id },
        select: { status: true, businessId: true },
      });
      assertEq(before.status, "active", "activeA1 status before remove");
      assertEq(before.businessId, fx.businessA.id, "activeA1 businessId before remove");

      const run = await mustAction(owner, "removeMember", [fx.activeA1.id]);
      assert(run.parsed.ok === true, `removeMember returned ${JSON.stringify(run.parsed)}`);

      const after = await prisma.user.findUnique({
        where: { id: fx.activeA1.id },
        select: { status: true, businessId: true },
      });
      assertEq(after.status, "removed", "activeA1 status after remove");
      assertEq(after.businessId, fx.businessA.id, "removeMember moved activeA1's business");

      const notices = await prisma.notification.findMany({
        where: { userId: fx.activeA1.id, type: "member_removed" },
        select: { id: true },
      });
      assertEq(notices.length, 1, "member_removed notification count for activeA1");

      return `action id ${run.id} on ${run.page} -> activeA1 active->removed + 1 member_removed notification`;
    },
  );

  // ── 19. Removed member with a stale "active" JWT ──────────────────────────
  await scenario(
    19,
    "Removed member's stale active JWT routes /dashboard to /register/choice without looping",
    async () => {
      // Reuse the SAME cookie jar created in scenario 3: its JWT was minted while
      // activeA1 was still "active", so the token status is now stale.
      const staleJar = jars.get(fx.activeA1.email);
      assert(staleJar, "activeA1 cookie jar is missing (scenario 3 should have created it)");

      const dashboard = await getPage("/dashboard", staleJar);
      assert(
        dashboard.status >= 300 && dashboard.status < 400,
        `removed member /dashboard expected redirect, got ${dashboard.status}`,
      );
      assert(
        (dashboard.location || "").includes("/register/choice"),
        `removed member /dashboard redirected to ${dashboard.location}`,
      );

      // The proxy must let signed-in users reach /register/* regardless of the
      // stale JWT status. If it bounced back to /dashboard the chain would loop;
      // a 200 here proves the terminal page was actually reached.
      const choice = await getPage("/register/choice", staleJar);
      assertEq(choice.status, 200, "removed member /register/choice (stale JWT)");
      assert(
        choice.body.includes("Akses dihapus"),
        "removed member's /register/choice does not surface the member_removed notice",
      );

      return `stale active JWT: /dashboard -> ${dashboard.status} ${dashboard.location}; /register/choice -> 200 (no loop)`;
    },
  );

  // ── 20. Non-owner cashier calling removeMember is refused ─────────────────
  await scenario(
    20,
    "removeMember is owner-only: a cashier is refused and the target is unchanged",
    async () => {
      const cashier = await jarFor(fx.activeA2.email);

      const refused = await mustAction(cashier, "removeMember", [fx.ownerA2.id]);
      assert(refused.parsed.ok === false, "cashier removeMember was accepted");
      assert(refused.parsed.error, "cashier removeMember refusal carried no error");

      const target = await prisma.user.findUnique({
        where: { id: fx.ownerA2.id },
        select: { status: true, role: true, businessId: true },
      });
      assertEq(target.status, "active", "cashier removeMember changed ownerA2 status");
      assertEq(target.role, "owner", "cashier removeMember changed ownerA2 role");
      assertEq(target.businessId, fx.businessA.id, "cashier removeMember moved ownerA2");

      const notices = await prisma.notification.count({
        where: { userId: fx.ownerA2.id, type: "member_removed" },
      });
      assertEq(notices, 0, "cashier removeMember emitted a member_removed notification");

      return `cashier removeMember -> ok:false (${refused.parsed.error}); ownerA2 still owner/active`;
    },
  );

  // ── 21. Owner cannot remove self or another owner ─────────────────────────
  await scenario(
    21,
    "An owner cannot remove themselves or another owner",
    async () => {
      const owner = await jarFor(fx.ownerA.email);

      const self = await mustAction(owner, "removeMember", [fx.ownerA.id]);
      assert(self.parsed.ok === false, "owner removed themselves");
      const selfRow = await prisma.user.findUnique({
        where: { id: fx.ownerA.id },
        select: { status: true, role: true, businessId: true },
      });
      assertEq(selfRow.status, "active", "owner status changed after self-remove attempt");
      assertEq(selfRow.role, "owner", "owner role changed after self-remove attempt");
      assertEq(selfRow.businessId, fx.businessA.id, "owner moved after self-remove attempt");

      const other = await mustAction(owner, "removeMember", [fx.ownerA2.id]);
      assert(other.parsed.ok === false, "owner removed another owner");
      const otherRow = await prisma.user.findUnique({
        where: { id: fx.ownerA2.id },
        select: { status: true, role: true, businessId: true },
      });
      assertEq(otherRow.status, "active", "ownerA2 status changed after owner-remove attempt");
      assertEq(otherRow.role, "owner", "ownerA2 role changed after owner-remove attempt");
      assertEq(otherRow.businessId, fx.businessA.id, "ownerA2 moved after owner-remove attempt");

      const notices = await prisma.notification.count({
        where: {
          userId: { in: [fx.ownerA.id, fx.ownerA2.id] },
          type: "member_removed",
        },
      });
      assertEq(notices, 0, "failed owner-removal attempts emitted member_removed notifications");

      return "self-remove refused; another-owner remove refused; both owners unchanged";
    },
  );

  // ── 22. Cross-business IDOR on removeMember ───────────────────────────────
  await scenario(
    22,
    "removeMember cannot cross businesses (IDOR) and business B is unchanged",
    async () => {
      const ownerA = await jarFor(fx.ownerA.email);

      const before = await prisma.user.findUnique({
        where: { id: fx.activeB1.id },
        select: { status: true, role: true, businessId: true },
      });
      assertEq(before.status, "active", "activeB1 status before IDOR attempt");
      assertEq(before.businessId, fx.businessB.id, "activeB1 businessId before IDOR attempt");

      const refused = await mustAction(ownerA, "removeMember", [fx.activeB1.id]);
      assert(refused.parsed.ok === false, "ownerA removed a member of business B (IDOR)");

      const after = await prisma.user.findUnique({
        where: { id: fx.activeB1.id },
        select: { status: true, role: true, businessId: true },
      });
      assertEq(after.status, "active", "business B member status changed by ownerA");
      assertEq(after.role, "cashier", "business B member role changed by ownerA");
      assertEq(after.businessId, fx.businessB.id, "business B member moved by ownerA");

      const notices = await prisma.notification.count({
        where: { userId: fx.activeB1.id, type: "member_removed" },
      });
      assertEq(notices, 0, "ownerA's IDOR attempt emitted a member_removed notification");

      return "ownerA refused; activeB1 still active/cashier in business B; no notification";
    },
  );

  // ── 23. /dashboard/profil structural contract ─────────────────────────────
  await scenario(
    23,
    "/dashboard/profil renders ONE sticky h1 header and exactly TWO sibling forms",
    async () => {
      const owner = await jarFor(fx.ownerA.email);
      const res = await getPage("/dashboard/profil", owner);
      assertEq(res.status, 200, "owner GET /dashboard/profil");
      const body = res.body;

      const h1Count = countMatches(body, /<h1\b/gi);
      assertEq(h1Count, 1, "/dashboard/profil <h1> count");
      const h1Text = firstElementText(body, "h1");
      assertEq(h1Text, "Profil", "/dashboard/profil <h1> text");

      const formCount = countMatches(body, /<form\b/gi);
      assertEq(formCount, 2, "/dashboard/profil <form> count (AccountForm + PasswordForm)");

      assert(
        body.includes("Kelola informasi akun dan keamanan Anda."),
        "/dashboard/profil is missing its subtitle",
      );

      const sticky = classAttributesWith(body, "sticky top-16", "backdrop-blur-xl");
      assertEq(sticky.length, 1, "sticky header marker (sticky top-16 + backdrop-blur-xl) count");

      assert(
        !/role\s*=\s*["']alertdialog["']/i.test(body),
        '/dashboard/profil server HTML renders role="alertdialog" (ConfirmDialog must be SSR-null)',
      );
      assert(
        !/ID\s*Bisnis/i.test(visibleText(body)),
        '/dashboard/profil renders the literal "ID Bisnis"',
      );

      return `1 <h1> ("${h1Text}"), ${formCount} forms, subtitle + sticky header x1, no alertdialog`;
    },
  );

  // ── 24. /dashboard/bisnis structural contract ─────────────────────────────
  await scenario(
    24,
    "/dashboard/bisnis renders ONE sticky h1 header, ONE form, and no SSR dialog markup",
    async () => {
      const owner = await jarFor(fx.ownerA.email);
      const res = await getPage("/dashboard/bisnis", owner);
      assertEq(res.status, 200, "owner GET /dashboard/bisnis");
      const body = res.body;

      const h1Count = countMatches(body, /<h1\b/gi);
      assertEq(h1Count, 1, "/dashboard/bisnis <h1> count");
      const h1Text = firstElementText(body, "h1");
      assertEq(h1Text, "Bisnis", "/dashboard/bisnis <h1> text");

      const formCount = countMatches(body, /<form\b/gi);
      assertEq(formCount, 1, "/dashboard/bisnis <form> count (old inner profile form removed)");

      assert(
        body.includes("Kelola profil bisnis, kode undangan, dan anggota tim Anda."),
        "/dashboard/bisnis is missing its subtitle",
      );

      const sticky = classAttributesWith(body, "sticky top-16", "backdrop-blur-xl");
      assertEq(sticky.length, 1, "sticky header marker (sticky top-16 + backdrop-blur-xl) count");

      assert(
        !/role\s*=\s*["']alertdialog["']/i.test(body),
        '/dashboard/bisnis server HTML renders role="alertdialog" (ConfirmDialog must be SSR-null)',
      );
      assert(
        body.includes("Buat ulang kode"),
        '/dashboard/bisnis is missing the invite trigger "Buat ulang kode"',
      );
      assert(
        !body.includes("Ya, buat ulang"),
        '/dashboard/bisnis still renders the removed inline confirm copy "Ya, buat ulang"',
      );
      assert(
        !body.includes("Kode lama akan langsung berhenti berlaku"),
        "/dashboard/bisnis still renders the removed inline confirmation copy",
      );
      assert(
        !/ID\s*Bisnis/i.test(visibleText(body)),
        '/dashboard/bisnis renders the literal "ID Bisnis"',
      );

      return `1 <h1> ("${h1Text}"), ${formCount} form, subtitle + sticky header x1, invite trigger present, legacy confirm copy gone, no alertdialog`;
    },
  );

  // ── 25. Landing CTA switch on auth ────────────────────────────────────
  // Bug (fixed): an already-authenticated visitor to `/` still saw "Masuk"/"Daftar".
  // `app/page.js` now reads `await auth()` and threads `isAuthenticated` into Navbar,
  // Hero and HowItWorks, so the same landing HTML must present exactly one CTA state.
  await scenario(
    25,
    "Landing CTAs switch on auth: signed-in sees Ke Dashboard, anonymous sees Masuk/Daftar",
    async () => {
      const authJar = await jarFor(fx.ownerA.email);
      const anonJar = new CookieJar();

      // Stable markers: the `id` attributes the CTAs' own click handlers depend on
      // (copy can be restyled; the ids are the app contract). The anonymous copy
      // markers cover the two SSR-rendered registration CTAs, so a broken page that
      // keeps the ids but swaps the labels is still caught.
      const AUTH_CTA_IDS = ['id="btn-nav-dashboard"', 'id="hero-cta-dashboard"'];
      const ANON_CTA_IDS = [
        'id="btn-nav-masuk"',
        'id="btn-nav-daftar"',
        'id="hero-cta-daftar"',
        'id="hero-cta-masuk"',
      ];
      const ANON_CTA_COPY = ["Daftar Gratis Sekarang", "Daftar Bisnis Sekarang"];
      const occurrences = (haystack, needle) => haystack.split(needle).length - 1;

      // Authenticated: dashboard CTAs present, every anonymous marker absent.
      const authed = await getPage("/", authJar);
      assertEq(authed.status, 200, "authenticated GET /");
      for (const marker of AUTH_CTA_IDS) {
        assertEq(
          occurrences(authed.body, marker),
          1,
          `authenticated landing lost ${marker}`,
        );
      }
      assert(
        authed.body.includes("Ke Dashboard"),
        'authenticated landing lost the "Ke Dashboard" CTA copy',
      );
      for (const marker of [...ANON_CTA_IDS, ...ANON_CTA_COPY]) {
        assertEq(
          occurrences(authed.body, marker),
          0,
          `authenticated landing still renders the anonymous CTA marker ${JSON.stringify(marker)}`,
        );
      }

      // Anonymous (positive control): the marketing CTAs must still be server-rendered.
      const anon = await getPage("/", anonJar);
      assertEq(anon.status, 200, "anonymous GET /");
      for (const marker of ANON_CTA_IDS) {
        assertEq(
          occurrences(anon.body, marker),
          1,
          `anonymous landing lost ${marker}`,
        );
      }
      for (const copy of ANON_CTA_COPY) {
        assert(
          anon.body.includes(copy),
          `anonymous landing lost the CTA copy ${JSON.stringify(copy)}`,
        );
      }
      for (const marker of AUTH_CTA_IDS) {
        assertEq(
          occurrences(anon.body, marker),
          0,
          `anonymous landing renders the signed-in CTA marker ${JSON.stringify(marker)}`,
        );
      }

      return (
        `authed / : ${AUTH_CTA_IDS.length}/${AUTH_CTA_IDS.length} Ke-Dashboard ids + "Ke Dashboard", ` +
        `0/6 anonymous markers; anon / : 4/4 anon ids + 2/2 anon copy, 0/2 Ke-Dashboard ids`
      );
    },
  );

  // ── 26. Rejected member's register/choice copy ────────────────────────────
  // Product decision: only a `pending` member gets a status box on /register/choice.
  // A `rejected` member gets NO status text at all (the role options below are
  // considered self-explanatory), so neither the pending copy nor the old rejected
  // copy may appear. Positive control: the page must still render its real content
  // (heading + both role-option links), so a broken page or a box that swallowed the
  // content fails here instead of false-passing on two absent strings.
  await scenario(
    26,
    "rejected member's /register/choice shows no status box",
    async () => {
      const rejectedJar = await jarFor(fx.rejectedA1.email);
      const db = await prisma.user.findUnique({
        where: { id: fx.rejectedA1.id },
        select: { status: true },
      });
      assertEq(db.status, "rejected", "rejectedA1 DB status before /register/choice");

      const res = await getPage("/register/choice", rejectedJar);
      assertEq(res.status, 200, "rejected member /register/choice");
      assert(
        !res.body.includes("menunggu persetujuan"),
        "rejected member /register/choice still shows the pending copy",
      );
      assert(
        !res.body.includes("Pendaftaran Anda sebelumnya ditolak"),
        "rejected member /register/choice still shows the removed rejected copy",
      );

      // Positive control: the page content is intact (heading + both role options).
      assert(
        res.body.includes("Bagaimana Anda akan mulai?"),
        "rejected member /register/choice lost its heading",
      );
      assertEq(
        countMatches(res.body, /href="\/register\/business"/g),
        1,
        "rejected member /register/choice lost the owner role option",
      );
      assertEq(
        countMatches(res.body, /href="\/register\/join"/g),
        1,
        "rejected member /register/choice lost the cashier role option",
      );

      return 'rejectedA1 DB status=rejected, /register/choice 200; no status box ("menunggu persetujuan" + "Pendaftaran Anda sebelumnya ditolak" both absent), heading + 2 role options present';
    },
  );

  // ── 27. Pending member's register/choice copy ─────────────────────────────
  // Companion to 26: the pending branch must KEEP the waiting copy. `pendingA2` is
  // created `pending` in the seed and no scenario ever approves it (scenario 9 proves
  // a cashier cannot), so it is a cheap, still-pending fixture at this point.
  await scenario(
    27,
    "pending member's /register/choice keeps the waiting copy",
    async () => {
      const pendingJar = await jarFor(fx.pendingA2.email);
      const db = await prisma.user.findUnique({
        where: { id: fx.pendingA2.id },
        select: { status: true },
      });
      assertEq(db.status, "pending", "pendingA2 DB status before /register/choice");

      const res = await getPage("/register/choice", pendingJar);
      assertEq(res.status, 200, "pending member /register/choice");
      assert(
        res.body.includes("menunggu persetujuan"),
        "pending member /register/choice lost the waiting copy",
      );
      assert(
        !res.body.includes("Pendaftaran Anda sebelumnya ditolak"),
        "pending member /register/choice shows the rejected copy",
      );
      assert(
        res.body.includes("Bagaimana Anda akan mulai?"),
        "pending member /register/choice lost its heading",
      );

      return 'pendingA2 DB status=pending, /register/choice 200; "menunggu persetujuan" present, rejected copy absent, heading present';
    },
  );

  // ── 28. Owner can open the customer list ──────────────────────────────────
  await scenario(
    28,
    "owner GET /dashboard/pelanggan renders the customer management surface",
    async () => {
      const owner = await jarFor(fx.ownerA.email);
      const res = await getPage("/dashboard/pelanggan", owner);
      assertEq(res.status, 200, "owner GET /dashboard/pelanggan");
      for (const marker of [
        "Kelola pelanggan",
        "Tambah pelanggan",
        'data-testid="customer-search"',
      ]) {
        assert(
          res.body.includes(marker),
          `owner /dashboard/pelanggan is missing ${JSON.stringify(marker)}`,
        );
      }
      return 'owner list 200; "Kelola pelanggan" + "Tambah pelanggan" + customer-search present';
    },
  );

  // ── 29. Cashiers MAY open the customer list (scoped to their business) ────
  await scenario(
    29,
    "cashier GET /dashboard/pelanggan is allowed and renders the customer surface",
    async () => {
      const cashier = await jarFor(fx.activeA2.email);
      const res = await getPage("/dashboard/pelanggan", cashier);
      assertEq(res.status, 200, "cashier GET /dashboard/pelanggan");
      for (const marker of [
        "Kelola pelanggan",
        "Tambah pelanggan",
        'data-testid="customer-search"',
      ]) {
        assert(
          res.body.includes(marker),
          `cashier /dashboard/pelanggan is missing ${JSON.stringify(marker)}`,
        );
      }
      // No business-scoping assertion here: at this point both business A and
      // business B have zero customers, so the cashier's list has nothing it
      // could leak. Scenario 34 already covers list isolation (ownerB does not
      // see business A's customer).
      return 'cashier list 200; "Kelola pelanggan" + "Tambah pelanggan" + customer-search present';
    },
  );

  // ── 30. Cashiers MAY create customers (scoped to their own business) ──────
  await scenario(
    30,
    "createCustomer as a cashier succeeds and is scoped to the cashier's own business",
    async () => {
      const cashier = await jarFor(fx.activeA2.email);
      const beforeA = await prisma.customer.count({
        where: { businessId: fx.businessA.id },
      });
      const beforeB = await prisma.customer.count({
        where: { businessId: fx.businessB.id },
      });

      const created = await mustAction(cashier, "createCustomer", [
        {
          name: "E2E Kasir Pelanggan",
          phoneNumber: "081234567890",
          creditLimit: 250000,
        },
      ]);
      assert(
        created.parsed.ok === true,
        `cashier createCustomer returned ${JSON.stringify(created.parsed)}`,
      );

      const row = await prisma.customer.findFirst({
        where: { businessId: fx.businessA.id, name: "E2E Kasir Pelanggan" },
        select: { id: true, businessId: true },
      });
      assert(row, "cashier createCustomer returned ok but wrote no customer row");
      assertEq(created.parsed.customerId, row.id, "returned customerId matches the row");
      assertEq(row.businessId, fx.businessA.id, "cashier-created customer businessId");

      const afterA = await prisma.customer.count({
        where: { businessId: fx.businessA.id },
      });
      const afterB = await prisma.customer.count({
        where: { businessId: fx.businessB.id },
      });
      assertEq(afterA, beforeA + 1, "cashier createCustomer did not add a business A customer");
      assertEq(afterB, beforeB, "cashier createCustomer touched business B customers");

      return `action id ${created.id} on ${created.page} -> ok:true customerId#${row.id}; business A customers ${beforeA} -> ${afterA}; business B ${beforeB} -> ${afterB}`;
    },
  );

  // ── 31. Validation guards run before any mutation ─────────────────────────
  await scenario(
    31,
    "createCustomer rejects blank name, bad phone, and negative limit without writing",
    async () => {
      const owner = await jarFor(fx.ownerA.email);
      const before = await prisma.customer.count({
        where: { businessId: fx.businessA.id },
      });

      const cases = [
        {
          label: "blank name",
          payload: { name: "   ", phoneNumber: "081234567890", creditLimit: 100000 },
          error: CUSTOMER_ERR.NAME,
        },
        {
          label: "invalid phone",
          payload: { name: "E2E Bad Phone", phoneNumber: "abc", creditLimit: 100000 },
          error: CUSTOMER_ERR.PHONE,
        },
        {
          label: "negative creditLimit",
          payload: { name: "E2E Bad Limit", phoneNumber: "081234567890", creditLimit: -5 },
          error: CUSTOMER_ERR.LIMIT,
        },
      ];

      for (const testCase of cases) {
        const run = await mustAction(owner, "createCustomer", [testCase.payload]);
        assert(run.parsed.ok === false, `${testCase.label} createCustomer was accepted`);
        assertEq(
          run.parsed.error,
          testCase.error,
          `${testCase.label} createCustomer error`,
        );

        const count = await prisma.customer.count({
          where: { businessId: fx.businessA.id },
        });
        assertEq(count, before, `${testCase.label} createCustomer wrote a customer row`);
      }

      return `3 rejected cases (blank name, phone "abc", creditLimit -5); business A customers stayed ${before}`;
    },
  );

  // ── 32. Owner creates a customer (spaces/dashes normalized) ───────────────
  await scenario(
    32,
    "createCustomer creates a business-scoped customer with default risk/trust",
    async () => {
      const owner = await jarFor(fx.ownerA.email);
      const before = await prisma.customer.count({
        where: { businessId: fx.businessA.id },
      });

      const run = await mustAction(owner, "createCustomer", [
        {
          name: "E2E Pelanggan Satu",
          phoneNumber: "0812-3456-7890",
          creditLimit: 1500000,
        },
      ]);
      assert(run.parsed.ok === true, `createCustomer returned ${JSON.stringify(run.parsed)}`);

      const created = await prisma.customer.findFirst({
        where: { businessId: fx.businessA.id, name: "E2E Pelanggan Satu" },
        select: {
          id: true,
          businessId: true,
          name: true,
          phoneNumber: true,
          creditLimit: true,
          riskScore: true,
          trustStatus: true,
        },
      });
      assert(created, "createCustomer returned ok but no customer row was written");
      fx.customerA1 = created.id;

      assertEq(run.parsed.customerId, created.id, "returned customerId matches the row");
      assertEq(created.businessId, fx.businessA.id, "created customer businessId");
      assertEq(created.phoneNumber, "081234567890", "created customer phoneNumber (normalized)");
      assertEq(Number(created.creditLimit), 1500000, "created customer creditLimit");
      assertEq(created.riskScore, 50, "created customer riskScore");
      assertEq(created.trustStatus, "unrated", "created customer trustStatus");
      assertEq(
        await prisma.customer.count({ where: { businessId: fx.businessA.id } }),
        before + 1,
        "business A customer count after create",
      );

      return `action id ${run.id} on ${run.page} -> customerA1#${created.id}; riskScore 50, trustStatus unrated, limit 1500000, phone "081234567890"`;
    },
  );

  // ── 33. The new customer appears on the owner's list ──────────────────────
  await scenario(
    33,
    "owner list page shows the created customer, its limit, and a table row",
    async () => {
      const owner = await jarFor(fx.ownerA.email);
      const res = await getPage("/dashboard/pelanggan", owner);
      assertEq(res.status, 200, "owner GET /dashboard/pelanggan after create");

      // Intl formats IDR with a non-breaking space, so normalize it for matching.
      const body = res.body.replace(/\u00a0/g, " ");
      for (const marker of [
        "E2E Pelanggan Satu",
        "Rp 1.500.000",
        'data-testid="customer-row"',
      ]) {
        assert(
          body.includes(marker),
          `owner list page is missing ${JSON.stringify(marker)}`,
        );
      }
      return 'list 200; contains "E2E Pelanggan Satu", "Rp 1.500.000", customer-row';
    },
  );

  // ── 34. Customer list is business-scoped (isolation) ──────────────────────
  await scenario(
    34,
    "business B's list does not leak business A's customer",
    async () => {
      const ownerB = await jarFor(fx.ownerB.email);
      const res = await getPage("/dashboard/pelanggan", ownerB);
      assertEq(res.status, 200, "ownerB GET /dashboard/pelanggan");
      assert(
        !res.body.includes("E2E Pelanggan Satu"),
        "ownerB's customer list leaked business A's customer",
      );
      return "ownerB list 200; business A customer absent";
    },
  );

  // ── 35. Owner opens the customer detail page ──────────────────────────────
  await scenario(
    35,
    "owner detail page renders the customer and a zero active debt",
    async () => {
      assert(fx.customerA1, "fx.customerA1 was never set by the create scenario");
      const owner = await jarFor(fx.ownerA.email);
      const res = await getPage(`/dashboard/pelanggan/${fx.customerA1}`, owner);
      assertEq(res.status, 200, "owner GET /dashboard/pelanggan/<id>");

      const body = res.body.replace(/\u00a0/g, " ");
      assert(
        body.includes("E2E Pelanggan Satu"),
        "owner detail page does not render the customer name",
      );
      assert(
        body.includes("Utang Aktif"),
        "owner detail page is missing the active-debt label",
      );
      assert(body.includes("Rp 0"), "owner detail page does not render a zero active debt");
      return `owner detail /dashboard/pelanggan/${fx.customerA1} 200; name + "Utang Aktif" + "Rp 0" present`;
    },
  );

  // ── 36. Cross-business detail access is a 404, not a redirect ─────────────
  await scenario(
    36,
    "ownerB gets 404 (IDOR-safe) for business A's customer detail",
    async () => {
      assert(fx.customerA1, "fx.customerA1 was never set by the create scenario");
      const ownerB = await jarFor(fx.ownerB.email);
      const res = await getPage(`/dashboard/pelanggan/${fx.customerA1}`, ownerB);
      assertEq(res.status, 404, "ownerB GET business A's customer detail");
      return `ownerB /dashboard/pelanggan/${fx.customerA1} -> 404 (not a redirect)`;
    },
  );

  // ── 37. Cashiers cannot open the owner-only detail page ───────────────────
  await scenario(
    37,
    "cashier GET the customer detail page is redirected off the owner-only route",
    async () => {
      assert(fx.customerA1, "fx.customerA1 was never set by the create scenario");
      const cashier = await jarFor(fx.activeA2.email);
      return await assertCashierRedirected(
        `/dashboard/pelanggan/${fx.customerA1}`,
        cashier,
        "customer detail",
      );
    },
  );

  // ── Resolved mapping report ───────────────────────────────────────────────
  console.log("\nResolved action-id mapping (client chunks ∩ server manifest, probe-confirmed above):");
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
        fx.convertedBusinessId,
        ...orphanBusinesses.map((b) => b.id),
      ].filter(Boolean),
    ),
  ];

  if (userIds.length) {
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.notification.deleteMany({ where: { body: { in: emails } } });
  }
  // Business has no cascade: clear its descendants before the business rows.
  await deleteBusinessesCascade(businessIds);
}

async function verifyRealRowsUntouched(snapshot) {
  const realAfter = await prisma.user.findMany({
    where: { NOT: { email: { endsWith: E2E_SUFFIX } } },
    select: { id: true, email: true, name: true, role: true, status: true, businessId: true },
    orderBy: { id: "asc" },
  });
  const same =
    JSON.stringify(realAfter) === JSON.stringify(snapshot.realBefore);
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
