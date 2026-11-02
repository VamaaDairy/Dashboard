import { NextRequest, NextResponse } from "next/server";
import { tooMany } from "@/lib/shop/api";
import { normPhone, resetPassword } from "@/lib/password-reset";

export const dynamic = "force-dynamic";

/** Body: { phone, code, password } - sets the new password when the code sent by SMS is right. */
export async function POST(req: NextRequest) {
  if (tooMany(req, "reset", 10)) return NextResponse.json({ success: false, error: "Too many attempts. Please wait a minute." }, { status: 429 });
  const b = (await req.json().catch(() => null)) as { phone?: unknown; code?: unknown; password?: unknown } | null;
  const phone = normPhone(b?.phone);
  const code = String(b?.code ?? "").trim();
  const password = String(b?.password ?? "");
  if (!phone || !/^\d{6}$/.test(code)) return NextResponse.json({ success: false, error: "Enter the 6-digit code from the SMS." }, { status: 400 });
  if (password.length < 8 || password.length > 200) return NextResponse.json({ success: false, error: "Password must be at least 8 characters." }, { status: 400 });
  const r = await resetPassword(phone, code, password);
  return r.ok ? NextResponse.json({ success: true }) : NextResponse.json({ success: false, error: r.error }, { status: 400 });
}
