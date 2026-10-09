import { NextResponse, type NextRequest } from "next/server";
import { listOrders } from "@/lib/whatsapp/store";
import { requireSession } from "@/lib/whatsapp/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = await requireSession(req);
  if (denied) return denied;
  const p = req.nextUrl.searchParams;
  return NextResponse.json(await listOrders({ status: p.get("status") ?? "", search: p.get("q") ?? "" }));
}
