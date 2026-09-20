"use client";

import { useTheme } from "next-themes";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { formatIDR } from "@/lib/format";

const PIE_COLORS = ["#10b981", "#f59e0b", "#f43f5e", "#9ca3af"];
const PIE_LABELS = {
  stable: "Aman",
  recovering: "Pemulihan",
  at_risk: "Risiko Tinggi",
  unrated: "Belum Dinilai",
};

function TooltipPayload(label, value, name) {
  return (
    <div className="glass-card rounded-xl border border-white/30 dark:border-white/10 px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-gray-800 dark:text-white mb-1">{label}</p>
      <p className="text-gray-600 dark:text-gray-300">
        {name}: <span className="font-semibold">{formatIDR(value)}</span>
      </p>
    </div>
  );
}

function BarTooltipPayload(label, payload) {
  return (
    <div className="glass-card rounded-xl border border-white/30 dark:border-white/10 px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-gray-800 dark:text-white mb-1">{label}</p>
      {payload?.map((entry, i) => (
        <p key={i} className="text-gray-600 dark:text-gray-300">
          {entry.name}:{" "}
          <span className="font-semibold">{formatIDR(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

function ChartCard({ children }) {
  return (
    <div className="glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-md p-5 sm:p-6">
      {children}
    </div>
  );
}

export function ReportCharts({ trend }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const textColor = isDark ? "#9ca3af" : "#6b7280";

  return (
    <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Line chart: active receivables over time */}
      <ChartCard>
        <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-4">
          Piutang Aktif
        </h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart
            data={trend.labels.map((label, i) => ({
              name: label,
              value: trend.activeReceivables[i],
            }))}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: textColor }}
              interval="preserveStartEnd"
              minTickGap={30}
            />
            <YAxis
              tick={{ fontSize: 10, fill: textColor }}
              tickFormatter={(v) =>
                v >= 1_000_000
                  ? `${(v / 1_000_000).toFixed(1)}jt`
                  : v >= 1_000
                    ? `${(v / 1_000).toFixed(0)}rb`
                    : v
              }
              width={50}
            />
            <Tooltip
              content={({ label, payload }) =>
                TooltipPayload(label, payload?.[0]?.value, "Piutang aktif")
              }
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={isDark ? "#a78bfa" : "#8b5cf6"}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: isDark ? "#a78bfa" : "#8b5cf6" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Bar chart: new credit vs payments */}
      <ChartCard>
        <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-4">
          Kasbon Baru vs Pembayaran
        </h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={trend.labels.map((label, i) => ({
              name: label,
              "Kasbon Baru": trend.newCredit[i],
              Pembayaran: trend.payments[i],
            }))}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: textColor }}
              interval="preserveStartEnd"
              minTickGap={30}
            />
            <YAxis
              tick={{ fontSize: 10, fill: textColor }}
              tickFormatter={(v) =>
                v >= 1_000_000
                  ? `${(v / 1_000_000).toFixed(1)}jt`
                  : v >= 1_000
                    ? `${(v / 1_000).toFixed(0)}rb`
                    : v
              }
              width={50}
            />
            <Tooltip content={({ label, payload }) => BarTooltipPayload(label, payload)} />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              iconType="circle"
              iconSize={8}
            />
            <Bar
              dataKey="Kasbon Baru"
              fill={isDark ? "#a78bfa" : "#8b5cf6"}
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
            <Bar
              dataKey="Pembayaran"
              fill={isDark ? "#34d399" : "#10b981"}
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
