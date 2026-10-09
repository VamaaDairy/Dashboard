import { NextResponse, type NextRequest } from "next/server";
import { listConversations } from "@/lib/whatsapp/store";
import { requireSession } from "@/lib/whatsapp/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = await requireSession(req);
  if (denied) return denied;
  return NextResponse.json(await listConversations(req.nextUrl.searchParams.get("q") ?? ""));
}
