"use client";

import { useRef, useState, useTransition } from "react";
import { deleteBannerAction, saveBannerAction, setBannerAction } from "@/lib/shop/actions";

export interface BannerRow {
  id: number;
  title: string;
  subtitle: string | null;
  cta: string | null;
  sku: string | null;
  bgColor: string;
  priority: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  image: string | null;
}

export interface ProductOption { sku: string; name: string; image: string | null }

const box = "h-9 rounded-lg border border-input bg-transparent px-3 text-sm";
const label = "text-xs text-muted-foreground";

/** Roughly what the phone shows (same story-card style as the app), so colour and words can be judged before saving. */
function Preview({ title, subtitle, cta, bg, poster, product }: { title: string; subtitle: string; cta: string; bg: string; poster: string | null; product: ProductOption | null }) {
  if (poster) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={poster} alt="" className="aspect-[1.9/1] w-80 rounded-2xl object-cover" />;
  }
  const deep = `color-mix(in oklab, ${bg} 72%, #0b2a66)`;
  const x = product ? 0 : 10;
  return (
    <div className="relative aspect-[1.9/1] w-80 overflow-hidden rounded-2xl text-white" style={{ background: bg }}>
      <div className="absolute inset-0" style={{ background: deep, clipPath: `polygon(100% 22%, ${60 + x}% 52%, ${53 + x}% 62%, ${57 + x}% 72%, ${74 + x}% 100%, 100% 100%)` }} />
      <div className="absolute inset-0" style={{ background: "rgba(255,255,255,0.12)", clipPath: "polygon(0 30%, 10% 0, 15% 0, 0 46%)" }} />
      {product ? (
        <div className="absolute right-[6%] top-[10%] -bottom-[20%] w-[32%] rounded-[18px] bg-[#1B1B1F] p-[3px] shadow-lg">
          <div className="flex h-full flex-col rounded-[15px] bg-white px-1.5 pt-1 text-[#1C1C1C]">
            <div className="mx-auto h-1.5 w-6 rounded bg-[#1B1B1F]" />
            {product.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image} alt="" className="mt-1 min-h-0 flex-1 object-contain" />
            ) : <div className="flex-1" />}
            <div className="line-clamp-2 text-[7px] font-semibold leading-tight">{product.name}</div>
            <div className="mb-[22%] mt-0.5 rounded bg-[#2B3990] py-px text-center text-[6px] font-bold text-white">Add to cart</div>
          </div>
        </div>
      ) : null}
      <div className={`absolute bottom-3 left-4 top-3 flex flex-col justify-center ${product ? "w-[54%]" : "w-[60%]"}`}>
        {!product ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/gaia-logo.jpg" alt="" className="mb-2 h-8 w-8 rounded-full bg-white object-contain p-0.5" />
        ) : null}
        <div className="line-clamp-3 text-[15px] font-medium leading-tight tracking-tight">{title || "Banner title"}</div>
        {subtitle ? <div className="mt-1 line-clamp-2 text-[10px] opacity-90">{subtitle}</div> : null}
        {cta ? <div className="mt-2 w-fit rounded-full bg-white px-3 py-1 text-[10px] font-bold" style={{ color: deep }}>{cta}</div> : null}
      </div>
    </div>
  );
}

/** Add a banner, or edit one when `banner` is given. */
export function BannerForm({ products, banner, onDone }: { products: ProductOption[]; banner?: BannerRow; onDone?: () => void }) {
  const [title, setTitle] = useState(banner?.title ?? "");
  const [subtitle, setSubtitle] = useState(banner?.subtitle ?? "");
  const [cta, setCta] = useState(banner?.cta ?? "");
  const [sku, setSku] = useState(banner?.sku ?? "");
  const [bg, setBg] = useState(banner?.bgColor ?? "#7EAEF5");
  const [poster, setPoster] = useState<string | null>(banner?.image ?? null);
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const product = products.find((p) => p.sku === sku) ?? null;

  return (
    <form
      ref={formRef}
      className="flex flex-wrap items-start gap-4 rounded-lg border border-border bg-background p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        start(async () => {
          const r = await saveBannerAction(data);
          if (!r.ok) return setError(r.error ?? "Could not save the banner.");
          setError("");
          if (onDone) return onDone();
          formRef.current?.reset();
          setTitle(""); setSubtitle(""); setCta(""); setSku(""); setBg("#7EAEF5"); setPoster(null);
        });
      }}
    >
      {banner ? <input type="hidden" name="id" value={banner.id} /> : null}
      <input type="hidden" name="removeImage" value={removeImage ? "1" : ""} />
      <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2" style={{ minWidth: 280 }}>
        <label className={label}>Title<input name="title" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} className={`${box} mt-1 block w-full`} placeholder="Pure Desi Ghee" /></label>
        <label className={label}>Button text<input name="cta" value={cta} maxLength={20} onChange={(e) => setCta(e.target.value)} className={`${box} mt-1 block w-full`} placeholder="Shop now" /></label>
        <label className={`${label} sm:col-span-2`}>Subtitle<input name="subtitle" value={subtitle} maxLength={100} onChange={(e) => setSubtitle(e.target.value)} className={`${box} mt-1 block w-full`} placeholder="Rich aroma, slow-cooked the traditional way" /></label>
        <label className={label}>Product (tap opens it)
          <select name="sku" value={sku} onChange={(e) => setSku(e.target.value)} className={`${box} mt-1 block w-full`}>
            <option value="">None</option>
            {products.map((p) => <option key={p.sku} value={p.sku}>{p.name}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          <label className={label}>Colour<input type="color" name="bgColor" value={bg} onChange={(e) => setBg(e.target.value)} className="mt-1 block h-9 w-14 rounded-lg border border-input" /></label>
          <label className={`${label} flex-1`}>Priority<input name="priority" type="number" defaultValue={banner?.priority ?? 50} className={`${box} mt-1 block w-full`} /></label>
        </div>
        <label className={label}>Show from<input name="startsAt" type="date" defaultValue={banner?.startsAt ?? ""} className={`${box} mt-1 block w-full`} /></label>
        <label className={label}>Show until<input name="endsAt" type="date" defaultValue={banner?.endsAt ?? ""} className={`${box} mt-1 block w-full`} /></label>
        <label className={`${label} sm:col-span-2`}>Poster image (optional, JPG/PNG/WebP under 3 MB, wide 2:1 works best - replaces the designed card)
          <input
            ref={fileRef}
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPoster(f ? URL.createObjectURL(f) : banner?.image && !removeImage ? banner.image : null);
            }}
            className="mt-1 block w-full text-sm"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <button disabled={pending} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60">{banner ? "Save banner" : "Add banner"}</button>
          {onDone ? <button type="button" onClick={onDone} className="h-9 rounded-lg border border-input px-4 text-sm hover:bg-muted">Cancel</button> : null}
          {banner?.image && poster ? (
            <button type="button" onClick={() => { setRemoveImage(true); setPoster(null); if (fileRef.current) fileRef.current.value = ""; }} className="h-9 rounded-lg border border-input px-4 text-sm hover:bg-muted">
              Remove poster
            </button>
          ) : null}
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>
      </div>
      <div>
        <div className={`${label} mb-1`}>Preview</div>
        <Preview title={title} subtitle={subtitle} cta={cta} bg={bg} poster={poster} product={product} />
      </div>
    </form>
  );
}

export function BannerActions({ banner, products }: { banner: BannerRow; products: ProductOption[] }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok && r.error) window.alert(r.error);
    });
  const btn = "h-8 rounded-lg border border-input px-3 text-sm hover:bg-muted disabled:opacity-60";
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button disabled={pending} title="Show earlier" onClick={() => run(() => setBannerAction(banner.id, { priority: banner.priority + 10 }))} className={btn}>↑</button>
        <button disabled={pending} title="Show later" onClick={() => run(() => setBannerAction(banner.id, { priority: banner.priority - 10 }))} className={btn}>↓</button>
        <button disabled={pending} onClick={() => setEditing(true)} className={btn}>Edit</button>
        <button disabled={pending} onClick={() => run(() => setBannerAction(banner.id, { active: !banner.active }))} className={btn}>{banner.active ? "Turn off" : "Turn on"}</button>
        <button
          disabled={pending}
          onClick={() => { if (window.confirm("Delete this banner?")) run(() => deleteBannerAction(banner.id)); }}
          className={`${btn} text-red-600`}
        >
          Delete
        </button>
      </div>
      {editing ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16" onClick={() => setEditing(false)}>
          <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <BannerForm products={products} banner={banner} onDone={() => setEditing(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}
