import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";

const STAFF_PUBLIC_PATHS = ["/admin/login", "/admin/set-password", "/admin/reset-password", "/admin/setup"];
const CLIENT_PUBLIC_PATHS = ["/login", "/register", "/verify-email", "/reset-password", "/"];

/**
 * Optimistic route protection (cookie-only check, no DB hit) — the real
 * authorization decision still happens server-side in the session DAL
 * (see lib/session.ts) and in each domain service via requirePermission().
 * This only exists to redirect obviously-unauthenticated visitors before
 * a page even renders.
 */
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await auth();

  if (pathname.startsWith("/admin")) {
    if (STAFF_PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
      return NextResponse.next();
    }
    if (session?.actorType !== "STAFF") {
      const url = new URL("/admin/login", request.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/portal")) {
    if (session?.actorType !== "CLIENT_CONTACT") {
      const url = new URL("/login", request.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (CLIENT_PUBLIC_PATHS.includes(pathname) && session?.actorType === "CLIENT_CONTACT") {
    if (pathname === "/login" || pathname === "/register") {
      return NextResponse.redirect(new URL("/portal", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
