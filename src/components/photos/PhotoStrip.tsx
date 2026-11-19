import { photosOf, type PhotoKind } from "@/lib/photos";

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });

/**
 * The app photos of one owner (outlet, customer's delivery spot, a drop), newest first, as thumbnails that open the
 * full photo. Renders nothing when there are none: the photos are optional.
 */
export async function PhotoStrip({ kind, refId, label }: { kind: PhotoKind; refId: string | number | null | undefined; label?: string }) {
  if (refId === null || refId === undefined || refId === "") return null;
  const photos = await photosOf(kind, String(refId));
  if (!photos.length) return null;
  return (
    <div className="space-y-1.5">
      {label ? <div className="text-[12px] text-muted-foreground">{label}</div> : null}
      <div className="flex flex-wrap gap-2">
        {photos.slice(0, 8).map((p) => (
          <a key={p.id} href={`/api/photos/${p.id}`} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-lg border border-border" title={`Open the photo (${when(p.at)})`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a private photo behind the Dashboard sign-in, not a static asset */}
            <img src={`/api/photos/${p.id}`} alt={label ?? "Photo"} loading="lazy" className="h-24 w-32 object-cover transition group-hover:opacity-90" />
            <div className="bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{when(p.at)}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
