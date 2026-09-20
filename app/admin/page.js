import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkFonnteDeviceStatus } from "@/lib/reminder";
import { prisma } from "@/lib/prisma";
import { AdminLogin } from "./AdminLogin";
import { AdminDashboard } from "./AdminDashboard";
import { adminLoginAction } from "./actions";

const COOKIE_NAME = "tb_admin_session";

export const metadata = { title: "Admin — TrustBon" };

export default async function AdminPage({ searchParams }) {
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!password) {
    redirect("/");
  }

  const params = await searchParams;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value;
  const authenticated = sessionToken === password;

  if (!authenticated) {
    return <AdminLogin error={params?.error === "1"} onSubmit={adminLoginAction} />;
  }

  // Fetch all stats in parallel
  const [fonnteStatus, activeUserCount, activeBusinessCount] = await Promise.all([
    checkFonnteDeviceStatus(),
    prisma.user.count({ where: { status: "active" } }),
    prisma.business.count({
      where: {
        users: { some: { status: "active" } },
      },
    }),
  ]);

  return (
    <AdminDashboard
      fonnteConnected={fonnteStatus.connected}
      fonnteDeviceName={fonnteStatus.deviceName}
      fonnteError={fonnteStatus.error}
      activeUserCount={activeUserCount}
      activeBusinessCount={activeBusinessCount}
    />
  );
}
