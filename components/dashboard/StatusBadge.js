/**
 * Status pills for dashboard tables. Tone classes mirror the badge palette
 * used across the app (account menu, coming-soon cards) so light and dark
 * mode stay consistent. Unknown values fall back to a neutral badge.
 */

const BASE_CLASSES =
  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border";

const TONE_CLASSES = {
  emerald:
    "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25",
  amber:
    "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25",
  rose:
    "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/25",
  neutral:
    "bg-gray-100 text-gray-600 border-gray-300 dark:bg-white/10 dark:text-gray-300 dark:border-white/15",
  violet:
    "bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/25",
};

export function Badge({ tone = "neutral", children }) {
  return (
    <span
      className={`${BASE_CLASSES} ${TONE_CLASSES[tone] ?? TONE_CLASSES.neutral}`}
    >
      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

// Transaction.paymentStatus (RecordStatus)
const PAYMENT_STATUS_MAP = {
  draft: { label: "Draft", tone: "neutral" },
  need_approval: { label: "Menunggu Persetujuan", tone: "amber" },
  confirmed: { label: "Terkonfirmasi", tone: "emerald" },
  cancelled: { label: "Dibatalkan", tone: "neutral" },
};

// Customer.trustStatus (TrustStatus)
const TRUST_STATUS_MAP = {
  unrated: { label: "Belum Dinilai", tone: "neutral" },
  stable: { label: "Aman", tone: "emerald" },
  recovering: { label: "Pemulihan", tone: "amber" },
  at_risk: { label: "Risiko Tinggi", tone: "rose" },
};

function fallbackConfig(value) {
  return {
    label: value ? String(value).replace(/_/g, " ") : "Tidak diketahui",
    tone: "neutral",
  };
}

export function PaymentStatusBadge({ value }) {
  const config = PAYMENT_STATUS_MAP[value] ?? fallbackConfig(value);
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

export function TrustStatusBadge({ value }) {
  const config = TRUST_STATUS_MAP[value] ?? fallbackConfig(value);
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

// Transaction.status (PaymentProgress)
const PAYMENT_PROGRESS_MAP = {
  unpaid: { label: "Belum Dibayar", tone: "rose" },
  partial: { label: "Sebagian", tone: "amber" },
  paid: { label: "Lunas", tone: "emerald" },
};

export function PaymentProgressBadge({ value }) {
  const config = PAYMENT_PROGRESS_MAP[value] ?? fallbackConfig(value);
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

// Customer.riskScore risk bands (higher score = safer): 80–100 low risk
// (emerald), 50–79 medium (amber), 0–49 high (rose). Non-finite or
// out-of-range scores render a neutral "—".
export function RiskScoreBadge({ value, trustStatus }) {
  if (trustStatus === "unrated") {
    return <Badge tone="neutral">—</Badge>;
  }
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    return <Badge tone="neutral">—</Badge>;
  }
  const rounded = Math.round(score);
  const band =
    rounded >= 80
      ? { tone: "emerald", label: "Risiko Rendah" }
      : rounded >= 50
        ? { tone: "amber", label: "Risiko Sedang" }
        : { tone: "rose", label: "Risiko Tinggi" };
  return <Badge tone={band.tone}>{`${rounded} · ${band.label}`}</Badge>;
}

