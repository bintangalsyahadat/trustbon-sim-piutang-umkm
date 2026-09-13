/**
 * Edge/proxy-safe Auth.js config.
 *
 * This file must stay free of Node-only dependencies (Prisma, bcrypt) so that
 * `proxy.js` can build a lightweight NextAuth instance that only decodes the
 * session JWT. The full credentials provider is added in `auth.js`.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.businessId = user.businessId;
        token.role = user.role;
        token.status = user.status;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.businessId = token.businessId;
        session.user.role = token.role;
        // DESIGN RULE: `status` is a ROUTING HINT ONLY. It is snapshotted from the
        // JWT at sign-in and goes stale the instant an owner approves/rejects a
        // member (e.g. a freshly approved cashier still carries "pending" here).
        // NEVER make an authorization decision on it — every authorization check
        // must read the DB via `lib/session-guards.js`.
        session.user.status = token.status;
      }
      return session;
    },
  },
};

export default authConfig;
