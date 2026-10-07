import { NextRequest, NextResponse } from "next/server";
import { AUTH_NOT_CONFIGURED, createSession } from "@/lib/auth";
import { getUserByEmail, verifyPassword } from "@/lib/users";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ success: false, error: "Email and password required" }, { status: 400 });
  }

  // a missing or unreachable database shouldn't look like a wrong password or a network blip
  let user: Awaited<ReturnType<typeof getUserByEmail>>;
  try {
    user = await getUserByEmail(email);
  } catch (e) {
    console.error("login: database lookup failed", e);
    return NextResponse.json(
      { success: false, error: "Can't reach the database right now. If this is a new deployment, check that DATABASE_URL is set and redeploy." },
      { status: 503 },
    );
  }
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
  }

  let token: string;
  try {
    token = await createSession(user.id, user.email, user.role);
  } catch {
    return NextResponse.json({ success: false, error: AUTH_NOT_CONFIGURED }, { status: 503 });
  }
  const res = NextResponse.json({ success: true, name: user.name, role: user.role });
  res.cookies.set("session", token, {
    httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: "lax",
    secure: process.env.NODE_ENV === "production",   // only over HTTPS on the live site
  });
  return res;
}
