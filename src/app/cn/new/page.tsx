import { ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ComplaintForm } from "@/components/cn/ComplaintForm";
import { listSkuOptions } from "@/lib/creditnote/data";
import { today } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function NewComplaintPage() {
  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <PageHeader icon={ClipboardCheck} title="Register a complaint" subtitle="No credit note can be raised without one." />
        <ComplaintForm today={today()} skus={await listSkuOptions()} />
      </div>
    </div>
  );
}
