import { floorDays } from "./risk-score-core.js";

/**
 * Coerce a value to a valid Date, or null when missing/unparseable.
 * Accepts both Date objects and ISO strings; a `new Date(...)` call is used so
 * string inputs work, and an invalid date never throws.
 */
function coerceDate(value) {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Human-readable settlement timing for one transaction row.
 *
 * Rules (frozen; the E2E harness asserts these exact labels):
 *  1. cancelled record            -> neutral "—"
 *  2. invalid/missing dueDate     -> neutral "—"
 *  3. settled (lastPaymentDate)   -> emerald "Tepat waktu" when paid on/before due,
 *                                    rose "Telat N hari" when paid after due
 *  4. unsettled                   -> neutral "Belum jatuh tempo" when not yet past due,
 *                                    amber "Terlambat N hari" when past due
 *
 * `floorDays(a, b)` is the whole-day difference `a - b` (both normalized to UTC
 * midnight), so `floorDays(lastPaymentDate, dueDate)` is exactly
 * "floorDays(lastPaymentDate) - floorDays(dueDate)" from the spec.
 *
 * @param {{ dueDate: Date|string, lastPaymentDate?: Date|string|null, recordStatus?: string, now?: Date }} input
 * @returns {{ tone: "emerald" | "amber" | "rose" | "neutral", label: string }}
 */
export function describePaymentTiming({
  dueDate,
  lastPaymentDate,
  recordStatus,
  now = new Date(),
} = {}) {
  // 1. Cancelled transactions have no meaningful settlement timing.
  if (recordStatus === "cancelled") {
    return { tone: "neutral", label: "—" };
  }

  // 2. A row without a parseable due date cannot be judged.
  const due = coerceDate(dueDate);
  if (!due) {
    return { tone: "neutral", label: "—" };
  }

  // 3. Settled: compare the (last) payment date against the due date.
  //    An invalid lastPaymentDate is treated as "no payment" (falls through).
  const paid = coerceDate(lastPaymentDate);
  if (paid) {
    const delta = floorDays(paid, due);
    if (delta === null) {
      return { tone: "neutral", label: "—" };
    }
    if (delta <= 0) {
      return { tone: "emerald", label: "Tepat waktu" };
    }
    return { tone: "rose", label: `Telat ${delta} hari` };
  }

  // 4. Unsettled: compare the injected `now` against the due date.
  const at = coerceDate(now);
  if (!at) {
    return { tone: "neutral", label: "—" };
  }
  const overdueDays = floorDays(at, due);
  if (overdueDays === null) {
    return { tone: "neutral", label: "—" };
  }
  if (overdueDays <= 0) {
    return { tone: "neutral", label: "Belum jatuh tempo" };
  }
  return { tone: "amber", label: `Terlambat ${overdueDays} hari` };
}
