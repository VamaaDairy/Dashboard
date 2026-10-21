import { NextRequest, NextResponse } from "next/server";
import { tooMany } from "@/lib/shop/api";
import { mailConfigured } from "@/lib/mailer";
import { normEmail, sendResetCode, validEmail } from "@/lib/password-reset";

export const dynamic = "force-dynamic";

/** Body: { email } - the recovery email on the profile. Answers the same whether or not it is registered. */
export async function POST(req: NextRequest) {
  if (tooMany(req, "forgot", 5)) return NextResponse.json({ success: false, error: "Too many attempts. Please wait a minute." }, { status: 429 });
  const b = (await req.json().catch(() => null)) as { email?: unknown } | null;
  const email = normEmail(b?.email);
  if (!validEmail(email)) return NextResponse.json({ success: false, error: "Enter a valid email address." }, { status: 400 });
  if (!mailConfigured()) return NextResponse.json({ success: false, error: "Email is not set up on this server yet. Please contact the administrator." }, { status: 503 });
  try {
    await sendResetCode(email);
  } catch (e) {
    console.error("forgot: could not send the code", e);
    return NextResponse.json({ success: false, error: "Could not send the email right now. Please try again later." }, { status: 502 });
  }
  return NextResponse.json({ success: true });
}
