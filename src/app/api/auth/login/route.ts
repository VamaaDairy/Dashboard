import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { getUserByEmail, verifyPassword } from "@/lib/users";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ success: false, error: "Email and password required" }, { status: 400 });
  }

  const user = await getUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createSession(user.id, user.email, user.role);
  const res = NextResponse.json({ success: true, name: user.name, role: user.role });
  res.cookies.set("session", token, {
    httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: "lax",
  });
  return res;
}
