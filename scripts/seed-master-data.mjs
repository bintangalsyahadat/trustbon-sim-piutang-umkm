#!/usr/bin/env node
/**
 * Seed master data untuk demonstrasi TCC.
 *
 * Membuat 8 pelanggan, 18 transaksi, dan 9 payment records
 * dengan skenario beragam (lunas tepat waktu, telat, partial, draft, need_approval, cancelled).
 *
 * Idempotent: jika sudah ada ≥ 8 pelanggan untuk business pertama, script akan skip.
 *
 * SAFETY: Semua nomor HP menggunakan format 0800-XXXX-XXX (nomor bebas pulsa)
 * dan autoReminder: false agar sistem reminder otomatis tidak mengirim pesan.
 *
 * Usage:
 *   node scripts/seed-master-data.mjs
 */

import net from "node:net";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

const require = createRequire(import.meta.url);

if (typeof net.setDefaultAutoSelectFamily === "function") {
  net.setDefaultAutoSelectFamily(false);
}

const dotenv = require("dotenv");
dotenv.config({ path: join(ROOT, ".env") });

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const pg = require("pg");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("FATAL: DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString, max: 5 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(12, 0, 0, 0);
  return d;
}

function daysAgo(days) {
  return daysFromNow(-days);
}

async function main() {
  console.log("Seed master data: Toko Sembako untuk TCC\n");

  const business = await prisma.business.findFirst({
    orderBy: { id: "asc" },
    select: { id: true, name: true, inviteCode: true },
  });

  if (!business) {
    console.error("FATAL: Tidak ada business di database. Jalankan onboarding terlebih dahulu.");
    process.exit(1);
  }

  console.log(`Business: ${business.name} (ID: ${business.id}, Kode: ${business.inviteCode})`);

  const existingCustomers = await prisma.customer.count({
    where: { businessId: business.id },
  });

  if (existingCustomers >= 8) {
    console.log(`\nSKIP: Sudah ada ${existingCustomers} pelanggan untuk business ini.`);
    console.log("Seed data sudah dijalankan sebelumnya. Tidak ada yang diubah.");
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log(`\nMemulai seed... (${existingCustomers} pelanggan existing)`);

  const period = new Date().getFullYear() * 100 + (new Date().getMonth() + 1);

  // ─── 1. Customers ──────────────────────────────────────────────────

  console.log("\n1. Membuat pelanggan...");

  const customerData = [
    { name: "Budi Santoso",   phoneNumber: "08001234001", creditLimit: 300000, autoReminder: false },
    { name: "Siti Rahayu",    phoneNumber: "08001234002", creditLimit: 150000, autoReminder: false },
    { name: "Ahmad Fauzi",    phoneNumber: "08001234003", creditLimit: 100000, autoReminder: false },
    { name: "Dewi Lestari",   phoneNumber: "08001234004", creditLimit: 200000, autoReminder: false },
    { name: "Rudi Hermawan",  phoneNumber: "08001234005", creditLimit: 250000, autoReminder: false },
    { name: "Ratna Sari",     phoneNumber: "08001234006", creditLimit: 150000, autoReminder: false },
    { name: "Hendra Wijaya",  phoneNumber: "08001234007", creditLimit: 200000, autoReminder: false },
    { name: "Maya Putri",     phoneNumber: "08001234008", creditLimit: 100000, autoReminder: false },
  ];

  const customers = [];
  for (const data of customerData) {
    const c = await prisma.customer.create({
      data: {
        businessId: business.id,
        trustStatus: "unrated",
        riskScore: 50,
        ...data,
      },
    });
    customers.push(c);
    console.log(`  ✓ ${c.name} (ID: ${c.id}, Limit: Rp ${c.creditLimit.toLocaleString("id-ID")})`);
  }

  // ─── 2. Transactions ───────────────────────────────────────────────

  console.log("\n2. Membuat transaksi...");

  const B = customers.map((c) => c.id);

  const transactionData = [
    // Budi Santoso (B[0]) — 3 transaksi
    { customerId: B[0], period, sequenceNumber: 1,  amount: 98000,  transactionDate: daysAgo(15), dueDate: daysFromNow(-5),  paymentStatus: "confirmed",     status: "paid",  note: "Beras 5kg, Minyak 1liter, Gula 1kg" },
    { customerId: B[0], period, sequenceNumber: 2,  amount: 65000,  transactionDate: daysAgo(7),  dueDate: daysFromNow(7),   paymentStatus: "confirmed",     status: "paid",  note: "Beras 5kg × 1" },
    { customerId: B[0], period, sequenceNumber: 3,  amount: 55000,  transactionDate: daysAgo(2),  dueDate: daysFromNow(12),  paymentStatus: "confirmed",     status: "unpaid", note: "Mie instan 1 dus kecil" },

    // Siti Rahayu (B[1]) — 2 transaksi
    { customerId: B[1], period, sequenceNumber: 4,  amount: 83000,  transactionDate: daysAgo(20), dueDate: daysAgo(5),       paymentStatus: "confirmed",     status: "paid",  note: "Deterjen 1kg, Gula 1kg, Kecap manis 1 botol" },
    { customerId: B[1], period, sequenceNumber: 5,  amount: 43000,  transactionDate: daysAgo(3),  dueDate: daysFromNow(10),  paymentStatus: "confirmed",     status: "partial", note: "Telur 1kg, Kopi bubuk 1 bungkus" },

    // Ahmad Fauzi (B[2]) — 3 transaksi + 1 draft
    { customerId: B[2], period, sequenceNumber: 6,  amount: 100000, transactionDate: daysAgo(25), dueDate: daysAgo(10),      paymentStatus: "confirmed",     status: "paid",  note: "Gas elpiji 3kg × 3, Sabun batang × 5" },
    { customerId: B[2], period, sequenceNumber: 7,  amount: 55000,  transactionDate: daysAgo(12), dueDate: daysAgo(3),       paymentStatus: "confirmed",     status: "unpaid", note: "Mie instan 1 dus kecil" },
    { customerId: B[2], period, sequenceNumber: 8,  amount: 40000,  transactionDate: daysAgo(5),  dueDate: daysFromNow(9),   paymentStatus: "confirmed",     status: "unpaid", note: "Gula 1kg, Teh celup 1 kotak" },

    // Dewi Lestari (B[3]) — 0 transaksi (pelanggan baru)

    // Rudi Hermawan (B[4]) — 2 transaksi
    { customerId: B[4], period, sequenceNumber: 9,  amount: 180000, transactionDate: daysAgo(10), dueDate: daysFromNow(4),   paymentStatus: "confirmed",     status: "paid",  note: "Beras 10kg, Minyak 2liter, Gas elpiji 3kg × 2" },
    { customerId: B[4], period, sequenceNumber: 10, amount: 120000, transactionDate: daysAgo(6),  dueDate: daysFromNow(8),   paymentStatus: "confirmed",     status: "partial", note: "Deterjen 1kg × 2, Gula 1kg × 3" },

    // Ratna Sari (B[5]) — 2 transaksi + 1 cancelled
    { customerId: B[5], period, sequenceNumber: 11, amount: 130000, transactionDate: daysAgo(18), dueDate: daysAgo(4),       paymentStatus: "confirmed",     status: "unpaid", note: "Beras 5kg, Minyak 2liter, Kopi bubuk 1 bungkus" },
    { customerId: B[5], period, sequenceNumber: 12, amount: 75000,  transactionDate: daysAgo(8),  dueDate: daysFromNow(6),   paymentStatus: "confirmed",     status: "unpaid", note: "Gas elpiji 3kg × 2, Teh celup 1 kotak" },

    // Hendra Wijaya (B[6]) — 2 transaksi
    { customerId: B[6], period, sequenceNumber: 13, amount: 95000,  transactionDate: daysAgo(14), dueDate: daysAgo(1),       paymentStatus: "confirmed",     status: "partial", note: "Beras 5kg, Minyak 1liter, Gula 1kg" },
    { customerId: B[6], period, sequenceNumber: 14, amount: 60000,  transactionDate: daysAgo(4),  dueDate: daysFromNow(10),  paymentStatus: "confirmed",     status: "paid",  note: "Mie instan 1, Sabun batang × 5, Kecap manis 1" },

    // Maya Putri (B[7]) — 1 transaksi
    { customerId: B[7], period, sequenceNumber: 15, amount: 33000,  transactionDate: daysAgo(1),  dueDate: daysFromNow(13),  paymentStatus: "confirmed",     status: "unpaid", note: "Mie instan 1 bungkus, Minyak goreng 1liter" },

    // Special cases
    { customerId: B[0], period, sequenceNumber: 16, amount: 150000, transactionDate: daysAgo(1),  dueDate: daysFromNow(13),  paymentStatus: "need_approval", status: "unpaid", note: "Beras 5kg × 2, Gas elpiji 3kg × 3" },
    { customerId: B[2], period, sequenceNumber: 17, amount: 25000,  transactionDate: daysAgo(0),  dueDate: daysFromNow(14),  paymentStatus: "draft",         status: "unpaid", note: "Kopi bubuk 1 bungkus, Teh celup 1 kotak" },
    { customerId: B[5], period, sequenceNumber: 18, amount: 65000,  transactionDate: daysAgo(2),  dueDate: daysFromNow(12),  paymentStatus: "cancelled",     status: "unpaid", note: "Beras 5kg (dibatalkan: stok habis)" },
  ];

  const transactions = [];
  for (const data of transactionData) {
    const tx = await prisma.transaction.create({
      data: {
        businessId: business.id,
        ...data,
      },
    });
    transactions.push(tx);
    const cust = customers.find((c) => c.id === data.customerId);
    console.log(`  ✓ Tx#${tx.id} ${cust.name} — Rp ${data.amount.toLocaleString("id-ID")} (${data.paymentStatus}/${data.status})`);
  }

  // ─── 3. Payments ───────────────────────────────────────────────────

  console.log("\n3. Membuat payment records...");

  const paymentData = [
    { transactionId: transactions[0].id,  amountPaid: 98000,  paymentDate: daysAgo(5) },
    { transactionId: transactions[1].id,  amountPaid: 65000,  paymentDate: daysAgo(3) },
    { transactionId: transactions[3].id,  amountPaid: 83000,  paymentDate: daysAgo(2) },
    { transactionId: transactions[4].id,  amountPaid: 25000,  paymentDate: daysAgo(1) },
    { transactionId: transactions[5].id,  amountPaid: 100000, paymentDate: daysAgo(3) },
    { transactionId: transactions[8].id,  amountPaid: 180000, paymentDate: daysAgo(1) },
    { transactionId: transactions[9].id,  amountPaid: 60000,  paymentDate: daysAgo(2) },
    { transactionId: transactions[12].id, amountPaid: 45000,  paymentDate: daysAgo(2) },
    { transactionId: transactions[13].id, amountPaid: 60000,  paymentDate: daysAgo(1) },
  ];

  const payments = [];
  for (const data of paymentData) {
    const pay = await prisma.payment.create({
      data: { ...data, status: "confirmed" },
    });
    payments.push(pay);
    const tx = transactions.find((t) => t.id === data.transactionId);
    const cust = customers.find((c) => c.id === tx.customerId);
    console.log(`  ✓ Payment#${pay.id} — Rp ${data.amountPaid.toLocaleString("id-ID")} untuk ${cust.name}`);
  }

  // ─── 4. Recalculate risk scores ────────────────────────────────────

  console.log("\n4. Menghitung ulang skor risiko...");

  const { computeRiskScore } = await import("../lib/risk-score-core.js");

  const customersWithTx = [...new Set(transactions.map((t) => t.customerId))];

  for (const custId of customersWithTx) {
    const customer = await prisma.customer.findUnique({ where: { id: custId } });
    const custTxs = await prisma.transaction.findMany({
      where: { customerId: custId, paymentStatus: "confirmed" },
      include: { payments: { where: { status: "confirmed" } } },
    });

    if (custTxs.length === 0) continue;

    const normalized = custTxs.map((tx) => ({
      id: tx.id,
      amount: Number(tx.amount),
      dueDate: tx.dueDate,
      transactionDate: tx.transactionDate,
      status: tx.status,
      payments: tx.payments.map((p) => ({
        id: p.id,
        amountPaid: Number(p.amountPaid),
        paymentDate: p.paymentDate,
      })),
    }));

    const { riskScore, trustStatus } = computeRiskScore({
      transactions: normalized,
      creditLimit: Number(customer.creditLimit),
      customerCreatedAt: customer.createdAt,
    });

    await prisma.$transaction([
      prisma.customer.update({ where: { id: custId }, data: { riskScore, trustStatus } }),
      prisma.scoreHistory.create({ data: { customerId: custId, score: riskScore, trustStatus } }),
    ]);

    const cust = customers.find((c) => c.id === custId);
    console.log(`  ✓ ${cust.name}: score=${riskScore}, status=${trustStatus}`);
  }

  // ─── Summary ───────────────────────────────────────────────────────

  console.log("\n" + "=".repeat(60));
  console.log("SEED DATA BERHASIL!");
  console.log("=".repeat(60));
  console.log(`\nBusiness: ${business.name} (${business.inviteCode})`);
  console.log(`Pelanggan: ${customers.length}`);
  console.log(`Transaksi: ${transactions.length}`);
  console.log(`Payment records: ${payments.length}`);
  console.log(`\nSkenario yang tercakup:`);
  console.log(`  ✓ 3 pelanggan dengan transaksi lunas`);
  console.log(`  ✓ 2 pelanggan dengan transaksi partial`);
  console.log(`  ✓ 2 pelanggan dengan transaksi unpaid`);
  console.log(`  ✓ 1 pelanggan baru tanpa transaksi`);
  console.log(`  ✓ 1 transaksi need_approval (melebihi limit)`);
  console.log(`  ✓ 1 transaksi draft (belum dikonfirmasi)`);
  console.log(`  ✓ 1 transaksi cancelled (dibatalkan)`);
  console.log(`\n⚠️  SEMUA pelanggan autoReminder: false (aman dari reminder otomatis)`);
  console.log(`⚠️  SEMUA nomor HP: 0800-XXXX-XXX (nomor bebas pulsa, tidak akan terkirim)`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
