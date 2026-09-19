/**
 * Pure rule-based risk scoring core for feature 4.4 (Skoring Risiko Kredit).
 *
 * This module is intentionally dependency-free (zero imports) so it can be
 * imported with plain `node` by relative path in `scripts/verify-risk-score.mjs`
 * and unit-tested without any module-resolution tricks.
 *
 * It never touches the database, never mutates its inputs, and is fully
 * deterministic given its arguments. Date handling is defensive: a missing or
 * invalid date is treated as "not late" and can never produce NaN.
 */

const MS_PER_DAY = 86400000;

/** Coerce a value to a finite number, falling back to 0. */
function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Parse a value into a Date, or return null when invalid/missing. */
function toDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (value === null || value === undefined) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Normalize a Date to its UTC-midnight epoch milliseconds, or null. */
function utcMidnight(value) {
  const d = toDate(value);
  if (!d) return null;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Whole-day difference between two operands, both normalized to UTC midnight.
 * `a > b` yields a positive value (i.e. "late"). Returns null when either
 * operand is missing/invalid so callers can treat it as not-late.
 */
export function floorDays(a, b) {
  const am = utcMidnight(a);
  const bm = utcMidnight(b);
  if (am === null || bm === null) return null;
  return Math.floor((am - bm) / MS_PER_DAY);
}

/** Copy + normalize a raw transaction (no input mutation). */
function normalizeTransaction(tx) {
  return {
    id: tx?.id ?? null,
    amount: toNumber(tx?.amount),
    dueDate: tx?.dueDate ?? null,
    transactionDate: tx?.transactionDate ?? null,
    status: tx?.status ?? null,
    payments: Array.isArray(tx?.payments) ? tx.payments : [],
  };
}

/** Ascending payment order: paymentDate asc, then id asc. */
function comparePaymentsAsc(a, b) {
  const at = toDate(a.paymentDate)?.getTime() ?? 0;
  const bt = toDate(b.paymentDate)?.getTime() ?? 0;
  if (at !== bt) return at - bt;
  return toNumber(a.id) - toNumber(b.id);
}

/**
 * Settlement date of a confirmed transaction:
 * - order its confirmed payments paymentDate asc, then id asc;
 * - the settlement date is the paymentDate of the payment at which the
 *   running cumulative sum first reaches or exceeds `amount`;
 * - if `status === "paid"` but no confirmed payment row exists (data drift),
 *   treat it as settled exactly on `dueDate`.
 * Returns a Date, or null when the transaction is not settled.
 */
function computeSettlementDate(tx) {
  const payments = [...tx.payments]
    .map((p) => ({
      id: p?.id ?? null,
      amountPaid: toNumber(p?.amountPaid),
      paymentDate: p?.paymentDate ?? null,
    }))
    .sort(comparePaymentsAsc);

  let cumulative = 0;
  for (const payment of payments) {
    cumulative += payment.amountPaid;
    if (cumulative >= tx.amount) {
      return toDate(payment.paymentDate);
    }
  }

  if (payments.length === 0 && tx.status === "paid") {
    return toDate(tx.dueDate);
  }

  return null;
}

/**
 * Mark a transaction late/on-time using the user-confirmed lateness rule:
 * (a) settled and settlementDate > dueDate → late by whole days; or
 * (b) not settled (status unpaid/partial) and now > dueDate → late by whole days.
 * Missing/invalid dates are treated as not-late.
 */
function markLateness(tx, now) {
  const settlementDate = computeSettlementDate(tx);
  if (settlementDate) {
    const days = floorDays(settlementDate, tx.dueDate);
    if (days !== null && days > 0) return { late: true, days };
    return { late: false, days: 0 };
  }

  if (tx.status === "unpaid" || tx.status === "partial") {
    const days = floorDays(now, tx.dueDate);
    if (days !== null && days > 0) return { late: true, days };
  }

  return { late: false, days: 0 };
}

/** Newest first: transactionDate desc, then id desc. */
function compareTransactionsNewestFirst(a, b) {
  const at = toDate(a.transactionDate)?.getTime() ?? 0;
  const bt = toDate(b.transactionDate)?.getTime() ?? 0;
  if (at !== bt) return bt - at;
  return toNumber(b.id) - toNumber(a.id);
}

/**
 * @param {object} input
 * @param {Array<{id:*, amount:*, dueDate:*, transactionDate:*, status:string, payments:Array}>} input.transactions
 *   Confirmed-only transactions; each `payments` is confirmed-only.
 * @param {*} input.creditLimit Customer credit limit (Decimal/number/string).
 * @param {*} input.customerCreatedAt Customer createdAt (Date/ISO string).
 * @param {Date|string} [input.now] Injectable "current" time, defaults to new Date().
 * @returns {{ riskScore: number, trustStatus: "stable"|"recovering"|"at_risk" }}
 */
export function computeRiskScore({
  transactions,
  creditLimit,
  customerCreatedAt,
  now = new Date(),
} = {}) {
  const normalized = (Array.isArray(transactions) ? transactions : []).map(
    normalizeTransaction,
  );
  const n = normalized.length;

  const entries = normalized.map((tx) => ({ tx, ...markLateness(tx, now) }));
  const lateEntries = entries.filter((entry) => entry.late);

  // Step 2 — score metrics.
  const persentaseTransaksiTelat = n > 0 ? lateEntries.length / n : 0;
  const rataRataHariTelat =
    lateEntries.length > 0
      ? lateEntries.reduce((sum, entry) => sum + entry.days, 0) /
        lateEntries.length
      : 0;

  const totalUtangAktif = normalized.reduce(
    (sum, tx) =>
      tx.status === "unpaid" || tx.status === "partial" ? sum + tx.amount : sum,
    0,
  );

  const limit = Number(creditLimit);
  const persentaseUtangAktifDariLimit =
    !Number.isFinite(limit) || limit <= 0
      ? totalUtangAktif > 0
        ? 1
        : 0
      : Math.min(1, totalUtangAktif / limit);

  // Consecutive unpaid/partial kasbon from newest until the first paid one.
  const ordered = [...normalized].sort(compareTransactionsNewestFirst);
  let jumlahKasbonBerturutBelumLunas = 0;
  for (const tx of ordered) {
    if (tx.status === "unpaid" || tx.status === "partial") {
      jumlahKasbonBerturutBelumLunas += 1;
    } else {
      break;
    }
  }

  // Loyalty bonus: no late transaction exceeds 7 days.
  const noLateOver7 = entries.every((entry) => !entry.late || entry.days <= 7);
  const ageDays = floorDays(now, customerCreatedAt);
  let bonusLamaPelangganBaik = 0;
  if (ageDays !== null && ageDays > 90 && noLateOver7) {
    bonusLamaPelangganBaik = 10;
  } else if (ageDays !== null && ageDays >= 30 && ageDays <= 90 && noLateOver7) {
    bonusLamaPelangganBaik = 5;
  }

  const score =
    100 -
    persentaseTransaksiTelat * 40 -
    (rataRataHariTelat / 30) * 20 -
    persentaseUtangAktifDariLimit * 20 -
    jumlahKasbonBerturutBelumLunas * 5 +
    bonusLamaPelangganBaik;

  const riskScore = Math.round(Math.max(0, Math.min(100, score)));

  // Step 3 — trustStatus (first match wins).
  const orderedEntries = [...entries].sort((a, b) =>
    compareTransactionsNewestFirst(a.tx, b.tx),
  );
  const latest5 = orderedEntries.slice(0, 5);
  const newest3 = orderedEntries.slice(0, 3);
  const olderThan3 = orderedEntries.slice(3);

  let trustStatus;
  if (latest5.length === 5 && latest5.every((e) => !e.late)) {
    trustStatus = "stable";
  } else if (
    latest5.length < 5 &&
    newest3.length === 3 &&
    newest3.every((e) => !e.late) &&
    olderThan3.some((e) => e.late)
  ) {
    trustStatus = "recovering";
  } else if (
    orderedEntries.length >= 3 &&
    newest3.filter((e) => e.late).length >= 2
  ) {
    trustStatus = "at_risk";
  } else if (riskScore >= 80) {
    trustStatus = "stable";
  } else if (riskScore >= 50) {
    trustStatus = "recovering";
  } else {
    trustStatus = "at_risk";
  }

  return { riskScore, trustStatus };
}
