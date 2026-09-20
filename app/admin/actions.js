"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "tb_admin_session";
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

export async function adminLoginAction(formData) {
  const password = formData.get("password");
  const expected = process.env.SUPER_ADMIN_PASSWORD;

  if (!expected || password !== expected) {
    redirect("/admin?error=1");
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, expected, {
    maxAge: COOKIE_MAX_AGE,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  redirect("/admin");
}
