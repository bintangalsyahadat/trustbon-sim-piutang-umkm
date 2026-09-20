import { processReminders } from "@/lib/reminder";

/**
 * Cron-triggered API route for daily WhatsApp reminders.
 *
 * Deploy as a Vercel Cron Job or trigger externally (e.g. curl, external scheduler).
 * Add to vercel.json:
 *   { "crons": [{ "path": "/api/cron/reminders", "schedule": "0 8 * * *" }] }
 *
 * For local testing: GET /api/cron/reminders
 *
 * To protect this endpoint in production, set CRON_SECRET in .env and pass
 * it as a header: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request) {
  // Optional: verify cron secret in production
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processReminders();
    console.log(
      `[Cron Reminders] Processed: ${result.processed}, Sent: ${result.sent}, Failed: ${result.failed}`
    );
    return Response.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Cron Reminders] Error:", err.message);
    return Response.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
