/**
 * TrustBon AI chatbot — server-only helpers.
 *
 * Wraps the Gemini SDK (@google/genai) to answer questions strictly about the
 * user's own business data (customers, active debts, recent transactions,
 * risk). Uses the same lazy dynamic-import pattern as lib/reminder.js.
 *
 * This module must never be imported into a client component.
 */

import { formatIDR } from "@/lib/format";

const GEMINI_MODEL = "gemini-3.5-flash-lite";

/**
 * Strict scope system prompt. The assistant must only answer questions about
 * the business data supplied below it, and must refuse everything else.
 */
const CHAT_SYSTEM_PROMPT = `Kamu adalah Asisten Data Bisnis TrustBon.

PERAN KAMU:
- Menjawab pertanyaan HANYA tentang data bisnis pengguna yang tersedia di bawah
- Data yang tersedia: daftar pelanggan, utang/piutang aktif, transaksi terakhir, risiko pelanggan, ringkasan bisnis

BATASAN KETAT:
- JANGAN menjawab pertanyaan di luar data bisnis (coding, pengetahuan umum, dll)
- Jika ditanya sesuatu di luar data bisnis, jawab: "Maaf, saya hanya bisa membantu menjawab pertanyaan tentang data piutang dan pelanggan bisnis Anda."
- JANGAN menghasilkan kode, menjelaskan konsep programming, atau menjawab pertanyaan teknis
- JANGAN menjawab pertanyaan tentang topik umum, berita, atau hal lain yang tidak terkait data bisnis

GAYA BAHASA:
- Bahasa Indonesia, santai tapi profesional
- Jawab singkat dan langsung pada intinya
- Gunakan angka dengan format Rp yang mudah dibaca (contoh: Rp 1,2 juta)
- Jangan gunakan format markdown (heading, bold, bullet). Tulis teks biasa polos.`;

/**
 * @typedef {Object} BusinessContextData
 * @property {string}  [businessName]
 * @property {string}  [ownerName]
 * @property {number}  [totalPiutang]
 * @property {number}  [jumlahPelangganAktif]
 * @property {number}  [jumlahAtRisk]
 * @property {Array<{ nama: string, trustStatus: string, riskScore: number, utang: number }>} [pelanggan]
 * @property {Array<{ periode: string, nama: string, jumlah: number, jatuhTempo: string, status: string }>} [transaksiTerakhir]
 */

/**
 * Formats the aggregated business data into a readable plain-text block that
 * is injected into the chatbot's system instruction.
 *
 * @param {BusinessContextData} contextData
 * @returns {string}
 */
export function buildBusinessContext(contextData = {}) {
  const {
    businessName = "-",
    ownerName = "-",
    totalPiutang = 0,
    jumlahPelangganAktif = 0,
    jumlahAtRisk = 0,
    pelanggan = [],
    transaksiTerakhir = [],
  } = contextData;

  const lines = [
    `Nama usaha: ${businessName}`,
    `Nama pemilik: ${ownerName}`,
    `Total piutang aktif: ${formatIDR(totalPiutang)}`,
    `Jumlah pelanggan aktif: ${jumlahPelangganAktif}`,
    `Jumlah pelanggan berisiko tinggi (at_risk): ${jumlahAtRisk}`,
    "",
    "Daftar pelanggan:",
  ];

  if (pelanggan.length > 0) {
    for (const p of pelanggan) {
      lines.push(
        `- ${p.nama}: utang ${formatIDR(p.utang)} · status ${p.trustStatus} · skor risiko ${p.riskScore}`,
      );
    }
  } else {
    lines.push("- (belum ada pelanggan)");
  }

  lines.push("", "Transaksi terakhir:");

  if (transaksiTerakhir.length > 0) {
    for (const t of transaksiTerakhir) {
      lines.push(
        `- ${t.periode} · ${t.nama} · ${formatIDR(t.jumlah)} · jatuh tempo ${t.jatuhTempo} · status ${t.status}`,
      );
    }
  } else {
    lines.push("- (belum ada transaksi)");
  }

  return lines.join("\n");
}

/**
 * @typedef {Object} ChatMessage
 * @property {"user" | "model"} role
 * @property {string} content
 */

/**
 * Call Gemini to generate the chatbot's reply, grounded in the supplied
 * business context and the prior conversation turns.
 *
 * @param {string} businessContext — output of buildBusinessContext()
 * @param {ChatMessage[]} conversationHistory
 * @returns {Promise<string>} — the assistant's reply text
 */
export async function generateChatReply(businessContext, conversationHistory) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const history = Array.isArray(conversationHistory) ? conversationHistory : [];
  const contents = history
    .filter((m) => m && typeof m.content === "string" && m.content.length > 0)
    .map((m) => ({
      role: m.role === "model" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  if (contents.length === 0) {
    throw new Error("conversationHistory is empty");
  }

  const systemInstruction = `${CHAT_SYSTEM_PROMPT}

=== DATA BISNIS PENGGUNA ===
${businessContext}`;

  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: {
      systemInstruction,
      temperature: 0.4,
      maxOutputTokens: 1024,
    },
  });

  // Filter out thinking parts — only keep visible text parts.
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const textParts = parts.filter((p) => p.text && !p.thought);
  const text = textParts[0]?.text;
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  return text.trim();
}
