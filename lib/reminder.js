import { prisma } from "@/lib/prisma";
import { calculateRiskScore } from "@/lib/risk-score";

/**
 * Reminder system — Feature 4.8
 *
 * Generates WhatsApp reminder messages via Gemini API and sends them through
 * Fonnte. Includes a daily cron job that checks for due/overdue transactions
 * and sends reminders to the associated customers.
 */

// ─── Gemini: generate reminder message ────────────────────────────────

/**
 * Call Gemini API to generate a friendly WhatsApp reminder message in Bahasa
 * Indonesia. The tone adapts to the customer's trustStatus.
 */
export async function generateReminderMessage({
  customerName,
  amount,
  trustStatus,
  overdueDays,
}) {
  const formattedAmount = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);

  let toneInstruction;
  switch (trustStatus) {
    case "stable":
      toneInstruction =
        "Nada santai dan hangat. Pelanggan ini biasanya tepat waktu, cukup mengingatkan sekali saja dengan ramah.";
      break;
    case "recovering":
      toneInstruction =
        "Nada positif dan memberi semangat. Pelanggan ini sedang memperbaiki catatan pembayarannya, tunjukkan dukungan.";
      break;
    case "at_risk":
      toneInstruction =
        "Nada diplomatis dan tegas namun sopan. Pelanggan ini berisiko tinggi, tekankan pentingnya pembayaran tepat waktu.";
      break;
    default:
      toneInstruction =
        "Nada netral dan informatif. Pelanggan baru, belum ada histori pembayaran sebelumnya.";
  }

  const dueContext =
    overdueDays > 0
      ? `Sudah ${overdueDays} hari melewati jatuh tempo.`
      : `Akan segera jatuh tempo.`;

  const prompt = `Kamu adalah asisten pengingat piutang untuk usaha UMKM di Indonesia. Buat pesan WhatsApp singkat (maksimal 3-4 kalimat) untuk mengingatkan pelanggan tentang pembayaran kasbon.

Detail:
- Nama pelanggan: ${customerName}
- Total tagihan: ${formattedAmount}
- Kondisi: ${dueContext}
- Status kepercayaan: ${trustStatus}

Panduan nada: ${toneInstruction}

Aturan:
- Tulis dalam Bahasa Indonesia yang natural dan ramah
- Sertakan jumlah tagihan dalam pesan
- Gunakan emoji secukupnya (1-2 emoji saja)
- Jangan terlalu panjang, cukup 3-4 kalimat
- Jangan gunakan kata "kasbon" lebih dari sekali
- Langsung tulis pesannya, jangan ada prefix atau penjelasan tambahan`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
  });

  return response.text.trim();
}

// ─── Fonnte: send WhatsApp message ────────────────────────────────────

/**
 * Send a WhatsApp message via Fonnte REST API.
 */
export async function sendWhatsAppReminder({ phoneNumber, message }) {
  const token = process.env.FONNTE_TOKEN;
  if (!token) {
    return { ok: false, error: "FONNTE_TOKEN is not configured" };
  }

  const target = phoneNumber.replace(/^0/, "").replace(/^\+/, "");

  try {
    const formData = new FormData();
    formData.append("target", target);
    formData.append("message", message);
    formData.append("countryCode", "62");

    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { Authorization: token },
      body: formData,
    });

    const data = await res.json();

    if (data.status === true) {
      return { ok: true };
    }

    const errorMsg = data.reason || data.message || "Fonnte returned status false";
    console.error("[Fonnte] Send failed:", errorMsg);
    return { ok: false, error: errorMsg };
  } catch (err) {
    console.error("[Fonnte] Request error:", err.message);
    return { ok: false, error: err.message };
  }
}

// ─── Fonnte: check device connection status ───────────────────────────

export async function checkFonnteDeviceStatus() {
  const token = process.env.FONNTE_TOKEN;
  if (!token) {
    return { connected: false, error: "FONNTE_TOKEN is not configured" };
  }

  try {
    const res = await fetch("https://api.fonnte.com/device", {
      method: "GET",
      headers: { Authorization: token },
    });

    const data = await res.json();

    if (data.status === true && Array.isArray(data.data) && data.data.length > 0) {
      const device = data.data[0];
      return {
        connected: true,
        deviceName: device.device_name || device.name || "Terhubung",
      };
    }

    return { connected: false, error: "Tidak ada perangkat yang terhubung" };
  } catch (err) {
    console.error("[Fonnte] Device status check error:", err.message);
    return { connected: false, error: err.message };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Group transactions by customerId and compute per-customer aggregates:
 * total outstanding debt + max overdue days.
 */
function groupByCustomer(transactions, now) {
  const map = new Map();

  for (const tx of transactions) {
    const customer = tx.customer;
    if (!customer?.phoneNumber) continue;

    const dueDate = new Date(tx.dueDate);
    const diffMs = now.getTime() - dueDate.getTime();
    const overdueDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

    if (map.has(customer.id)) {
      const entry = map.get(customer.id);
      entry.totalDebt += Number(tx.amount);
      entry.maxOverdueDays = Math.max(entry.maxOverdueDays, overdueDays);
    } else {
      map.set(customer.id, {
        customer,
        totalDebt: Number(tx.amount),
        maxOverdueDays: overdueDays,
      });
    }
  }

  return map;
}

// ─── Send reminder to a single customer (manual trigger) ──────────────

/**
 * Generate and send a reminder to one specific customer.
 * Used by the manual trigger button on the pelanggan page.
 *
 * @param {object} params
 * @param {number} params.customerId - Customer ID
 * @param {number} params.businessId - Business ID (for authorization)
 * @returns {Promise<{ ok: boolean, sent?: boolean, error?: string }>}
 */
export async function sendReminderToCustomer({ customerId, businessId }) {
  const now = new Date();

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
    select: { id: true, name: true, phoneNumber: true, trustStatus: true },
  });

  if (!customer) {
    return { ok: false, error: "Pelanggan tidak ditemukan" };
  }

  if (!customer.phoneNumber) {
    return { ok: false, error: "Nomor telepon pelanggan belum diisi" };
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      customerId: customer.id,
      businessId,
      paymentStatus: "confirmed",
      status: { in: ["unpaid", "partial"] },
    },
    select: { amount: true, dueDate: true },
  });

  if (transactions.length === 0) {
    return { ok: false, error: "Pelanggan ini tidak memiliki utang aktif" };
  }

  let totalDebt = 0;
  let maxOverdueDays = 0;

  for (const tx of transactions) {
    totalDebt += Number(tx.amount);
    const dueDate = new Date(tx.dueDate);
    const diffMs = now.getTime() - dueDate.getTime();
    const overdueDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    maxOverdueDays = Math.max(maxOverdueDays, overdueDays);
  }

  const message = await generateReminderMessage({
    customerName: customer.name,
    amount: totalDebt,
    trustStatus: customer.trustStatus,
    overdueDays: maxOverdueDays,
  });

  const reminder = await prisma.reminder.create({
    data: { customerId: customer.id, channel: "whatsapp", deliveryStatus: "outgoing" },
  });

  const result = await sendWhatsAppReminder({
    phoneNumber: customer.phoneNumber,
    message,
  });

  if (result.ok) {
    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { deliveryStatus: "sent" },
    });
    return { ok: true, sent: true };
  }

  await prisma.reminder.update({
    where: { id: reminder.id },
    data: { deliveryStatus: "failed" },
  });

  return { ok: true, sent: false, error: result.error };
}

// ─── Daily reminder job (cron) ────────────────────────────────────────

/**
 * Process pending reminders: group transactions by customer (total utang),
 * generate messages via Gemini, send via Fonnte.
 *
 * @param {object} [options]
 * @param {number} [options.reminderWindowDays=3]
 * @returns {Promise<{ processed: number, sent: number, failed: number }>}
 */
export async function processReminders({ reminderWindowDays = 3 } = {}) {
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - reminderWindowDays);

  // Find all active businesses that have customers
  const businesses = await prisma.business.findMany({
    select: {
      id: true,
      name: true,
    },
  });

  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const business of businesses) {
    // Find transactions scoped to this business
    const transactions = await prisma.transaction.findMany({
      where: {
        businessId: business.id,
        paymentStatus: "confirmed",
        status: { in: ["unpaid", "partial"] },
        dueDate: { gte: windowStart },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            trustStatus: true,
            autoReminder: true,
          },
        },
      },
    });

    if (transactions.length === 0) continue;

    const customerMap = groupByCustomer(transactions, now);

    for (const [customerId, { customer, totalDebt, maxOverdueDays }] of customerMap) {
      // Skip customers who have disabled auto-reminder
      if (!customer.autoReminder) {
        console.log(
          `[Reminder] Skipping ${customer.name} — auto-reminder disabled`
        );
        continue;
      }

      const recentReminder = await prisma.reminder.findFirst({
        where: {
          customerId,
          sentAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
          channel: "whatsapp",
        },
        orderBy: { sentAt: "desc" },
      });

      if (recentReminder) {
        console.log(
          `[Reminder] Skipping ${customer.name} — reminder already sent within 24h`
        );
        continue;
      }

      processed++;

      try {
        const message = await generateReminderMessage({
          customerName: customer.name,
          amount: totalDebt,
          trustStatus: customer.trustStatus,
          overdueDays: maxOverdueDays,
        });

        await sleep(1000);

        const reminder = await prisma.reminder.create({
          data: { customerId, channel: "whatsapp", deliveryStatus: "outgoing" },
        });

        const result = await sendWhatsAppReminder({
          phoneNumber: customer.phoneNumber,
          message,
        });

        await sleep(1000);

        if (result.ok) {
          await prisma.reminder.update({
            where: { id: reminder.id },
            data: { deliveryStatus: "sent" },
          });
          sent++;
        } else {
          await prisma.reminder.update({
            where: { id: reminder.id },
            data: { deliveryStatus: "failed" },
          });
          failed++;
          console.error(
            `[Reminder] Failed to send to ${customer.name} (${business.name}): ${result.error}`
          );
        }
      } catch (err) {
        console.error(
          `[Reminder] Error processing ${customer.name} (${business.name}): ${err.message}`
        );
        failed++;
      }
    }
  }

  return { processed, sent, failed };
}

// ─── Daily risk-score recalculation (cron) ─────────────────────────

/**
 * Recalculate risk scores for ALL active customers that have confirmed
 * transactions in unpaid/partial status. Runs daily alongside reminders
 * (requirement 4.4) so scores decay as overdue days increase.
 *
 * @returns {Promise<{ recalculated: number, errors: number }>}
 */
export async function recalculateAllRiskScores() {
  // Find distinct customerIds that have at least one confirmed unpaid/partial tx.
  const rows = await prisma.transaction.findMany({
    where: {
      paymentStatus: "confirmed",
      status: { in: ["unpaid", "partial"] },
    },
    select: { customerId: true },
    distinct: ["customerId"],
  });

  let recalculated = 0;
  let errors = 0;

  for (const { customerId } of rows) {
    try {
      await calculateRiskScore(customerId);
      recalculated++;
    } catch (err) {
      console.error(`[RiskScore] Failed for customerId=${customerId}:`, err.message);
      errors++;
    }
  }

  return { recalculated, errors };
}
