#!/usr/bin/env node
/**
 * Pure, dependency-free unit harness for the feature-4.4 scoring core
 * (`lib/risk-score-core.js`).
 *
 * Unlike the other `scripts/verify-*.mjs` harnesses, this one starts NO server,
 * opens NO database connection and needs NO build: it imports the pure core by
 * relative path and feeds it hand-written, deterministic fixtures with an
 * injected `now`. That makes it fast enough to run on every change and pins the
 * exact scoring semantics independently of Prisma.
 *
 * Scoring contract encoded here (history = confirmed transactions only):
 *   - late if settled and settlementDate > dueDate, or unsettled and now > dueDate;
 *     late days = whole UTC-midnight day difference.
 *   - settlement date = paymentDate of the confirmed payment at which the
 *     cumulative confirmed paid sum first reaches the transaction amount.
 *   - score = 100
 *       - (lateCount / total) * 40
 *       - (avgLateDays / 30) * 20
 *       - min(1, activeDebt / creditLimit) * 20
 *       - consecutiveUnpaidFromNewest * 5
 *       + tenureBonus,  rounded and clamped to 0..100.
 *   - tenureBonus = +10 (age > 90d) / +5 (age 30..90d) when no transaction is
 *     late by more than 7 days, else 0.
 *   - trustStatus, first match wins: R1 5-newest-on-time stable; R2 (<5 total,
 *     newest 3 on time, an older late) recovering; R3 (>=3 total, >=2 of newest
 *     3 late) at_risk; R4 score map >=80 stable / 50..79 recovering / <=49 at_risk.
 *
 * Usage:
 *   node scripts/verify-risk-score.mjs
 *
 * Exit code: 0 only when every case passes.
 */

import { computeRiskScore } from "../lib/risk-score-core.js";

const DAY = 86400000;

/** Fixed injected "now" so every fixture is deterministic. */
const NOW = new Date("2026-07-01T00:00:00Z");

/** Credit limit big enough that the debt term rounds away (isolates other terms). */
const HIGH_LIMIT = 1e12;

const DAY_NAMES = ["stable", "recovering", "at_risk"];

// ─────────────────────────────────────────────────────────────────────────────
// Tiny assertion + case framework (plain node, no test runner)
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

function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}`);
  } catch (error) {
    failed = true;
    results.push({ name, ok: false, error: error.message });
    console.log(`FAIL  ${name}\n      ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

/** UTC-midnight date from a plain "YYYY-MM-DD" string. */
const iso = (value) => new Date(`${value}T00:00:00Z`);

/** Shift a date by whole days. */
const addDays = (date, days) => new Date(date.getTime() + days * DAY);

/**
 * A fully settled (status "paid") transaction with a single confirmed payment
 * whose paymentDate is the settlement date.
 */
function paid(id, amount, dueDate, transactionDate, settlementDate) {
  return {
    id,
    amount,
    dueDate,
    transactionDate,
    status: "paid",
    payments: [
      { id: id * 100 + 1, amountPaid: amount, paymentDate: settlementDate },
    ],
  };
}

/** A still-open transaction (default status "unpaid", no payments). */
function open(id, amount, dueDate, transactionDate, status = "unpaid", payments = []) {
  return { id, amount, dueDate, transactionDate, status, payments };
}

const validStatus = (status) => DAY_NAMES.includes(status);

// ─────────────────────────────────────────────────────────────────────────────
// 1. The late-fraction term
// ─────────────────────────────────────────────────────────────────────────────

test("%late: 2 of 4 settled-late (each 30d) -> 100 - 20 - 20 = 60", () => {
  const transactions = [
    paid(1, 100000, iso("2026-01-01"), iso("2026-01-01"), iso("2026-01-01")),
    paid(2, 100000, iso("2026-02-01"), iso("2026-02-01"), iso("2026-02-01")),
    paid(3, 100000, iso("2026-03-01"), iso("2026-03-01"), iso("2026-03-31")),
    paid(4, 100000, iso("2026-04-01"), iso("2026-04-01"), iso("2026-05-01")),
  ];
  const { riskScore } = computeRiskScore({ transactions, creditLimit: HIGH_LIMIT, now: NOW });
  assertEq(riskScore, 60, "riskScore");
});

test("%late: 1 of 4 settled-late (30d) -> 100 - 10 - 20 = 70", () => {
  const transactions = [
    paid(1, 100000, iso("2026-01-01"), iso("2026-01-01"), iso("2026-01-01")),
    paid(2, 100000, iso("2026-02-01"), iso("2026-02-01"), iso("2026-02-01")),
    paid(3, 100000, iso("2026-03-01"), iso("2026-03-01"), iso("2026-03-31")),
    paid(4, 100000, iso("2026-04-01"), iso("2026-04-01"), iso("2026-04-01")),
  ];
  const { riskScore } = computeRiskScore({ transactions, creditLimit: HIGH_LIMIT, now: NOW });
  assertEq(riskScore, 70, "riskScore");
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. The average-days-late term
// ─────────────────────────────────────────────────────────────────────────────

test("avgLateDays 15 -> 10 pt (single 100%-late tx) -> 50", () => {
  const transactions = [paid(1, 100000, iso("2026-01-01"), iso("2026-01-01"), iso("2026-01-16"))];
  const { riskScore } = computeRiskScore({ transactions, creditLimit: HIGH_LIMIT, now: NOW });
  assertEq(riskScore, 50, "riskScore");
});

test("avgLateDays 30 -> 20 pt -> 40", () => {
  const transactions = [paid(1, 100000, iso("2026-01-01"), iso("2026-01-01"), iso("2026-01-31"))];
  const { riskScore } = computeRiskScore({ transactions, creditLimit: HIGH_LIMIT, now: NOW });
  assertEq(riskScore, 40, "riskScore");
});

test("avgLateDays averages the late txs only: (10 + 20) / 2 = 15 -> 10 pt", () => {
  const transactions = [
    paid(1, 100000, iso("2026-01-01"), iso("2026-01-01"), iso("2026-01-11")),
    paid(2, 100000, iso("2026-01-01"), iso("2026-01-02"), iso("2026-01-21")),
  ];
  const { riskScore } = computeRiskScore({ transactions, creditLimit: HIGH_LIMIT, now: NOW });
  // 100 - (2/2)*40 - (15/30)*20 = 50 (avg over all four would give 85).
  assertEq(riskScore, 50, "riskScore");
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. The active-debt term (clamp + creditLimit <= 0 guard)
// ─────────────────────────────────────────────────────────────────────────────

/** Newest tx settled on time, one older unpaid tx driving active debt. */
const debtFixture = (debtAmount, creditLimit) => ({
  transactions: [
    paid(1, 100000, iso("2026-01-01"), iso("2026-06-01"), iso("2026-01-01")),
    open(2, debtAmount, iso("2026-08-01"), iso("2026-01-01")),
  ],
  creditLimit,
  now: NOW,
});

test("active debt == creditLimit -> ratio clamped to 100% -> -20 -> 80", () => {
  const { riskScore } = computeRiskScore(debtFixture(100000, 100000));
  assertEq(riskScore, 80, "riskScore");
});

test("active debt > creditLimit -> ratio clamped to 100% -> -20 -> 80", () => {
  const { riskScore } = computeRiskScore(debtFixture(300000, 100000));
  assertEq(riskScore, 80, "riskScore");
});

test("active debt 50% of creditLimit -> -10 -> 90", () => {
  const { riskScore } = computeRiskScore(debtFixture(50000, 100000));
  assertEq(riskScore, 90, "riskScore");
});

test("creditLimit <= 0 with active debt -> guard ratio 1 -> -20 -> 80", () => {
  const { riskScore } = computeRiskScore(debtFixture(100000, 0));
  assertEq(riskScore, 80, "riskScore");
});

test("creditLimit <= 0 with no debt -> guard ratio 0 -> 100", () => {
  const transactions = [
    paid(1, 100000, iso("2026-01-01"), iso("2026-01-01"), iso("2026-01-01")),
    paid(2, 100000, iso("2026-02-01"), iso("2026-02-01"), iso("2026-02-01")),
  ];
  const { riskScore } = computeRiskScore({ transactions, creditLimit: 0, now: NOW });
  assertEq(riskScore, 100, "riskScore");
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. The consecutive-unpaid-from-newest term
// ─────────────────────────────────────────────────────────────────────────────

test("consecutive unpaid streak 0 (newest is paid) -> -0 -> 100", () => {
  const transactions = [
    paid(1, 100000, iso("2026-01-01"), iso("2026-06-01"), iso("2026-01-01")),
    open(2, 100000, iso("2026-08-01"), iso("2026-05-01")),
    open(3, 100000, iso("2026-08-01"), iso("2026-04-01")),
  ];
  const { riskScore } = computeRiskScore({ transactions, creditLimit: HIGH_LIMIT, now: NOW });
  assertEq(riskScore, 100, "riskScore");
});

test("consecutive unpaid streak 1 -> -5 -> 95", () => {
  const transactions = [
    open(1, 100000, iso("2026-08-01"), iso("2026-06-01")),
    paid(2, 100000, iso("2026-01-01"), iso("2026-05-01"), iso("2026-01-01")),
  ];
  const { riskScore } = computeRiskScore({ transactions, creditLimit: HIGH_LIMIT, now: NOW });
  assertEq(riskScore, 95, "riskScore");
});

test("consecutive unpaid streak 3, stops at the first paid -> -15 -> 85", () => {
  const transactions = [
    open(1, 100000, iso("2026-08-01"), iso("2026-06-01")),
    open(2, 100000, iso("2026-08-01"), iso("2026-05-01")),
    open(3, 100000, iso("2026-08-01"), iso("2026-04-01")),
    paid(4, 100000, iso("2026-01-01"), iso("2026-03-01"), iso("2026-01-01")),
  ];
  const { riskScore } = computeRiskScore({ transactions, creditLimit: HIGH_LIMIT, now: NOW });
  assertEq(riskScore, 85, "riskScore");
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Overdue-but-unsettled transactions count as late (rule b)
// ─────────────────────────────────────────────────────────────────────────────

test("overdue unpaid tx counts as late (now > dueDate) -> 48", () => {
  const transactions = [
    open(1, 100000, iso("2026-06-21"), iso("2026-06-01")),
  ];
  // 100 - (1/1)*40 - (10/30)*20 - 0 - 1*5 = 48.33 -> 48
  const { riskScore } = computeRiskScore({ transactions, creditLimit: HIGH_LIMIT, now: NOW });
  assertEq(riskScore, 48, "riskScore");
});

test("unsettled but not yet due (now <= dueDate) is NOT late -> 95", () => {
  const transactions = [
    open(1, 100000, iso("2026-07-11"), iso("2026-06-01")),
  ];
  const { riskScore } = computeRiskScore({ transactions, creditLimit: HIGH_LIMIT, now: NOW });
  assertEq(riskScore, 95, "riskScore");
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Partial payments: settlement happens at the crossing payment
// ─────────────────────────────────────────────────────────────────────────────

test("settlement = payment that crosses the amount, not the last payment -> 54", () => {
  const transactions = [
    {
      id: 1,
      amount: 1000,
      dueDate: iso("2026-01-01"),
      transactionDate: iso("2026-01-01"),
      status: "paid",
      // Deliberately unsorted: the crossing payment (700 on Jan 10) is the
      // settlement date, even though a later 500 payment exists on Feb 1.
      payments: [
        { id: 2, amountPaid: 700, paymentDate: iso("2026-01-10") },
        { id: 3, amountPaid: 500, paymentDate: iso("2026-02-01") },
        { id: 1, amountPaid: 300, paymentDate: iso("2026-01-05") },
      ],
    },
  ];
  // settlement Jan 10 - due Jan 1 = 9 late days: 100 - 40 - (9/30)*20 = 54.
  const { riskScore } = computeRiskScore({ transactions, creditLimit: HIGH_LIMIT, now: NOW });
  assertEq(riskScore, 54, "riskScore");
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Tenure bonus
// ─────────────────────────────────────────────────────────────────────────────

/** Single settled-late tx (1 day) used to expose the tenure bonus. */
const lateByOne = [paid(1, 100000, iso("2026-01-01"), iso("2026-01-01"), iso("2026-01-02"))];

test("tenure > 90d and clean -> +10 -> 69", () => {
  const { riskScore } = computeRiskScore({
    transactions: lateByOne,
    creditLimit: HIGH_LIMIT,
    customerCreatedAt: addDays(NOW, -100),
    now: NOW,
  });
  // 100 - 40 - 0.667 + 10 = 69.33 -> 69
  assertEq(riskScore, 69, "riskScore");
});

test("tenure 30..90d and clean -> +5 -> 64", () => {
  const { riskScore } = computeRiskScore({
    transactions: lateByOne,
    creditLimit: HIGH_LIMIT,
    customerCreatedAt: addDays(NOW, -45),
    now: NOW,
  });
  assertEq(riskScore, 64, "riskScore");
});

test("tenure age exactly 90d -> +5 (boundary inclusive) -> 64", () => {
  const { riskScore } = computeRiskScore({
    transactions: lateByOne,
    creditLimit: HIGH_LIMIT,
    customerCreatedAt: addDays(NOW, -90),
    now: NOW,
  });
  assertEq(riskScore, 64, "riskScore");
});

test("tenure age 29d -> no bonus -> 59", () => {
  const { riskScore } = computeRiskScore({
    transactions: lateByOne,
    creditLimit: HIGH_LIMIT,
    customerCreatedAt: addDays(NOW, -29),
    now: NOW,
  });
  // 100 - 40 - 0.667 = 59.33 -> 59
  assertEq(riskScore, 59, "riskScore");
});

test("tenure late-by-8-days kills the bonus -> 55", () => {
  const transactions = [
    paid(1, 100000, iso("2026-01-01"), iso("2026-01-01"), iso("2026-01-09")),
  ];
  const { riskScore } = computeRiskScore({
    transactions,
    creditLimit: HIGH_LIMIT,
    customerCreatedAt: addDays(NOW, -100),
    now: NOW,
  });
  // 100 - 40 - (8/30)*20 = 54.67 -> 55 (no +10 because 8 > 7).
  assertEq(riskScore, 55, "riskScore");
});

test("absent customerCreatedAt -> bonus 0 -> 59", () => {
  const { riskScore } = computeRiskScore({
    transactions: lateByOne,
    creditLimit: HIGH_LIMIT,
    now: NOW,
  });
  assertEq(riskScore, 59, "riskScore");
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Clamping at both ends
// ─────────────────────────────────────────────────────────────────────────────

test("clamp high: base 100 + tenure +10 -> 100", () => {
  const transactions = [
    paid(1, 100000, iso("2026-01-01"), iso("2026-01-01"), iso("2026-01-01")),
    paid(2, 100000, iso("2026-02-01"), iso("2026-02-01"), iso("2026-02-01")),
    paid(3, 100000, iso("2026-03-01"), iso("2026-03-01"), iso("2026-03-01")),
    paid(4, 100000, iso("2026-04-01"), iso("2026-04-01"), iso("2026-04-01")),
    paid(5, 100000, iso("2026-05-01"), iso("2026-05-01"), iso("2026-05-01")),
  ];
  const { riskScore } = computeRiskScore({
    transactions,
    creditLimit: HIGH_LIMIT,
    customerCreatedAt: addDays(NOW, -100),
    now: NOW,
  });
  assertEq(riskScore, 100, "riskScore (110 clamped)");
});

test("clamp low: 300 late days -> 0", () => {
  const transactions = [
    paid(1, 100000, iso("2025-01-01"), iso("2025-01-01"), iso("2025-10-28")),
  ];
  // 100 - 40 - (300/30)*20 = -140 -> 0
  const { riskScore } = computeRiskScore({ transactions, creditLimit: HIGH_LIMIT, now: NOW });
  assertEq(riskScore, 0, "riskScore");
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. trustStatus R1..R4 and the 80 / 79 / 50 / 49 boundaries
// ─────────────────────────────────────────────────────────────────────────────

const fiveOnTime = [
  paid(1, 100000, iso("2026-01-01"), iso("2026-01-01"), iso("2026-01-01")),
  paid(2, 100000, iso("2026-02-01"), iso("2026-02-01"), iso("2026-02-01")),
  paid(3, 100000, iso("2026-03-01"), iso("2026-03-01"), iso("2026-03-01")),
  paid(4, 100000, iso("2026-04-01"), iso("2026-04-01"), iso("2026-04-01")),
  paid(5, 100000, iso("2026-05-01"), iso("2026-05-01"), iso("2026-05-01")),
];

test("R1: exactly 5 newest all on time -> stable", () => {
  const result = computeRiskScore({ transactions: fiveOnTime, creditLimit: HIGH_LIMIT, now: NOW });
  assertEq(result.riskScore, 100, "riskScore");
  assertEq(result.trustStatus, "stable", "trustStatus");
});

test("R1 first-match: 5 newest on time despite an older 30d-late tx -> stable", () => {
  const transactions = [
    ...fiveOnTime,
    // Oldest tx is late, but R1 only looks at the 5 newest.
    paid(6, 100000, iso("2025-12-01"), iso("2025-12-01"), iso("2025-12-31")),
  ];
  const result = computeRiskScore({ transactions, creditLimit: HIGH_LIMIT, now: NOW });
  assertEq(result.riskScore, 73, "riskScore");
  assertEq(result.trustStatus, "stable", "trustStatus");
});

test("R2: 4 total, newest 3 on time, oldest late -> recovering", () => {
  const transactions = [
    paid(2, 100000, iso("2026-02-01"), iso("2026-02-01"), iso("2026-02-01")),
    paid(3, 100000, iso("2026-03-01"), iso("2026-03-01"), iso("2026-03-01")),
    paid(4, 100000, iso("2026-04-01"), iso("2026-04-01"), iso("2026-04-01")),
    paid(1, 100000, iso("2026-01-01"), iso("2026-01-01"), iso("2026-01-06")),
  ];
  const result = computeRiskScore({ transactions, creditLimit: HIGH_LIMIT, now: NOW });
  assertEq(result.riskScore, 87, "riskScore");
  assertEq(result.trustStatus, "recovering", "trustStatus");
});

test("R3: 3 total, 2 of the newest 3 late -> at_risk", () => {
  const transactions = [
    paid(1, 100000, iso("2026-01-01"), iso("2026-01-01"), iso("2026-01-01")),
    paid(2, 100000, iso("2026-02-01"), iso("2026-02-01"), iso("2026-02-02")),
    paid(3, 100000, iso("2026-03-01"), iso("2026-03-01"), iso("2026-03-02")),
  ];
  const result = computeRiskScore({ transactions, creditLimit: HIGH_LIMIT, now: NOW });
  assertEq(result.riskScore, 73, "riskScore");
  assertEq(result.trustStatus, "at_risk", "trustStatus");
});

test("R4 stable at score 80 (2 txs: debt-clamped)", () => {
  const result = computeRiskScore(debtFixture(100000, 100000));
  assertEq(result.riskScore, 80, "riskScore");
  assertEq(result.trustStatus, "stable", "trustStatus");
});

test("R4 recovering at score 79 (2 txs: one 1d late)", () => {
  const transactions = [
    paid(1, 100000, iso("2026-01-01"), iso("2026-01-01"), iso("2026-01-01")),
    paid(2, 100000, iso("2026-06-01"), iso("2026-06-01"), iso("2026-06-02")),
  ];
  const result = computeRiskScore({ transactions, creditLimit: HIGH_LIMIT, now: NOW });
  assertEq(result.riskScore, 79, "riskScore");
  assertEq(result.trustStatus, "recovering", "trustStatus");
});

test("R4 recovering at score 50 (2 txs: both 15d late)", () => {
  const transactions = [
    paid(1, 100000, iso("2026-01-01"), iso("2026-01-01"), iso("2026-01-16")),
    paid(2, 100000, iso("2026-02-01"), iso("2026-02-01"), iso("2026-02-16")),
  ];
  const result = computeRiskScore({ transactions, creditLimit: HIGH_LIMIT, now: NOW });
  assertEq(result.riskScore, 50, "riskScore");
  assertEq(result.trustStatus, "recovering", "trustStatus");
});

test("R4 at_risk at score 49 (2 txs: both 16d late)", () => {
  const transactions = [
    paid(1, 100000, iso("2026-01-01"), iso("2026-01-01"), iso("2026-01-17")),
    paid(2, 100000, iso("2026-02-01"), iso("2026-02-01"), iso("2026-02-17")),
  ];
  const result = computeRiskScore({ transactions, creditLimit: HIGH_LIMIT, now: NOW });
  assertEq(result.riskScore, 49, "riskScore");
  assertEq(result.trustStatus, "at_risk", "trustStatus");
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Purity + defensive handling of missing/undefined dates
// ─────────────────────────────────────────────────────────────────────────────

test("purity: the core does not mutate its input", () => {
  const input = {
    transactions: [
      paid(1, 100000, iso("2026-01-01"), iso("2026-01-01"), iso("2026-01-16")),
      open(2, 50000, iso("2026-08-01"), iso("2026-02-01")),
    ],
    creditLimit: 100000,
    customerCreatedAt: addDays(NOW, -100),
    now: NOW,
  };
  const before = JSON.stringify(input);
  computeRiskScore(input);
  const after = JSON.stringify(input);
  assertEq(after, before, "input was mutated");
});

test("defensive: missing/undefined dueDate + paymentDate never throws or NaNs", () => {
  const transactions = [
    {
      id: 1,
      amount: 100,
      dueDate: null,
      transactionDate: undefined,
      status: "paid",
      payments: [{ id: 1, amountPaid: 100, paymentDate: null }],
    },
    { id: 2, amount: 100, status: "unpaid" }, // no dates, no payments key
  ];
  const result = computeRiskScore({
    transactions,
    creditLimit: 100000,
    customerCreatedAt: undefined,
    now: NOW,
  });
  assert(Number.isFinite(result.riskScore), `riskScore is finite (got ${result.riskScore})`);
  assert(Number.isInteger(result.riskScore), `riskScore is an integer (got ${result.riskScore})`);
  assert(validStatus(result.trustStatus), `trustStatus is valid (got ${result.trustStatus})`);
});

test("defensive: empty/absent transactions input -> finite score, valid status", () => {
  const empty = computeRiskScore({ transactions: [], creditLimit: 100000, now: NOW });
  assert(Number.isFinite(empty.riskScore), "empty transactions riskScore is finite");
  assert(validStatus(empty.trustStatus), "empty transactions trustStatus is valid");

  const absent = computeRiskScore({ creditLimit: 100000, now: NOW });
  assert(Number.isFinite(absent.riskScore), "absent transactions riskScore is finite");
  assert(validStatus(absent.trustStatus), "absent transactions trustStatus is valid");
});

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

const passed = results.filter((entry) => entry.ok).length;
console.log(`\n${passed}/${results.length} cases passed`);
if (failed) {
  console.log("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
