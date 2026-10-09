import { NextResponse, type NextRequest } from "next/server";
import { getMedia } from "@/lib/whatsapp/store";
import { requireSession } from "@/lib/whatsapp/session";

/** A stored WhatsApp photo or file, for the dashboard only. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/whatsapp/media/[id]">) {
  const denied = await requireSession(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const media = /^\d+$/.test(id) ? await getMedia(Number(id)) : null;
  if (!media) return new NextResponse("Not found", { status: 404 });
  const download = req.nextUrl.searchParams.has("download");
  const filename = (media.filename ?? `whatsapp-${id}`).replace(/[^\w.\- ]/g, "_");
  return new NextResponse(new Uint8Array(media.bytes), {
    headers: {
      "Content-Type": media.mime,
      "Cache-Control": "private, max-age=86400, immutable",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'",
    },
  });
}
