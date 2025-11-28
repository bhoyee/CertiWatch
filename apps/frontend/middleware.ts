import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/signup", "/signup/success", "/login", "/magic", "/logout", "/favicon.ico", "/_next"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/"));
  const session = request.cookies.get("cw_session");
  if (session && (pathname === "/login" || pathname === "/signup" || pathname === "/magic")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (isPublic) return NextResponse.next();

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
