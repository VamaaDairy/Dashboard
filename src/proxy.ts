import { NextRequest, NextResponse } from "next/server";
import { userFromToken } from "@/lib/access-server";
import { atLeast, firstAllowedPath, levelFor, matchPath } from "@/lib/access";

function toLogin(req: NextRequest, hadToken: boolean) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  if (hadToken) res.cookies.set("session", "", { maxAge: 0, path: "/" });
  return res;
}

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
  let user: Awaited<ReturnType<typeof userFromToken>>;
  try {
    // read from the database every time, so removing someone or changing their access bites immediately
    user = await userFromToken(token);
  } catch (e) {
    console.error("proxy: access lookup failed", e);
    return new NextResponse("Cannot reach the database right now.", { status: 503 });
  }

  if (pathname.startsWith("/login")) {
    return user ? NextResponse.redirect(new URL(firstAllowedPath(user), req.url)) : NextResponse.next();
  }
  if (!user) return toLogin(req, !!token);

  const match = matchPath(pathname);
  if (match.kind === "open") return NextResponse.next();

  // Reading needs "view"; anything else (server actions are POSTs to the page) needs "edit".
  const reading = req.method === "GET" || req.method === "HEAD";
  const allowed =
    match.kind === "owner"
      ? user.role === "owner"
      : atLeast(levelFor(user, match.key), reading ? "view" : "edit");
  if (allowed) return NextResponse.next();

  if (!reading) return new NextResponse("You do not have permission to change this.", { status: 403 });
  const home = firstAllowedPath(user);
  return NextResponse.redirect(new URL(home === pathname ? "/no-access" : home, req.url));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/data|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|ico)$).*)",
  ],
};
