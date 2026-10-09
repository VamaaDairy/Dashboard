import { NextResponse, type NextRequest } from "next/server";
import { uploadMedia } from "@/lib/whatsapp/graph";
import { getContact, saveMedia, send, sendText } from "@/lib/whatsapp/store";
import { requireSession } from "@/lib/whatsapp/session";

export const dynamic = "force-dynamic";

const IMAGE_TYPES = ["image/jpeg", "image/png"];

/** A message typed (or a photo / file attached) by someone on the team. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/whatsapp/conversations/[waId]/send">) {
  const denied = await requireSession(req);
  if (denied) return denied;
  const { waId } = await ctx.params;
  if (!(await getContact(waId))) return NextResponse.json({ ok: false, error: "Unknown customer" }, { status: 404 });

  const form = await req.formData();
  const text = String(form.get("text") ?? "").trim();
  const file = form.get("file");

  if (file instanceof File && file.size) {
    const mime = file.type || "application/octet-stream";
    const isImage = IMAGE_TYPES.includes(mime);
    if (file.size > (isImage ? 5 : 15) * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: isImage ? "Photos must be under 5 MB" : "Files must be under 15 MB" }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    try {
      const metaId = await uploadMedia(bytes, mime, file.name);
      const mediaId = await saveMedia({ metaMediaId: metaId, mime, filename: file.name, bytes });
      const r = isImage
        ? await send(waId, { type: "image", image: { id: metaId, caption: text || undefined } }, { sender: "agent", mediaId, body: text })
        : await send(waId, { type: "document", document: { id: metaId, filename: file.name, caption: text || undefined } }, { sender: "agent", mediaId, body: text || file.name });
      return NextResponse.json(r, { status: r.ok ? 200 : 502 });
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
    }
  }

  if (!text) return NextResponse.json({ ok: false, error: "Nothing to send" }, { status: 400 });
  const r = await sendText(waId, text, "agent");
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}
