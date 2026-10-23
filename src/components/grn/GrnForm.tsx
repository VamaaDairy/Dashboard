"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Upload } from "lucide-react";
import { addGrn } from "@/app/pod/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormRow, Panel } from "@/components/cn/ui";

const ctl = "h-9 border-border-control-hover bg-card md:h-8";

/** Date, invoice number, customer and the POD photo. */
export function GrnForm({ today }: { today: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    start(async () => {
      const res = await addGrn(data);
      if (!res.ok) { setError(res.error); return; }
      setError(null);
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <form ref={formRef} onSubmit={submit}>
      <Panel
        title="Add POD"
        description="Enter the date, invoice number and customer, and attach the POD image."
        flush
        footer={
          <div className="flex items-center justify-between gap-3">
            {error ? <span className="flex items-center gap-1.5 text-[13px] text-destructive"><AlertCircle className="size-4" />{error}</span> : <span />}
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Save POD
            </Button>
          </div>
        }
      >
        <div className="divide-y divide-border">
          <FormRow label="POD date" required>
            <Input name="pod_date" type="date" defaultValue={today} className={`${ctl} sm:max-w-72`} required />
          </FormRow>
          <FormRow label="Invoice no." required>
            <Input name="invoice_no" className={`${ctl} sm:max-w-72`} maxLength={60} required />
          </FormRow>
          <FormRow label="Customer name" required>
            <Input name="customer_name" className={`${ctl} sm:max-w-72`} maxLength={120} required />
          </FormRow>
          <FormRow label="POD image" required hint="JPG, PNG or WebP, up to 3 MB.">
            <Input name="image" type="file" accept="image/jpeg,image/png,image/webp" className={`${ctl} sm:max-w-72`} required />
          </FormRow>
        </div>
      </Panel>
    </form>
  );
}
