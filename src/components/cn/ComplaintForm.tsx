"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Link2, Loader2 } from "lucide-react";
import { registerComplaint, type RegisterInput } from "@/app/cn/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pick } from "@/components/cn/fields";
import { FormRow, Panel } from "@/components/cn/ui";
import { SkuPicker } from "@/components/creditnote/SkuPicker";
import { CATEGORIES, CUSTOMER_TYPES, QTY_UNITS } from "@/lib/cn/sop";
import type { SkuOption } from "@/lib/creditnote/data";

const ctl = "h-9 border-border-control-hover bg-card md:h-8";

/** The complaint form: everything the SOP asks for at registration, including the evidence link. */
export function ComplaintForm({ today, skus }: { today: string; skus: SkuOption[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [v, setV] = useState<RegisterInput>({
    complaint_date: today, customer_name: "", customer_type: "", region: "", contact_no: "", invoice_no: "", invoice_date: "",
    product_name: "", batch_no: "", qty_affected: "", qty_unit: "Pcs", category: "", description: "", evidence_url: "", claim_value: "",
  });
  const set = (patch: Partial<RegisterInput>) => setV((x) => ({ ...x, ...patch }));

  const input = (key: keyof RegisterInput, o: { type?: string; placeholder?: string; className?: string } = {}) => (
    <Input className={`${ctl} ${o.className ?? ""}`} type={o.type ?? "text"} value={v[key]} placeholder={o.placeholder} onChange={(e) => set({ [key]: e.target.value })} />
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await registerComplaint(v);
      if (!res.ok) { setError(res.error); return; }
      setError(null);
      router.push(`/cn/${res.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5 pb-20">
      <Panel title="Customer" description="Who is complaining. A complaint number is generated when you submit." flush>
        <div className="divide-y divide-border">
          <FormRow label="Complaint date" required>{input("complaint_date", { type: "date", className: "sm:max-w-48" })}</FormRow>
          <FormRow label="Customer name" required>{input("customer_name")}</FormRow>
          <FormRow label="Customer type" required>
            <Pick className="sm:max-w-64" value={v.customer_type} onChange={(x) => set({ customer_type: x })} options={CUSTOMER_TYPES} />
          </FormRow>
          <FormRow label="Depot / region">{input("region", { className: "sm:max-w-64" })}</FormRow>
          <FormRow label="Contact no.">{input("contact_no", { className: "sm:max-w-64" })}</FormRow>
        </div>
      </Panel>

      <Panel title="Product & invoice" description="The invoice the goods were sold on, and what was affected." flush>
        <div className="divide-y divide-border">
          <FormRow label="Invoice no." required>{input("invoice_no", { className: "sm:max-w-64" })}</FormRow>
          <FormRow label="Invoice date">{input("invoice_date", { type: "date", className: "sm:max-w-48" })}</FormRow>
          <FormRow label="Product" required hint="Search the SKU list or pick from it.">
            <SkuPicker skus={skus} value={v.product_name} onChange={(p) => set({ product_name: p })} />
          </FormRow>
          <FormRow label="Batch no.">{input("batch_no", { className: "sm:max-w-64" })}</FormRow>
          <FormRow label="Quantity affected" required>
            <div className="flex gap-2 sm:max-w-64">
              {input("qty_affected", { className: "num" })}
              <div className="w-28 shrink-0"><Pick value={v.qty_unit} onChange={(x) => set({ qty_unit: x })} options={QTY_UNITS} /></div>
            </div>
          </FormRow>
        </div>
      </Panel>

      <Panel title="Complaint" description="A photo or video of the product is mandatory." flush>
        <div className="divide-y divide-border">
          <FormRow label="Complaint type" required>
            <Pick className="sm:max-w-64" value={v.category} onChange={(x) => set({ category: x })} options={CATEGORIES} />
          </FormRow>
          <FormRow label="Description" required hint="What happened, in the customer's words where possible.">
            <Textarea className="min-h-24 border-border-control-hover bg-card" value={v.description} onChange={(e) => set({ description: e.target.value })} />
          </FormRow>
          <FormRow label="Claim value" required hint="What the customer is asking to be credited.">
            <div className="relative sm:max-w-48">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-tertiary-foreground">₹</span>
              {input("claim_value", { className: "num pl-6" })}
            </div>
          </FormRow>
          <FormRow label="Photo / video link" required hint="Drive, WhatsApp share or any link that opens the evidence.">
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-tertiary-foreground" />
              {input("evidence_url", { placeholder: "https://…", className: "pl-8" })}
            </div>
          </FormRow>
        </div>
      </Panel>

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-border-destructive bg-destructive/5 px-3 py-2.5 text-[13px] text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/90 px-4 py-3 backdrop-blur md:sticky md:inset-x-auto md:bottom-4 md:rounded-lg md:border md:shadow-md">
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-2">
          <Link href="/cn" className={buttonVariants({ variant: "ghost" })}>Cancel</Link>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? <><Loader2 className="size-4 animate-spin" /> Registering…</> : "Register complaint"}
          </Button>
        </div>
      </div>
    </form>
  );
}
