/**
 * Dummy domain data for the role-based dashboards.
 *
 * Identity (member, business name) is real — these getters only stand in for
 * the transaction/customer metrics until the data layer is wired up. They are
 * synchronous on purpose: server components can call them without await, and
 * swapping in real Prisma queries later only touches this module.
 *
 * All money values are raw IDR numbers — format them with `@/lib/format`.
 * Enum strings mirror prisma/schema.prisma (RecordStatus, TrustStatus).
 */

export function getCashierDashboardData() {
  return {
    todayTransactionCount: 14,
    todayNewCreditTotal: 2350000,
    todayPaymentsReceived: 1875000,
    recentTransactions: [
      {
        id: "TRX-1042",
        customerName: "Ibu Sari Wulandari",
        amount: 150000,
        paymentStatus: "confirmed",
      },
      {
        id: "TRX-1041",
        customerName: "Pak Budi Santoso",
        amount: 275000,
        paymentStatus: "draft",
      },
      {
        id: "TRX-1040",
        customerName: "Ibu Ratna Kusuma",
        amount: 90000,
        paymentStatus: "confirmed",
      },
      {
        id: "TRX-1039",
        customerName: "Pak Andi Prasetyo",
        amount: 420000,
        paymentStatus: "cancelled",
      },
      {
        id: "TRX-1038",
        customerName: "Ibu Dewi Lestari",
        amount: 185000,
        paymentStatus: "draft",
      },
    ],
  };
}

export function getOwnerDashboardData() {
  return {
    totalActiveReceivables: 18750000,
    activeCustomers: 42,
    highRiskCustomers: 3,
    onTimePaymentPercent: 82.4,
    insights: [
      {
        id: "insight-on-time",
        text: "Pembayaran tepat waktu naik menjadi 82,4% minggu ini — mayoritas pelanggan melunasi kasbon sebelum jatuh tempo.",
      },
      {
        id: "insight-overdue",
        text: "3 pelanggan sudah melewati jatuh tempo lebih dari 7 hari; pertimbangkan mengirim pengingat WhatsApp hari ini.",
      },
    ],
    attention: [
      {
        id: 1,
        customerName: "Pak Andi Prasetyo",
        outstandingAmount: 1250000,
        trustStatus: "at_risk",
      },
      {
        id: 2,
        customerName: "Ibu Rina Marlina",
        outstandingAmount: 680000,
        trustStatus: "recovering",
      },
      {
        id: 3,
        customerName: "Pak Joko Susilo",
        outstandingAmount: 450000,
        trustStatus: "recovering",
      },
    ],
  };
}
