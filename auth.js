import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { verifyOnboardingGrant } from "@/lib/onboarding-grant";

function toSessionUser(user) {
  return {
    id: String(user.id),
    name: user.name,
    email: user.email,
    businessId: user.businessId,
    role: user.role,
    status: user.status,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        onboardingToken: { label: "Onboarding Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials) return null;

        // Auto-login right after onboarding: short-lived HMAC grant minted by
        // the onboarding server action (avoids the Next 16 server-action
        // signIn regression, #13388).
        const onboardingToken = credentials.onboardingToken;
        if (onboardingToken) {
          const grant = verifyOnboardingGrant(String(onboardingToken));
          if (!grant) return null;
          const user = await prisma.user.findUnique({
            where: { email: grant.email },
          });
          if (!user) return null;
          return toSessionUser(user);
        }

        const { email, password } = credentials;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email: String(email).trim().toLowerCase() },
        });
        if (!user) return null;

        const isValid = await bcrypt.compare(String(password), user.password);
        if (!isValid) return null;

        return toSessionUser(user);
      },
    }),
  ],
});
