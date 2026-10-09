import { CheckCircle2, CircleDashed, ImageIcon, Store } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PublishButton, SyncButton } from "@/components/whatsapp/SyncButton";
import { localCatalog, publicBaseUrl } from "@/lib/whatsapp/publish";
import { configStatus } from "@/lib/whatsapp/config";
import { catalogSyncedAt, inStock, listProducts, money } from "@/lib/whatsapp/store";

export const dynamic = "force-dynamic";

/** The products the assistant sells - a copy of the WhatsApp (Meta) catalog - and whether everything is wired up. */
export default async function ProductsPage() {
  const [products, syncedAt, local] = await Promise.all([listProducts(true), catalogSyncedAt(), localCatalog()]);
  const base = publicBaseUrl();
  const cfg = configStatus();

  const checks: { ok: boolean; label: string; hint: string; optional?: boolean }[] = [
    { ok: cfg.whatsapp, label: "WhatsApp Cloud API", hint: "WA_ACCESS_TOKEN and WA_PHONE_NUMBER_ID" },
    { ok: cfg.verifyToken, label: "Webhook verify token", hint: "WA_VERIFY_TOKEN - any secret string, also typed into Meta's webhook settings" },
    { ok: cfg.appSecret, label: "Webhook signature check", hint: "WA_APP_SECRET - App settings > Basic > App secret", optional: true },
    { ok: cfg.catalog, label: "Product catalog", hint: "WA_CATALOG_ID, or WA_BUSINESS_ACCOUNT_ID to find the linked one" },
    { ok: cfg.groq, label: `Groq AI (${cfg.groqModel})`, hint: "GROQ_API_KEY from console.groq.com" },
    { ok: cfg.upi || cfg.razorpay, label: `Online payment${cfg.razorpay ? " (Razorpay links)" : cfg.upi ? " (UPI)" : ""}`, hint: "SHOP_UPI_ID, or RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET (test keys)" },
    { ok: base.startsWith("https://"), label: "Public URL", hint: "PUBLIC_BASE_URL - your tunnel URL; Meta downloads product photos from it" },
    { ok: !cfg.razorpay || cfg.razorpayWebhook, label: "Razorpay webhook", hint: "RAZORPAY_WEBHOOK_SECRET, webhook URL /api/payments/razorpay", optional: true },
  ];

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader
          icon={Store}
          title="WhatsApp catalog"
          subtitle={
            <>Products come only from your WhatsApp / Meta Commerce catalog. Edit them in Commerce Manager, then sync.
              {syncedAt ? ` Last synced ${new Date(syncedAt).toLocaleString("en-IN")}.` : " Never synced."}</>
          }
          actions={<SyncButton />}
        />

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Setup</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {checks.map((c) => (
              <div key={c.label} className="flex items-start gap-2 text-sm">
                {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <CircleDashed className={`mt-0.5 h-4 w-4 shrink-0 ${c.optional ? "text-muted-foreground" : "text-destructive"}`} />}
                <div>
                  <div className="font-medium">{c.label}{c.optional ? <span className="font-normal text-muted-foreground"> (optional)</span> : null}</div>
                  {!c.ok ? <div className="text-xs text-muted-foreground">{c.hint}</div> : null}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Webhook callback URL for Meta: <code className="rounded bg-muted px-1">https://&lt;your-public-url&gt;/api/whatsapp/webhook</code> - subscribe to the <code className="rounded bg-muted px-1">messages</code> field.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Products to publish</h2>
              <p className="text-xs text-muted-foreground">
                From <code className="rounded bg-muted px-1">data/wa-catalog.json</code> with photos in <code className="rounded bg-muted px-1">public/products</code>.
                Publishing creates or updates them in your WhatsApp catalog; customers and the assistant then see them from there.
              </p>
            </div>
            <PublishButton />
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {local.map((p) => (
              <div key={p.id} className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- local product photo */}
                <img src={`/products/${p.image}`} alt={p.title} className="aspect-square w-full rounded-lg border border-border object-contain bg-white" />
                <div className="line-clamp-2 text-xs font-medium">{p.title}</div>
                <div className={`text-xs ${p.price ? "font-semibold" : "text-destructive"}`}>{p.price ? money(p.price) : "price needed"} · SKU {p.id}</div>
              </div>
            ))}
          </div>
        </div>

        <h2 className="pt-2 text-sm font-semibold">In your WhatsApp catalog</h2>
        {products.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
            {products.map((p) => (
              <div key={p.retailer_id} className={`overflow-hidden rounded-xl border border-border bg-card ${p.active ? "" : "opacity-50"}`}>
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- catalog image from Meta's CDN
                  <img src={p.image_url} alt={p.name} className="aspect-square w-full object-cover" />
                ) : <div className="flex aspect-square items-center justify-center bg-muted"><ImageIcon className="h-6 w-6 text-muted-foreground" /></div>}
                <div className="space-y-0.5 p-3">
                  <div className="line-clamp-2 text-sm font-medium">{p.name}</div>
                  <div className="text-sm font-semibold">{p.price_text ?? money(p.price, p.currency)}</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span>{p.retailer_id}</span>
                    <span className={`ml-auto ${inStock(p) ? "text-emerald-600" : "text-destructive"}`}>{p.active ? (inStock(p) ? "in stock" : p.availability) : "removed"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No products yet. Add them in Meta Commerce Manager, connect that catalog to your WhatsApp number, then press Sync.
          </div>
        )}
      </div>
    </div>
  );
}
