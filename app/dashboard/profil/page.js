import { requireActiveMember } from "@/lib/session-guards";
import { ProfileForms } from "./ProfileForms";

export const metadata = {
  title: "Profil — TrustBon",
};

export default async function ProfilPage() {
  const { member } = await requireActiveMember();

  return (
    <div className="max-w-5xl mx-auto animate-fadeIn">
      <ProfileForms initialName={member.name} initialEmail={member.email} />
    </div>
  );
}
