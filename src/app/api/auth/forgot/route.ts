import { NextRequest, NextResponse } from "next/server";
import { tooMany } from "@/lib/shop/api";
import { sendResetCode } from "@/lib/password-reset";

export const dynamic = "force-dynamic";

/** Body: { email }. Texts a code to the mobile linked to the account; with no linked mobile nothing is sent. */
export async function POST(req: NextRequest) {
  if (tooMany(req, "forgot", 5)) return NextResponse.json({ success: false, error: "Too many attempts. Please wait a minute." }, { status: 429 });
  const b = (await req.json().catch(() => null)) as { email?: unknown } | null;
  const email = String(b?.email ?? "").trim();
  if (!email || email.length > 200) return NextResponse.json({ success: false, error: "Enter your email address." }, { status: 400 });
  try {
    const r = await sendResetCode(email);
    if (r.status === "no-mobile")
      return NextResponse.json({
        success: false,
        noMobile: true,
        error: "Password recovery is not possible without a mobile number linked to the account. Please contact the developer.",
      });
    return NextResponse.json({ success: true, masked: r.masked });
  } catch (e) {
    console.error("forgot: could not send the code", e);
    return NextResponse.json({ success: false, error: "Could not send the SMS right now. Please try again later." }, { status: 502 });
  }
}
