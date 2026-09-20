"use server";

import { requireOwner } from "@/lib/session-guards";
import { getReportData } from "@/lib/report-data";

const GENERIC_ERROR = "Gagal memuat laporan. Silakan coba lagi.";

/**
 * Server action: fetch report data for an arbitrary date range.
 * The businessId is derived exclusively from the authenticated session.
 */
export async function fetchReport({ from, to } = {}) {
  let member;
  try {
    ({ member } = await requireOwner());
  } catch {
    return { ok: false, error: "Sesi tidak ditemukan." };
  }

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  let validFrom = null;
  let validTo = null;

  if (from && dateRe.test(from) && !Number.isNaN(Date.parse(from))) {
    validFrom = from;
  }
  if (to && dateRe.test(to) && !Number.isNaN(Date.parse(to))) {
    validTo = to;
  }

  // Default to last 30 days
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const todayStr = `${y}-${m}-${d}`;

  const defStart = new Date(now);
  defStart.setDate(defStart.getDate() - 29);
  const ds = defStart.getFullYear();
  const dm = String(defStart.getMonth() + 1).padStart(2, "0");
  const dd = String(defStart.getDate()).padStart(2, "0");
  const defaultFrom = `${ds}-${dm}-${dd}`;

  if (!validFrom) validFrom = defaultFrom;
  if (!validTo) validTo = todayStr;

  // Validate from <= to
  if (new Date(validFrom) > new Date(validTo)) {
    [validFrom, validTo] = [validTo, validFrom];
  }

  try {
    const data = await getReportData(member.businessId, {
      from: validFrom,
      to: validTo,
    });
    return { ok: true, data };
  } catch (err) {
    console.error("fetchReport error:", err);
    return { ok: false, error: GENERIC_ERROR };
  }
}
