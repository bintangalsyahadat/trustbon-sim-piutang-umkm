"use client";

/**
 * Client-side Excel export using SheetJS (xlsx).
 * Generates a styled .xlsx with two sheets: Ringkasan and Detail Pelanggan.
 */

export async function exportToExcel(data) {
  const XLSX = await import("xlsx");

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Ringkasan ──────────────────────────
  const summaryRows = [
    ["LAPORAN PIUTANG"],
    [`Bisnis: ${data.businessName}`],
    [`Periode: ${data.period.from} s/d ${data.period.to}`],
    [],
    ["METRIK PERIODE"],
    ["Total Kasbon Baru", data.summary.newCreditTotal],
    ["Jumlah Transaksi", data.summary.newCreditCount],
    ["Total Pembayaran Diterima", data.summary.paymentsReceivedTotal],
    ["Jumlah Pembayaran", data.summary.paymentsCount],
    [
      "Tingkat Kolektibilitas",
      data.summary.collectibilityRate !== null
        ? `${data.summary.collectibilityRate.toFixed(1)}%`
        : "—",
    ],
    [
      "Rata-rata Keterlambatan",
      data.summary.avgDaysLate !== null
        ? `${Math.round(data.summary.avgDaysLate)} hari`
        : "—",
    ],
    [],
    ["DISTRIBUSI RISIKO"],
    ["Status", "Jumlah"],
    ...data.riskDistribution.map((r) => [r.trustStatus, r.count]),
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary["!cols"] = [{ wch: 30 }, { wch: 20 }];

  XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");

  // ── Sheet 2: Detail Pelanggan ───────────────────
  const header = [
    "Nama Pelanggan",
    "Kasbon Periode",
    "Dibayar Periode",
    "Sisa Utang",
    "Risk Score",
    "Trust Status",
  ];
  const rows = data.customers.map((c) => [
    c.name,
    c.totalCredit,
    c.totalPaid,
    c.outstanding,
    c.trustStatus === "unrated" ? "Belum Dinilai" : c.riskScore,
    c.trustStatus,
  ]);

  const wsDetail = XLSX.utils.aoa_to_sheet([header, ...rows]);
  wsDetail["!cols"] = [
    { wch: 25 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    { wch: 15 },
  ];

  XLSX.utils.book_append_sheet(wb, wsDetail, "Detail Pelanggan");

  // ── Download ────────────────────────────────────
  const fileName = `Laporan-${data.businessName.replace(/\s+/g, "_")}-${data.period.from}_sd_${data.period.to}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
