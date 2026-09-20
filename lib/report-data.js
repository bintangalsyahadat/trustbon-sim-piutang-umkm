/**
 * Report data layer for the owner-only Laporan (Reports) page.
 *
 * All queries are scoped to a single businessId. Only CONFIRMED records
 * are included in period metrics (paymentStatus="confirmed" for
 * Transaction, status="confirmed" for Payment), matching the canonical
 * active-debt definition used across the app (see lib/customer-debt.js).
 *
 * Returned values are plain and JSON-serializable: no Prisma Decimal, no
 * Date objects. Money values are integers (IDR).
 */

import { prisma } from "@/lib/prisma";
import { getActiveDebtByCustomer } from "@/lib/customer-debt";

const DAY_MS = 86_400_000;

const DAY_FMT = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
});

const WEEK_FMT = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
});

const MONTH_FMT = new Intl.DateTimeFormat("id-ID", {
  month: "short",
  year: "numeric",
});

function toLocalDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function diffDays(a, b) {
  return Math.floor((a.getTime() - b.getTime()) / DAY_MS);
}

function lastNDays(n) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = addDays(end, -(n - 1));
  return { start, end };
}

/**
 * Build time buckets based on granularity.
 * Returns array of { start, endExclusive, label }.
 */
function buildBuckets(start, endExclusive, granularity) {
  const buckets = [];
  if (granularity === "day") {
    let cursor = new Date(start);
    while (cursor < endExclusive) {
      const next = addDays(cursor, 1);
      buckets.push({
        start: new Date(cursor),
        endExclusive: next > endExclusive ? endExclusive : next,
        label: DAY_FMT.format(cursor),
      });
      cursor = next;
    }
  } else if (granularity === "week") {
    let cursor = new Date(start);
    while (cursor < endExclusive) {
      const next = addDays(cursor, 7);
      const actualEnd = next > endExclusive ? endExclusive : next;
      buckets.push({
        start: new Date(cursor),
        endExclusive: actualEnd,
        label: `${WEEK_FMT.format(cursor)}\u2013${WEEK_FMT.format(addDays(actualEnd, -1))}`,
      });
      cursor = next;
    }
  } else {
    // month buckets
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor < endExclusive) {
      const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      buckets.push({
        start: cursor < start ? start : new Date(cursor),
        endExclusive: nextMonth > endExclusive ? endExclusive : nextMonth,
        label: MONTH_FMT.format(cursor),
      });
      cursor = nextMonth;
    }
  }
  return buckets;
}

function decideGranularity(start, endExclusive) {
  const days = diffDays(endExclusive, start);
  if (days <= 31) return "day";
  if (days <= 182) return "week";
  return "month";
}

/**
 * Main entry point. Fetches all report data for a given business and date
 * range. Returns a plain-serializable object.
 *
 * @param {number} businessId
 * @param {{ from: string, to: string }} opts - ISO date strings "YYYY-MM-DD"
 * @returns {Promise<object>}
 */
export async function getReportData(businessId, { from, to }) {
  let start = toLocalDate(from);
  let end = toLocalDate(to);

  if (!start || !end || start > end) {
    const fallback = lastNDays(30);
    start = fallback.start;
    end = fallback.end;
  }

  const endExclusive = addDays(end, 1);

  // Business name
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  });

  const granularity = decideGranularity(start, endExclusive);
  const buckets = buildBuckets(start, endExclusive, granularity);

  // Fetch confirmed transactions in period
  const confirmedTxs = await prisma.transaction.findMany({
    where: {
      businessId,
      paymentStatus: "confirmed",
      transactionDate: { gte: start, lt: endExclusive },
    },
    select: {
      id: true,
      customerId: true,
      amount: true,
      status: true,
      transactionDate: true,
    },
  });

  // Fetch confirmed payments in period (via transaction.businessId)
  const confirmedPayments = await prisma.payment.findMany({
    where: {
      status: "confirmed",
      paymentDate: { gte: start, lt: endExclusive },
      transaction: { businessId },
    },
    select: {
      id: true,
      amountPaid: true,
      paymentDate: true,
      transaction: {
        select: { id: true, dueDate: true },
      },
    },
  });

  // ── Summary ──────────────────────────────────────────────
  const newCreditTotal = confirmedTxs.reduce(
    (sum, tx) => sum + Number(tx.amount),
    0,
  );
  const newCreditCount = confirmedTxs.length;

  const paymentsReceivedTotal = confirmedPayments.reduce(
    (sum, p) => sum + Number(p.amountPaid),
    0,
  );
  const paymentsCount = confirmedPayments.length;

  // Collectibility: % of confirmed txs in period that are "paid"
  const paidCount = confirmedTxs.filter((tx) => tx.status === "paid").length;
  const collectibilityRate =
    newCreditCount > 0 ? (paidCount / newCreditCount) * 100 : null;

  // Avg days late: for each confirmed payment in period, daysLate = max(0,
  // paymentDate - dueDate). Average over all such payments.
  let totalDaysLate = 0;
  let latePaymentsCount = 0;
  for (const p of confirmedPayments) {
    const dueDate = p.transaction?.dueDate;
    if (dueDate) {
      const late = Math.max(0, diffDays(p.paymentDate, dueDate));
      totalDaysLate += late;
      latePaymentsCount++;
    }
  }
  const avgDaysLate =
    latePaymentsCount > 0 ? totalDaysLate / latePaymentsCount : null;

  // ── Trend data ───────────────────────────────────────────
  // For each bucket, compute:
  //   - newCredit: sum of confirmed tx amounts in that bucket
  //   - payments: sum of confirmed payment amounts in that bucket
  //   - activeReceivables: running outstanding at bucket end

  // Index payments by bucket
  const paymentsByBucket = buckets.map(() => 0);
  for (const p of confirmedPayments) {
    for (let i = 0; i < buckets.length; i++) {
      if (
        p.paymentDate >= buckets[i].start &&
        p.paymentDate < buckets[i].endExclusive
      ) {
        paymentsByBucket[i] += Number(p.amountPaid);
        break;
      }
    }
  }

  // Index txs by bucket
  const txsByBucket = buckets.map(() => 0);
  for (const tx of confirmedTxs) {
    for (let i = 0; i < buckets.length; i++) {
      if (
        tx.transactionDate >= buckets[i].start &&
        tx.transactionDate < buckets[i].endExclusive
      ) {
        txsByBucket[i] += Number(tx.amount);
        break;
      }
    }
  }

  // Active receivables over time: for each bucket end, compute
  // cumulative outstanding across all confirmed txs up to that point.
  // Fetch all confirmed txs (not just period) up to endExclusive for this.
  const allConfirmedTxs = await prisma.transaction.findMany({
    where: {
      businessId,
      paymentStatus: "confirmed",
      transactionDate: { lt: endExclusive },
    },
    select: {
      id: true,
      amount: true,
      transactionDate: true,
      payments: {
        where: { status: "confirmed" },
        select: { amountPaid: true, paymentDate: true },
      },
    },
  });

  const activeReceivablesByBucket = buckets.map((bucket) => {
    let total = 0;
    for (const tx of allConfirmedTxs) {
      if (tx.transactionDate >= bucket.endExclusive) continue;
      const paidUpToBucket = tx.payments
        .filter((p) => p.paymentDate < bucket.endExclusive)
        .reduce((s, p) => s + Number(p.amountPaid), 0);
      total += Math.max(0, Number(tx.amount) - paidUpToBucket);
    }
    return total;
  });

  // ── Risk distribution ────────────────────────────────────
  const customersAll = await prisma.customer.findMany({
    where: { businessId },
    select: { id: true, trustStatus: true },
  });
  const riskCounts = { stable: 0, recovering: 0, at_risk: 0, unrated: 0 };
  for (const c of customersAll) {
    riskCounts[c.trustStatus] = (riskCounts[c.trustStatus] ?? 0) + 1;
  }
  const riskDistribution = [
    { trustStatus: "stable", count: riskCounts.stable },
    { trustStatus: "recovering", count: riskCounts.recovering },
    { trustStatus: "at_risk", count: riskCounts.at_risk },
    { trustStatus: "unrated", count: riskCounts.unrated },
  ];

  // ── Customer table ───────────────────────────────────────
  const allCustomers = await prisma.customer.findMany({
    where: { businessId },
    select: {
      id: true,
      name: true,
      riskScore: true,
      trustStatus: true,
    },
  });

  // Period totals per customer
  const creditByCustomer = new Map();
  for (const tx of confirmedTxs) {
    creditByCustomer.set(
      tx.customerId,
      (creditByCustomer.get(tx.customerId) ?? 0) + Number(tx.amount),
    );
  }

  const paidByCustomer = new Map();
  // Need to group payments by customer; join through transaction
  const periodPaymentsWithCustomer = await prisma.payment.findMany({
    where: {
      status: "confirmed",
      paymentDate: { gte: start, lt: endExclusive },
      transaction: { businessId },
    },
    select: {
      amountPaid: true,
      transaction: { select: { customerId: true } },
    },
  });
  for (const p of periodPaymentsWithCustomer) {
    const cid = p.transaction.customerId;
    paidByCustomer.set(
      cid,
      (paidByCustomer.get(cid) ?? 0) + Number(p.amountPaid),
    );
  }

  const activeDebtByCustomer = await getActiveDebtByCustomer(businessId);

  const customerRows = allCustomers
    .map((c) => ({
      id: c.id,
      name: c.name,
      totalCredit: creditByCustomer.get(c.id) ?? 0,
      totalPaid: paidByCustomer.get(c.id) ?? 0,
      outstanding: activeDebtByCustomer.get(c.id) ?? 0,
      riskScore: c.riskScore,
      trustStatus: c.trustStatus,
    }))
    .sort((a, b) => b.outstanding - a.outstanding || a.name.localeCompare(b.name));

  return {
    businessName: business?.name ?? "Bisnis Anda",
    period: { from: formatDateISO(start), to: formatDateISO(end) },
    granularity,
    summary: {
      newCreditTotal,
      newCreditCount,
      paymentsReceivedTotal,
      paymentsCount,
      collectibilityRate,
      avgDaysLate,
    },
    trend: {
      labels: buckets.map((b) => b.label),
      activeReceivables: activeReceivablesByBucket,
      newCredit: txsByBucket,
      payments: paymentsByBucket,
    },
    riskDistribution,
    customers: customerRows,
  };
}
