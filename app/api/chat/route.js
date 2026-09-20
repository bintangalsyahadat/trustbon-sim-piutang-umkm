import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveDebtByCustomer } from "@/lib/customer-debt";
import { buildBusinessContext, generateChatReply } from "@/lib/chat";
import { businessPrefix, formatTransactionNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const FALLBACK_REPLY =
  "Maaf, asisten AI sedang tidak tersedia. Coba lagi dalam beberapa saat.";

/**
 * POST /api/chat — aggregated business data + conversation → Gemini → reply.
 *
 * Auth: any signed-in member of a business (owner AND cashier).
 * Body: { messages: Array<{ role: "user" | "model", content: string }> }
 * Returns: { reply: string }. LLM failures degrade gracefully to a 200 fallback.
 */
export async function POST(request) {
  // --- auth gate (lightweight — reuse NextAuth session) ---
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(session.user.id) },
    select: { businessId: true },
  });
  if (!user?.businessId) {
    return NextResponse.json(
      { error: "Akun tidak terhubung ke bisnis" },
      { status: 403 },
    );
  }

  const businessId = user.businessId;

  // --- validate request body ---
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Format permintaan tidak valid" },
      { status: 400 },
    );
  }

  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "messages harus berupa array dan tidak boleh kosong" },
      { status: 400 },
    );
  }

  const conversationHistory = messages
    .filter(
      (m) => m && typeof m.content === "string" && m.content.trim().length > 0,
    )
    .map((m) => ({
      role: m.role === "model" ? "model" : "user",
      content: m.content,
    }));

  if (conversationHistory.length === 0) {
    return NextResponse.json(
      { error: "messages tidak boleh kosong" },
      { status: 400 },
    );
  }

  // --- aggregate business context (available to both owner and cashier) ---
  const [business, customers, debts, recentTransactions] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, ownerName: true },
    }),
    prisma.customer.findMany({
      where: { businessId },
      select: { id: true, name: true, trustStatus: true, riskScore: true },
    }),
    getActiveDebtByCustomer(businessId),
    prisma.transaction.findMany({
      where: { businessId },
      orderBy: [{ period: "desc" }, { sequenceNumber: "desc" }],
      take: 5,
      select: {
        period: true,
        sequenceNumber: true,
        amount: true,
        dueDate: true,
        status: true,
        customer: { select: { name: true } },
      },
    }),
  ]);

  const totalPiutang = [...debts.values()].reduce((sum, v) => sum + v, 0);
  const jumlahAtRisk = customers.filter(
    (c) => c.trustStatus === "at_risk",
  ).length;
  const prefix = businessPrefix(business?.name);

  const contextData = {
    businessName: business?.name ?? "-",
    ownerName: business?.ownerName ?? "-",
    totalPiutang,
    jumlahPelangganAktif: customers.length,
    jumlahAtRisk,
    pelanggan: customers.map((c) => ({
      nama: c.name,
      trustStatus: c.trustStatus,
      riskScore: c.riskScore,
      utang: debts.get(c.id) ?? 0,
    })),
    transaksiTerakhir: recentTransactions.map((tx) => ({
      periode: formatTransactionNumber(tx.period, tx.sequenceNumber, prefix),
      nama: tx.customer.name,
      jumlah: Number(tx.amount),
      jatuhTempo: dateFormatter.format(tx.dueDate),
      status: tx.status,
    })),
  };

  // --- call LLM ---
  try {
    const context = buildBusinessContext(contextData);
    const reply = await generateChatReply(context, conversationHistory);

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[Chat] Gemini call failed:", err?.message ?? err);
    const msg = String(err?.message ?? "");
    const reply =
      msg.includes("429") ||
      msg.includes("RESOURCE_EXHAUSTED") ||
      msg.includes("quota")
        ? "Maaf, kuota AI harian sudah habis. Coba lagi besok."
        : FALLBACK_REPLY;
    return NextResponse.json({ reply });
  }
}
