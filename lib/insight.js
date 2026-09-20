/**
 * LLM-powered narrative insight for the Owner dashboard.
 *
 * Uses the Gemini REST API (no SDK dependency) — requires GEMINI_API_KEY in
 * .env.local.  The function is server-only (called from API routes / server
 * actions) and must never be imported into a client component.
 */

const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * @typedef {Object} InsightInput
 * @property {number} totalPiutang — total piutang aktif (Rp)
 * @property {number|null} persentaseKenaikan — % kenaikan piutang dari bulan lalu (null = no data)
 * @property {number} jumlahPelangganAtRisk — jumlah pelanggan trustStatus at_risk
 * @property {Array<{ nama: string, totalUtang: number, trustStatus: string }>} topPelangganBermasalah
 */

/**
 * Call Gemini to generate a 2-3 sentence actionable insight in Bahasa Indonesia.
 *
 * @param {InsightInput} data
 * @returns {Promise<string>} — insight text from the LLM
 */
export async function generateDashboardInsight(data) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const prompt = buildPrompt(data);

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const json = await res.json();
  const candidate = json?.candidates?.[0];
  if (!candidate) throw new Error("Gemini returned no candidates");

  // Filter out thinking parts — only keep visible text parts
  const parts = candidate.content?.parts ?? [];
  const textParts = parts.filter(
    (p) => p.text && !p.thought,
  );
  const text = textParts[0]?.text;
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  return text.trim();
}

/**
 * Build the prompt for the Gemini call.
 *
 * @param {InsightInput} data
 * @returns {string}
 */
function buildPrompt(data) {
  const lines = [
    "Kamu adalah asisten keuangan untuk pemilik UMKM. Berdasarkan data piutang berikut, buatlah ringkasan insight 2-3 kalimat dalam Bahasa Indonesia.",
    "",
    "Gaya bahasa: santai tapi informatif, seperti sedang menjelaskan ke pemilik warung yang awam angka. Gunakan angka dengan format yang mudah dibaca (contoh: Rp 1,2 juta, bukan Rp 1.200.000).",
    "",
    "Aturan:",
    "- Fokus pada hal yang bisa ditindaklanjuti (actionable).",
    "- Sebutkan angka konkret jika relevan.",
    "- Jangan gunakan istilah teknis yang rumit.",
    "- Jangan membuat data yang tidak ada dalam input.",
    "- JANGAN gunakan format markdown (heading, bold **, bullet *, numbered list). Tulis teks biasa polos.",
    "- JANGAN gunakan judul/label seperti 'Key Insights' atau 'Actionable Items'.",
    "- Pisahkan setiap kalimat dengan baris baru (newline). Maksimal 3 kalimat.",
    "",
    "Data piutang:",
    `- Total piutang aktif: Rp ${data.totalPiutang.toLocaleString("id-ID")}`,
  ];

  if (data.persentaseKenaikan !== null) {
    const direction = data.persentaseKenaikan >= 0 ? "naik" : "turun";
    lines.push(
      `- Perubahan dari bulan lalu: ${direction} ${Math.abs(data.persentaseKenaikan).toFixed(1)}%`,
    );
  } else {
    lines.push("- Perubahan dari bulan lalu: belum ada data bulan sebelumnya");
  }

  lines.push(`- Pelanggan risiko tinggi (at_risk): ${data.jumlahPelangganAtRisk}`);

  if (data.topPelangganBermasalah.length > 0) {
    lines.push("- Pelanggan bermasalah:");
    for (const p of data.topPelangganBermasalah) {
      lines.push(
        `  · ${p.nama}: utang Rp ${p.totalUtang.toLocaleString("id-ID")} (${p.trustStatus})`,
      );
    }
  }

  lines.push(
    "",
    "Ingat: tulis seperti sedang ngobrol dengan pemilik warung, bukan laporan formal. Tulis teks biasa polos tanpa format markdown.",
  );

  return lines.join("\n");
}
