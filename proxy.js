import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";

// Lightweight DB-free NextAuth instance. Proxy only performs *optimistic*
// session-cookie checks; real authorization happens in `lib/session-guards.js`
// (server components/layouts) and in the server actions. Importing `@/auth`
// here would drag Prisma/pg into the proxy bundle, so we deliberately build a
// second instance from `auth.config.js`.
const { auth: proxyAuth } = NextAuth(authConfig);

export default proxyAuth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  const isWaitingRoom =
    pathname === "/menunggu-persetujuan" ||
    pathname.startsWith("/menunggu-persetujuan/");

  // Not signed in: protect the dashboard and the waiting room.
  if (!isLoggedIn && (pathname.startsWith("/dashboard") || isWaitingRoom)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Signed in on the login page -> dashboard.
  if (isLoggedIn && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Signed in on the registration root -> dashboard.
  if (isLoggedIn && pathname === "/register") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Signed-in users may always reach the re-onboarding flow. The JWT `status`
  // claim is a STALE routing hint (snapshot from sign-in), so it must not gate
  // here: a removed member's token still says "active" until re-login, and
  // trusting it would bounce /dashboard -> /register/choice -> /dashboard in a
  // loop. Status is enforced server-side instead — `lib/session-guards.js`
  // (DB-authoritative) and the `ALREADY_ACTIVE` guard in
  // `app/actions/onboarding-resume.js`.
  if (isLoggedIn && pathname.startsWith("/register/")) {
    return NextResponse.next();
  }

  // Onboarding steps require a pending-registration cookie (set by the register
  // server action; name duplicated from lib/pending-registration).
  if (
    !isLoggedIn &&
    pathname.startsWith("/register/") &&
    !req.cookies.get("tb_pending_reg")
  ) {
    return NextResponse.redirect(new URL("/register", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/register",
    "/register/:path*",
    "/menunggu-persetujuan",
  ],
};
