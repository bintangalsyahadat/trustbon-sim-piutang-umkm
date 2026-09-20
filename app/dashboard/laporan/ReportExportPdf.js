"use client";

/**
 * Client-side PDF export using jsPDF + jspdf-autotable.
 * Generates a multi-page PDF with business header, summary metrics,
 * and a customer detail table.
 */

export async function exportToPdf(data) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = 20;

  // ── Header ───────────────────────────────────────
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Laporan Piutang", margin, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Bisnis: ${data.businessName}`, margin, y);
  y += 6;
  doc.text(
    `Periode: ${data.period.from} s/d ${data.period.to}`,
    margin,
    y,
  );
  y += 10;

  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ── Summary section ──────────────────────────────
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("Ringkasan Metrik", margin, y);
  y += 7;

  const summaryData = [
    ["Total Kasbon Baru", `Rp ${data.summary.newCreditTotal.toLocaleString("id-ID")}`],
    ["Jumlah Transaksi", String(data.summary.newCreditCount)],
    [
      "Total Pembayaran Diterima",
      `Rp ${data.summary.paymentsReceivedTotal.toLocaleString("id-ID")}`,
    ],
    ["Jumlah Pembayaran", String(data.summary.paymentsCount)],
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
  ];

  autoTable(doc, {
    startY: y,
    head: [["Metrik", "Nilai"]],
    body: summaryData,
    theme: "grid",
    headStyles: { fillColor: [139, 92, 246], textColor: 255, fontSize: 10 },
    bodyStyles: { fontSize: 10 },
    margin: { left: margin, right: margin },
    styles: { cellPadding: 3 },
  });

  y = doc.lastAutoTable.finalY + 12;

  // ── Risk distribution ────────────────────────────
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("Distribusi Risiko", margin, y);
  y += 7;

  const riskLabels = {
    stable: "Aman",
    recovering: "Pemulihan",
    at_risk: "Risiko Tinggi",
    unrated: "Belum Dinilai",
  };

  autoTable(doc, {
    startY: y,
    head: [["Status", "Jumlah Pelanggan"]],
    body: data.riskDistribution.map((r) => [riskLabels[r.trustStatus] || r.trustStatus, String(r.count)]),
    theme: "grid",
    headStyles: { fillColor: [139, 92, 246], textColor: 255, fontSize: 10 },
    bodyStyles: { fontSize: 10 },
    margin: { left: margin, right: margin },
    styles: { cellPadding: 3 },
  });

  y = doc.lastAutoTable.finalY + 12;

  // ── Customer detail table ────────────────────────
  if (data.customers.length > 0) {
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Detail Pelanggan", margin, y);
    y += 7;

    autoTable(doc, {
      startY: y,
      head: [["Nama", "Kasbon", "Dibayar", "Sisa Utang", "Skor Risiko", "Status Kepercayaan"]],
      body: data.customers.map((c) => [
        c.name,
        `Rp ${c.totalCredit.toLocaleString("id-ID")}`,
        `Rp ${c.totalPaid.toLocaleString("id-ID")}`,
        `Rp ${c.outstanding.toLocaleString("id-ID")}`,
        c.trustStatus === "unrated" ? "—" : String(c.riskScore),
        c.trustStatus,
      ]),
      theme: "grid",
      headStyles: { fillColor: [139, 92, 246], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 28 },
        2: { cellWidth: 28 },
        3: { cellWidth: 30 },
        4: { cellWidth: 15, halign: "center" },
        5: { cellWidth: 22, halign: "center" },
      },
      margin: { left: margin, right: margin },
      styles: { cellPadding: 2.5, overflow: "linebreak" },
      didDrawPage: (hookData) => {
        // Footer on every page
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `TrustBon — ${data.businessName} — ${data.period.from} s/d ${data.period.to}`,
          margin,
          pageH - 10,
        );
      },
    });
  }

  // ── Download ─────────────────────────────────────
  const fileName = `Laporan-${data.businessName.replace(/\s+/g, "_")}-${data.period.from}_sd_${data.period.to}.pdf`;
  doc.save(fileName);
}
