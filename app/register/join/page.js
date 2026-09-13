import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AuthShell, AuthStepper } from "@/components/AuthUi";
import { JoinForm } from "./JoinForm";

export default async function RegisterJoinPage() {
  const session = await auth();
  // `resume` must reflect the AUTHORITATIVE DB status, not the stale JWT
  // `status` claim: a member removed while logged in still carries "active" in
  // their token, which would wrongly send them down the cookie-based path.
  // Mirrors the lookup in lib/session-guards.js.
  const userId = Number(session?.user?.id);
  const member = Number.isInteger(userId)
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { status: true },
      })
    : null;
  const resume = !!member && member.status !== "active";

  return (
    <AuthShell>
      <AuthStepper current={3} label="Gabung ke bisnis" />
      <JoinForm resume={resume} />
    </AuthShell>
  );
}
