"use client";

import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { formatIDR } from "@/lib/format";
import { TrustStatusBadge, RiskScoreBadge } from "@/components/dashboard/StatusBadge";

const COLUMNS = [
  { key: "name", label: "Pelanggan", sortable: true, align: "left" },
  { key: "totalCredit", label: "Kasbon Periode", sortable: true, align: "right", format: formatIDR },
  { key: "totalPaid", label: "Dibayar Periode", sortable: true, align: "right", format: formatIDR },
  { key: "outstanding", label: "Sisa Utang", sortable: true, align: "right", format: formatIDR },
  { key: "riskScore", label: "Skor Risiko", sortable: true, align: "center" },
  { key: "trustStatus", label: "Status Kepercayaan", sortable: true, align: "center" },
];

function SortIcon({ active, direction }) {
  if (!active) return <ChevronsUpDown className="w-3 h-3 text-gray-400 dark:text-gray-500" />;
  return direction === "asc" ? (
    <ChevronUp className="w-3 h-3 text-violet-500" />
  ) : (
    <ChevronDown className="w-3 h-3 text-violet-500" />
  );
}

export function ReportTable({ customers }) {
  const [sortKey, setSortKey] = useState("outstanding");
  const [sortDir, setSortDir] = useState("desc");

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const sorted = useMemo(() => {
    const copy = [...customers];
    copy.sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [customers, sortKey, sortDir]);

  if (customers.length === 0) {
    return (
      <div className="glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-md p-8 text-center text-sm text-gray-500 dark:text-gray-400">
        Tidak ada data pelanggan dalam periode ini.
      </div>
    );
  }

  return (
    <div className="mt-4 glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-white/10">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap ${
                    col.sortable ? "cursor-pointer select-none hover:text-violet-500 transition-colors" : ""
                  } ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      <SortIcon active={sortKey === col.key} direction={sortDir} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.id}
                className="border-b border-gray-100 dark:border-white/5 last:border-0 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-4 py-3 font-semibold text-gray-800 dark:text-white whitespace-nowrap">
                  {row.name}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                  {row.totalCredit > 0 ? formatIDR(row.totalCredit) : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                  {row.totalPaid > 0 ? formatIDR(row.totalPaid) : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-800 dark:text-white">
                  {row.outstanding > 0 ? formatIDR(row.outstanding) : "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  <RiskScoreBadge value={row.riskScore} trustStatus={row.trustStatus} />
                </td>
                <td className="px-4 py-3 text-center">
                  <TrustStatusBadge value={row.trustStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
