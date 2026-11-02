import { NextRequest, NextResponse } from "next/server";
import { tooMany } from "@/lib/shop/api";
import { normPhone, sendResetCode } from "@/lib/password-reset";

export const dynamic = "force-dynamic";

/** Body: { phone } - the mobile number saved on the account. Answers the same whether or not it is registered. */
export async function POST(req: NextRequest) {
  if (tooMany(req, "forgot", 5)) return NextResponse.json({ success: false, error: "Too many attempts. Please wait a minute." }, { status: 429 });
  const b = (await req.json().catch(() => null)) as { phone?: unknown } | null;
  const phone = normPhone(b?.phone);
  if (!phone) return NextResponse.json({ success: false, error: "Enter a valid 10-digit mobile number." }, { status: 400 });
  try {
    await sendResetCode(phone);
  } catch (e) {
    console.error("forgot: could not send the code", e);
    return NextResponse.json({ success: false, error: "Could not send the SMS right now. Please try again later." }, { status: 502 });
  }
  return NextResponse.json({ success: true });
}
