import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveDebtByCustomer } from "@/lib/customer-debt";
import { generateDashboardInsight } from "@/lib/insight";

export const dynamic = "force-dynamic";

/**
 * GET /api/insight — aggregated piutang data → Gemini → actionable insight.
 *
 * Auth: must be a signed-in owner (checked via session cookie).
 * Returns: { insight: string } or { error: string } on failure.
 */
export async function GET() {
  // --- auth gate (lightweight — reuse NextAuth session) ---
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { businessId: true, role: true },
  });
  if (!user || user.role !== "owner" || !user.businessId) {
    return NextResponse.json(
      { error: "Only owners can view insights" },
      { status: 403 },
    );
  }

  const businessId = user.businessId;

  // --- aggregate data ---
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [customers, debts, thisMonthTotal, lastMonthTotal] = await Promise.all([
    prisma.customer.findMany({
      where: { businessId },
      select: { id: true, name: true, trustStatus: true },
    }),
    getActiveDebtByCustomer(businessId),
    // Sum of confirmed transaction amounts this month
    prisma.payment.aggregate({
      where: {
        transaction: { businessId, paymentStatus: "confirmed" },
        status: "confirmed",
        paymentDate: { gte: thisMonthStart },
      },
      _sum: { amountPaid: true },
    }),
    prisma.payment.aggregate({
      where: {
        transaction: { businessId, paymentStatus: "confirmed" },
        status: "confirmed",
        paymentDate: { gte: lastMonthStart, lt: thisMonthStart },
      },
      _sum: { amountPaid: true },
    }),
  ]);

  const totalPiutang = [...debts.values()].reduce((s, v) => s + v, 0);

  const thisMonthAmount = Number(thisMonthTotal._sum.amountPaid ?? 0);
  const lastMonthAmount = Number(lastMonthTotal._sum.amountPaid ?? 0);

  let persentaseKenaikan = null;
  if (lastMonthAmount > 0) {
    persentaseKenaikan =
      ((thisMonthAmount - lastMonthAmount) / lastMonthAmount) * 100;
  }

  const atRiskCustomers = customers.filter(
    (c) => c.trustStatus === "at_risk",
  );

  // Top 3 problematic: at_risk first, then recovering, sorted by debt desc
  const topPelangganBermasalah = customers
    .filter(
      (c) =>
        c.trustStatus === "at_risk" || c.trustStatus === "recovering",
    )
    .map((c) => ({
      nama: c.name,
      totalUtang: debts.get(c.id) ?? 0,
      trustStatus: c.trustStatus,
    }))
    .sort((a, b) => b.totalUtang - a.totalUtang)
    .slice(0, 3);

  // --- call LLM ---
  try {
    const insight = await generateDashboardInsight({
      totalPiutang,
      persentaseKenaikan,
      jumlahPelangganAtRisk: atRiskCustomers.length,
      topPelangganBermasalah,
    });

    return NextResponse.json({ insight });
  } catch (err) {
    // Graceful fallback when Gemini is unavailable (key not set, API down, etc.)
    const fallback = buildFallback(totalPiutang, atRiskCustomers.length, topPelangganBermasalah);
    return NextResponse.json({ insight: fallback, fallback: true });
  }
}

/**
 * Static fallback when the LLM is unavailable — still useful and actionable.
 */
function buildFallback(totalPiutang, atRiskCount, topPelanggan) {
  const parts = [];

  if (totalPiutang > 0) {
    parts.push(
      `Total piutang aktif Anda saat ini Rp ${totalPiutang.toLocaleString("id-ID")}.`,
    );
  } else {
    parts.push("Saat ini tidak ada piutang aktif — bagus!");
  }

  if (atRiskCount > 0) {
    const names = topPelanggan
      .filter((p) => p.trustStatus === "at_risk")
      .map((p) => p.nama);
    if (names.length > 0) {
      parts.push(
        `${atRiskCount} pelanggan berisiko tinggi${names.length <= 2 ? ` (${names.join(", ")})` : ""} perlu perhatian segera.`,
      );
    } else {
      parts.push(`${atRiskCount} pelanggan berisiko tinggi perlu perhatian segera.`);
    }
  } else {
    parts.push("Semua pelanggan dalam kondisi aman.");
  }

  return parts.join(" ");
}
