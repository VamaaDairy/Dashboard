import { NextRequest, NextResponse } from "next/server";
import { userFromToken } from "@/lib/access-server";
import { levelsFor } from "@/lib/access";

export async function GET(req: NextRequest) {
  const user = await userFromToken(req.cookies.get("session")?.value);
  if (!user) return NextResponse.json({ success: false }, { status: 401 });
  return NextResponse.json({
    success: true, email: user.email, role: user.role, name: user.name || user.email, levels: levelsFor(user),
  });
}
