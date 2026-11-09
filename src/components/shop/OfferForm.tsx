"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgePercent, Gift, IndianRupee, Minus, Plus, Search, ShoppingBasket, Tags, Package, X } from "lucide-react";
import { saveOfferAction, type OfferInput } from "@/lib/shop/offer-actions";
import { applyOffers, describeOffer, type Offer } from "@/lib/shop/offers-engine";
import { cn } from "@/lib/utils";

export interface PickProduct { sku: string; name: string; category: string; price: number; image: string | null; available: boolean }

const input = "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";
const lbl = "text-[12px] font-medium text-muted-foreground";
const inr = (n: number) => `₹${Number.isInteger(n) ? n.toLocaleString("en-IN") : n.toFixed(2)}`;

const KINDS = [
  { v: "percent", icon: BadgePercent, t: "% off", d: "A percentage off the price" },
  { v: "flat", icon: IndianRupee, t: "₹ off", d: "A fixed amount off" },
  { v: "free_item", icon: Gift, t: "Free item", d: "Buy some, get something free" },
] as const;
const SCOPES = [
  { v: "products", icon: Package, t: "Products", d: "Only the products you pick" },
  { v: "categories", icon: Tags, t: "Categories", d: "Everything in chosen categories" },
  { v: "cart", icon: ShoppingBasket, t: "Whole order", d: "The full cart" },
] as const;

function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5">
      <div className="mb-3 flex items-baseline gap-2">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{n}</span>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {hint ? <span className="text-[12px] text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Choice({ on, icon: Icon, title, desc, onClick }: { on: boolean; icon: React.ElementType; title: string; desc: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={cn("flex min-w-0 items-start gap-3 rounded-lg border p-3 text-left transition-colors", on ? "border-primary bg-primary/[0.06] ring-1 ring-primary" : "border-border hover:bg-muted/60")}>
      <Icon className={cn("mt-0.5 size-5 shrink-0", on ? "text-primary" : "text-muted-foreground")} />
      <span><span className="block text-sm font-semibold">{title}</span><span className="block text-[12px] text-muted-foreground">{desc}</span></span>
    </button>
  );
}

function Toggle({ on, onChange, title, desc }: { on: boolean; onChange: (v: boolean) => void; title: string; desc?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-1.5">
      <span><span className="block text-sm font-medium">{title}</span>{desc ? <span className="block text-[12px] text-muted-foreground">{desc}</span> : null}</span>
      <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
        className={cn("relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-foreground/20")}>
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", on ? "left-[18px]" : "left-0.5")} />
      </button>
    </label>
  );
}

/** Product picker: search, tick, and the chosen ones as removable chips. */
function ProductPicker({ products, value, onChange, single }: { products: PickProduct[]; value: string[]; onChange: (v: string[]) => void; single?: boolean }) {
  const [q, setQ] = useState("");
  const shown = products.filter((p) => !q || `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(q.toLowerCase()));
  const bySku = new Map(products.map((p) => [p.sku, p]));
  return (
    <div className="space-y-2">
      {value.length ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2.5 pr-1 text-[12px] font-medium text-primary">
              {bySku.get(s)?.name ?? s}
              <button type="button" aria-label="Remove" onClick={() => onChange(value.filter((x) => x !== s))} className="rounded-full p-0.5 hover:bg-primary/15"><X className="size-3" /></button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className={cn(input, "pl-8")} />
      </div>
      <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
        {shown.map((p) => {
          const on = value.includes(p.sku);
          return (
            <button key={p.sku} type="button" onClick={() => onChange(single ? [p.sku] : on ? value.filter((x) => x !== p.sku) : [...value, p.sku])}
              className={cn("flex w-full items-center gap-3 border-b border-border px-3 py-1.5 text-left last:border-0 hover:bg-muted/60", on && "bg-primary/[0.05]")}>
              <span className={cn("flex size-4 shrink-0 items-center justify-center border", single ? "rounded-full" : "rounded", on ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
                {on ? <span className={cn("bg-white", single ? "size-1.5 rounded-full" : "size-1.5 rounded-[1px]")} /> : null}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.image ? <img src={p.image} alt="" className="size-8 shrink-0 rounded object-contain" /> : <span className="size-8 shrink-0 rounded bg-muted" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{p.name}</span>
                <span className="block text-[11px] text-muted-foreground">{p.category} · {inr(p.price)}{p.available ? "" : " · out of stock"}</span>
              </span>
            </button>
          );
        })}
        {!shown.length ? <div className="px-3 py-6 text-center text-sm text-muted-foreground">No product matches “{q}”.</div> : null}
      </div>
    </div>
  );
}

const num = (s: string) => (s.trim() === "" ? null : Number(s));

export function OfferForm({ id, initial, products, categories }: { id: number | null; initial: OfferInput; products: PickProduct[]; categories: string[] }) {
  const router = useRouter();
  const [o, setO] = useState<OfferInput>(initial);
  const set = <K extends keyof OfferInput>(k: K, v: OfferInput[K]) => setO((x) => ({ ...x, [k]: v }));
  const [text, setText] = useState({
    percent: initial.percent?.toString() ?? "", amount: initial.amount?.toString() ?? "", maxDiscount: initial.maxDiscount?.toString() ?? "",
    buyQty: initial.buyQty?.toString() ?? "2", freeQty: initial.freeQty?.toString() ?? "1", minQty: initial.minQty ? String(initial.minQty) : "",
    minAmount: initial.minAmount ? String(initial.minAmount) : "", perCustomerLimit: initial.perCustomerLimit?.toString() ?? "", totalLimit: initial.totalLimit?.toString() ?? "",
    priority: String(initial.priority ?? 0),
  });
  const t = (k: keyof typeof text) => ({ value: text[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setText((x) => ({ ...x, [k]: e.target.value })) });
  const [freeSame, setFreeSame] = useState(!initial.freeSku);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const full: OfferInput = {
    ...o,
    percent: num(text.percent), amount: num(text.amount), maxDiscount: num(text.maxDiscount), buyQty: num(text.buyQty), freeQty: num(text.freeQty),
    minQty: num(text.minQty) ?? 0, minAmount: num(text.minAmount) ?? 0, perCustomerLimit: num(text.perCustomerLimit), totalLimit: num(text.totalLimit),
    priority: num(text.priority) ?? 0, freeSku: o.kind === "free_item" && (o.appliesTo === "cart" || !freeSame) ? o.freeSku : null,
  };
  const bySku = useMemo(() => new Map(products.map((p) => [p.sku, p])), [products]);
  const scopeName = full.appliesTo === "products"
    ? full.skus.length === 1 ? bySku.get(full.skus[0])?.name ?? "the product" : full.skus.length ? `${full.skus.length} products` : "the chosen products"
    : full.appliesTo === "categories" ? full.categories.join(" / ") || "the chosen categories" : "your order";
  const giftName = full.freeSku ? bySku.get(full.freeSku)?.name ?? "item" : full.appliesTo === "products" && full.skus.length === 1 ? bySku.get(full.skus[0])?.name ?? "item" : "of the same item";
  const summary = describeOffer({ ...full, kind: full.kind, appliesTo: full.appliesTo }, { scope: scopeName, gift: giftName });

  const save = () =>
    start(async () => {
      const r = await saveOfferAction(id, full);
      if (!r.ok) return setError(r.error);
      setError("");
      router.push("/shop-orders/offers");
      router.refresh();
    });

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="@container space-y-4">
        <Section n={1} title="Type of offer">
          <div className="grid gap-2 @lg:grid-cols-3">
            {KINDS.map((k) => <Choice key={k.v} on={o.kind === k.v} icon={k.icon} title={k.t} desc={k.d} onClick={() => set("kind", k.v)} />)}
          </div>
        </Section>

        <Section n={2} title="Applies to">
          <div className="mb-3 grid gap-2 @lg:grid-cols-3">
            {SCOPES.map((s) => <Choice key={s.v} on={o.appliesTo === s.v} icon={s.icon} title={s.t} desc={s.d} onClick={() => set("appliesTo", s.v)} />)}
          </div>
          {o.appliesTo === "products" ? <ProductPicker products={products} value={o.skus} onChange={(v) => set("skus", v)} /> : null}
          {o.appliesTo === "categories" ? (
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const on = o.categories.includes(c);
                return (
                  <button key={c} type="button" onClick={() => set("categories", on ? o.categories.filter((x) => x !== c) : [...o.categories, c])}
                    className={cn("h-8 rounded-full border px-3.5 text-sm", on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>{c}</button>
                );
              })}
            </div>
          ) : null}
        </Section>

        <Section n={3} title="Reward">
          {o.kind === "percent" ? (
            <div className="grid gap-3 @lg:grid-cols-2">
              <label className={lbl}>Discount (%)<input type="number" min={1} max={100} step="0.5" {...t("percent")} className={cn(input, "mt-1")} placeholder="10" /></label>
              <label className={lbl}>Most discount per order (₹, optional)<input type="number" min={1} {...t("maxDiscount")} className={cn(input, "mt-1")} placeholder="No limit" /></label>
            </div>
          ) : null}
          {o.kind === "flat" ? (
            <label className={cn(lbl, "block max-w-xs")}>{o.appliesTo === "cart" ? "Rupees off the order" : "Rupees off each item"}
              <input type="number" min={1} step="0.5" {...t("amount")} className={cn(input, "mt-1")} placeholder="20" />
            </label>
          ) : null}
          {o.kind === "free_item" ? (
            <div className="space-y-3">
              <div className="grid gap-3 @lg:grid-cols-2">
                {o.appliesTo !== "cart" ? <label className={lbl}>Customer buys (quantity)<input type="number" min={1} max={100} {...t("buyQty")} className={cn(input, "mt-1")} /></label> : null}
                <label className={lbl}>Gets free (quantity)<input type="number" min={1} max={20} {...t("freeQty")} className={cn(input, "mt-1")} /></label>
              </div>
              {o.appliesTo !== "cart" ? (
                <div className="grid gap-2 @lg:grid-cols-2">
                  <Choice on={freeSame} icon={Package} title="The same product" desc="Buy 2 Paneer, get 1 Paneer free" onClick={() => setFreeSame(true)} />
                  <Choice on={!freeSame} icon={Gift} title="A different product" desc="Buy 2 Paneer, get 1 Dahi free" onClick={() => setFreeSame(false)} />
                </div>
              ) : null}
              {o.appliesTo === "cart" || !freeSame ? (
                <div>
                  <div className={cn(lbl, "mb-1")}>Free product</div>
                  <ProductPicker single products={products} value={o.freeSku ? [o.freeSku] : []} onChange={(v) => set("freeSku", v[0] ?? null)} />
                </div>
              ) : null}
              {o.appliesTo !== "cart" ? <Toggle on={o.repeat} onChange={(v) => set("repeat", v)} title="Repeat" desc="Buy 4 gets 2 free, buy 6 gets 3 free… Off: once per order." /> : null}
            </div>
          ) : null}
        </Section>

        <Section n={4} title="Conditions" hint="all optional">
          <div className="grid gap-3 @lg:grid-cols-2">
            <label className={lbl}>Minimum order amount (₹){o.appliesTo !== "cart" ? " of these items" : ""}<input type="number" min={0} {...t("minAmount")} className={cn(input, "mt-1")} placeholder="None" /></label>
            <label className={lbl}>Minimum quantity{o.appliesTo !== "cart" ? " of these items" : ""}<input type="number" min={0} {...t("minQty")} className={cn(input, "mt-1")} placeholder="None" /></label>
            <label className={lbl}>Coupon code
              <input value={o.code} onChange={(e) => set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20))} className={cn(input, "mt-1 font-mono uppercase tracking-wider")} placeholder="Automatic (no code)" />
              <span className="mt-1 block text-[11px]">With a code, it applies only when the customer types it.</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={lbl}>Uses per customer<input type="number" min={1} {...t("perCustomerLimit")} className={cn(input, "mt-1")} placeholder="Any" /></label>
              <label className={lbl}>Total uses<input type="number" min={1} {...t("totalLimit")} className={cn(input, "mt-1")} placeholder="Any" /></label>
            </div>
          </div>
          <div className="mt-2 border-t border-border pt-2">
            <Toggle on={o.firstOrderOnly} onChange={(v) => set("firstOrderOnly", v)} title="First order only" desc="Only for customers who have never ordered before." />
          </div>
        </Section>

        <Section n={5} title="Schedule">
          <div className="grid gap-3 @lg:grid-cols-2">
            <label className={lbl}>Starts<input type="datetime-local" value={o.startsAt} onChange={(e) => set("startsAt", e.target.value)} className={cn(input, "mt-1")} /><span className="mt-1 block text-[11px]">Empty: right away</span></label>
            <label className={lbl}>Ends<input type="datetime-local" value={o.endsAt} onChange={(e) => set("endsAt", e.target.value)} className={cn(input, "mt-1")} /><span className="mt-1 block text-[11px]">Empty: until switched off</span></label>
          </div>
          <div className="mt-2 border-t border-border pt-2">
            <Toggle on={o.active} onChange={(v) => set("active", v)} title="Offer is on" desc="Switch off to pause it without losing the setup." />
          </div>
        </Section>

        <Section n={6} title="How customers see it">
          <div className="grid gap-3 @lg:grid-cols-[1fr_200px]">
            <label className={lbl}>Offer name<input value={o.title} maxLength={80} onChange={(e) => set("title", e.target.value)} className={cn(input, "mt-1")} placeholder="Buy 2 Paneer, get 1 Dahi free" /></label>
            <label className={lbl}>Badge on products<input value={o.badge} maxLength={24} onChange={(e) => set("badge", e.target.value.toUpperCase())} className={cn(input, "mt-1 uppercase")} placeholder="BUY 2 GET 1" /></label>
            <label className={cn(lbl, "@lg:col-span-2")}>Details / terms (optional)
              <textarea value={o.description} maxLength={500} onChange={(e) => set("description", e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" placeholder="Valid on home delivery orders. Free item added automatically." />
            </label>
            <label className={lbl}>Priority<input type="number" {...t("priority")} className={cn(input, "mt-1")} /><span className="mt-1 block text-[11px]">Higher shows first in the app</span></label>
          </div>
          <div className="mt-2 border-t border-border pt-2">
            <Toggle on={o.showInApp} onChange={(v) => set("showInApp", v)} title="Show in the app's offers list" desc="Off: it still applies, but is not advertised (good for private codes)." />
          </div>
        </Section>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Summary</div>
          <p className="text-[15px] font-semibold leading-snug">{summary}</p>
          <ul className="mt-2 space-y-0.5 text-[12px] text-muted-foreground">
            <li>{full.code ? <>Needs code <span className="font-mono font-semibold text-foreground">{full.code}</span></> : "Applies automatically"}</li>
            {full.firstOrderOnly ? <li>First order only</li> : null}
            {full.perCustomerLimit ? <li>{full.perCustomerLimit}× per customer</li> : null}
            {full.totalLimit ? <li>{full.totalLimit} uses in total</li> : null}
          </ul>
        </div>
        <AppPreview offer={full} products={products} />
        <TryIt offer={full} products={products} />
        <div className="flex items-center gap-2">
          <button type="button" onClick={save} disabled={pending} className="h-10 flex-1 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {pending ? "Saving…" : id ? "Save offer" : "Create offer"}
          </button>
          <button type="button" onClick={() => router.push("/shop-orders/offers")} className="h-10 rounded-lg border border-input px-4 text-sm hover:bg-muted">Cancel</button>
        </div>
        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p> : null}
      </aside>
    </div>
  );
}

/** Roughly how the app shows a product the offer covers: the photo with the offer ribbon. */
function AppPreview({ offer, products }: { offer: OfferInput; products: PickProduct[] }) {
  const p = offer.appliesTo === "products" ? products.find((x) => x.sku === offer.skus[0])
    : offer.appliesTo === "categories" ? products.find((x) => offer.categories.includes(x.category)) : null;
  const badge = offer.badge || (offer.kind === "percent" && offer.percent ? `${offer.percent}% OFF` : offer.kind === "flat" && offer.amount ? `₹${offer.amount} OFF` : offer.kind === "free_item" ? "FREE GIFT" : "OFFER");
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">In the app</div>
      <div className="flex gap-3">
        {p ? (
          <div className="w-32 shrink-0 overflow-hidden rounded-2xl border border-[#E8E2D2] bg-[#FBF7EC]">
            <div className="relative aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.image ? <img src={p.image} alt="" className="size-full object-contain p-2" /> : null}
              <span className="absolute left-0 top-2 rounded-r-md bg-[#1E8E3E] px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-white">{badge}</span>
            </div>
            <div className="px-2 pb-2 text-[10px] font-semibold leading-tight text-[#1C1C1C]">{p.name}<div className="mt-0.5 text-[11px] font-extrabold">{inr(p.price)}</div></div>
          </div>
        ) : null}
        <div className="min-w-0 flex-1 rounded-2xl bg-gradient-to-br from-[#2F3992] to-[#1d2466] p-3 text-white">
          <div className="inline-block rounded bg-white/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wider">{badge}</div>
          <div className="mt-1.5 text-[13px] font-semibold leading-tight">{offer.title || "Offer name"}</div>
          {offer.code ? <div className="mt-2 inline-block rounded border border-dashed border-white/60 px-1.5 py-0.5 font-mono text-[10px]">USE {offer.code}</div> : null}
        </div>
      </div>
    </div>
  );
}

/** Build a cart and see exactly what the server would give for it (same engine as the orders). */
function TryIt({ offer, products }: { offer: OfferInput; products: PickProduct[] }) {
  const [cart, setCart] = useState<Array<{ sku: string; qty: number }>>([]);
  const [pick, setPick] = useState("");
  const bySku = new Map(products.map((p) => [p.sku, p]));
  const asOffer: Offer = {
    ...offer, id: 1, badge: offer.badge || null, description: offer.description || null, code: offer.code || null, active: true,
    startsAt: null, endsAt: null, perCustomerLimit: null, totalLimit: null, firstOrderOnly: false,
  };
  const items = cart.flatMap((l) => {
    const p = bySku.get(l.sku);
    return p ? [{ sku: p.sku, name: p.name, category: p.category, price: p.price, qty: l.qty, image: p.image }] : [];
  });
  const gifts = new Map(products.map((p) => [p.sku, { sku: p.sku, name: p.name, price: p.price, image: p.image }]));
  const q = items.length ? applyOffers(items, [asOffer], { now: new Date(), code: offer.code, firstOrder: true, usedByCustomer: new Map(), usedTotal: new Map(), gifts }) : null;
  const add = (sku: string) => {
    if (!sku) return;
    setCart((c) => (c.some((l) => l.sku === sku) ? c.map((l) => (l.sku === sku ? { ...l, qty: Math.min(20, l.qty + 1) } : l)) : [...c, { sku, qty: 1 }]));
    setPick("");
  };
  const suggest = offer.appliesTo === "products" ? offer.skus : offer.appliesTo === "categories" ? products.filter((p) => offer.categories.includes(p.category)).slice(0, 4).map((p) => p.sku) : products.slice(0, 3).map((p) => p.sku);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Try it on a cart</span>
        {cart.length ? <button type="button" onClick={() => setCart([])} className="text-[12px] text-muted-foreground hover:text-foreground">Clear</button> : null}
      </div>
      <select value={pick} onChange={(e) => add(e.target.value)} className={input}>
        <option value="">Add a product…</option>
        {[...suggest.map((s) => bySku.get(s)).filter(Boolean), ...products.filter((p) => !suggest.includes(p.sku))].map((p) => <option key={p!.sku} value={p!.sku}>{p!.name} · {inr(p!.price)}</option>)}
      </select>
      {q ? (
        <div className="mt-3 space-y-1.5 text-sm">
          {q.lines.map((l) => (
            <div key={l.sku} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{l.name}</span>
              <span className="inline-flex items-center rounded-md border border-border">
                <button type="button" aria-label="Less" onClick={() => setCart((c) => c.flatMap((x) => (x.sku === l.sku ? (x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : []) : [x])))} className="p-1 hover:bg-muted"><Minus className="size-3" /></button>
                <span className="num w-5 text-center text-[12px]">{l.qty}</span>
                <button type="button" aria-label="More" onClick={() => add(l.sku)} className="p-1 hover:bg-muted"><Plus className="size-3" /></button>
              </span>
              <span className="num w-16 text-right">{l.discount ? <><s className="mr-1 text-[11px] text-muted-foreground">{inr(l.gross)}</s>{inr(l.total)}</> : inr(l.gross)}</span>
            </div>
          ))}
          {q.free.map((f) => (
            <div key={f.sku} className="flex items-center gap-2 text-[#1E8E3E]">
              <Gift className="size-3.5" /><span className="min-w-0 flex-1 truncate">{f.name} × {f.qty}</span><span className="font-semibold">FREE</span>
            </div>
          ))}
          <div className="mt-2 space-y-0.5 border-t border-border pt-2 text-[13px]">
            <div className="flex justify-between text-muted-foreground"><span>Items</span><span className="num">{inr(q.subtotal)}</span></div>
            {q.discount ? <div className="flex justify-between text-[#1E8E3E]"><span>Offer discount</span><span className="num">−{inr(q.discount)}</span></div> : null}
            <div className="flex justify-between font-semibold"><span>Customer pays</span><span className="num">{inr(q.subtotal - q.discount)}</span></div>
          </div>
          {!q.applied.length ? <p className="rounded-md bg-muted px-2 py-1.5 text-[12px] text-muted-foreground">{q.hints[0] ?? q.codeMessage ?? "This cart does not get the offer yet."}</p> : null}
        </div>
      ) : <p className="mt-2 text-[12px] text-muted-foreground">Add products to see the discount and free items this offer gives.</p>}
    </div>
  );
}
