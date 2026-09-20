"use server";

import { requireActiveMember } from "@/lib/session-guards";
import { sendReminderToCustomer } from "@/lib/reminder";
import { prisma } from "@/lib/prisma";

/**
 * Send a WhatsApp reminder to a single customer (manual trigger from UI).
 * Owner-only action.
 */
export async function triggerReminder({ customerId }) {
  const { member } = await requireActiveMember();

  if (member.role !== "owner") {
    return { ok: false, error: "Hanya pemilik yang dapat mengirim pengingat." };
  }

  if (!customerId) {
    return { ok: false, error: "ID pelanggan tidak valid." };
  }

  try {
    const result = await sendReminderToCustomer({
      customerId: Number(customerId),
      businessId: member.businessId,
    });
    return result;
  } catch (err) {
    console.error("[triggerReminder] Error:", err.message);
    return { ok: false, error: "Gagal mengirim pengingat. Silakan coba lagi." };
  }
}

/**
 * Toggle auto-reminder for a specific customer. Owner-only.
 */
export async function toggleAutoReminder({ customerId, enabled }) {
  const { member } = await requireActiveMember();

  if (member.role !== "owner") {
    return { ok: false, error: "Hanya pemilik yang dapat mengubah pengaturan ini." };
  }

  if (!customerId || typeof enabled !== "boolean") {
    return { ok: false, error: "Parameter tidak valid." };
  }

  try {
    const customer = await prisma.customer.findFirst({
      where: { id: Number(customerId), businessId: member.businessId },
      select: { id: true },
    });

    if (!customer) {
      return { ok: false, error: "Pelanggan tidak ditemukan." };
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: { autoReminder: enabled },
    });

    return { ok: true };
  } catch (err) {
    console.error("[toggleAutoReminder] Error:", err.message);
    return { ok: false, error: "Gagal mengubah pengaturan. Silakan coba lagi." };
  }
}
