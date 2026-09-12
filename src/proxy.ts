import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get("session")?.value;
  const session = token ? await verifySession(token) : null;

  if (pathname.startsWith("/login")) {
    return session ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  }

  if (!session) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    if (token) res.cookies.set("session", "", { maxAge: 0, path: "/" });
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/data|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|ico)$).*)",
  ],
};
