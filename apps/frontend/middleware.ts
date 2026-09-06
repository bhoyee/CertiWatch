import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PLATFORM_PUBLIC = ["/platform/login", "/platform/magic"];
const PUBLIC_PATHS = ["/", "/signup", "/signup/success", "/login", "/magic", "/logout", "/upload", "/terms", "/privacy", "/favicon.ico", "/icon.svg", "/_next", ...PLATFORM_PUBLIC];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/"));
  const session = request.cookies.get("cw_session");
  // If already logged in and hitting tenant login/signup/magic, send to dashboard
  if (session && (pathname === "/login" || pathname === "/signup" || pathname === "/magic")) {
    return NextResponse.redirect(new URL("/analytics", request.url));
  }
  // If already logged in and hitting platform auth pages, send to platform home
  if (session && (pathname === "/platform/login" || pathname.startsWith("/platform/magic"))) {
    return NextResponse.redirect(new URL("/platform/tenants", request.url));
  }
  if (isPublic) return NextResponse.next();

  // Platform pages should bounce to platform login when unauthenticated
  if (pathname.startsWith("/platform")) {
    if (!session) {
      const loginUrl = new URL("/platform/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"]
};
