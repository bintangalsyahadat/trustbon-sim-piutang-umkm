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

/**
 * Derives a short uppercase prefix from a business name.
 * One word -> first 3 letters ("Warung" -> "WAR"); multiple words -> initials ("Toko Berkah Jaya" -> "TBJ").
 */
export function businessPrefix(name) {
  const words = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "TRX";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((word) => word[0]).join("").toUpperCase();
}

/** Formats a transaction number, e.g. formatTransactionNumber(202609, 1, "TBJ") -> "TBJ/09/26/0001" */
export function formatTransactionNumber(period, sequenceNumber, prefix = "TRX") {
  const month = String(Number(period) % 100).padStart(2, "0");
  const year = String(Math.floor(Number(period) / 100) % 100).padStart(2, "0");
  const seq = String(Number(sequenceNumber) || 0).padStart(4, "0");
  return `${prefix}/${month}/${year}/${seq}`;
}
