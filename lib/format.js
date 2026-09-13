/**
 * Shared number formatting helpers for dashboard metrics.
 * Locale is fixed to id-ID so rupiah and percentages render the way
 * Indonesian users expect (Rp 1.250.000, 82,4%).
 */

const idrFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const percentNumberFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 1,
});

/** 1250000 -> "Rp 1.250.000" */
export function formatIDR(value) {
  const amount = Number(value);
  return idrFormatter.format(Number.isFinite(amount) ? amount : 0);
}

/** 82.4 -> "82,4%" */
export function formatPercent(value) {
  const amount = Number(value);
  return `${percentNumberFormatter.format(Number.isFinite(amount) ? amount : 0)}%`;
}
