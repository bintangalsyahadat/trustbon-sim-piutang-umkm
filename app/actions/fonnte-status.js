"use server";

import { checkFonnteDeviceStatus } from "@/lib/reminder";
import { requireOwner } from "@/lib/session-guards";

/**
 * Server action: check Fonnte connection status.
 * Only accessible by the business owner.
 *
 * @returns {Promise<{ ok: boolean, connected: boolean, deviceName?: string, configured: boolean }>}
 */
export async function getFonnteStatus() {
  await requireOwner();

  const configured = !!process.env.FONNTE_TOKEN;

  if (!configured) {
    return { ok: true, connected: false, configured: false };
  }

  const status = await checkFonnteDeviceStatus();
  return {
    ok: true,
    connected: status.connected,
    configured: true,
    deviceName: status.deviceName,
    error: status.error,
  };
}
