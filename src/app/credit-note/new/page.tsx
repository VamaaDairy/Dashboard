import { ReceiptText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { CreditNoteForm } from "@/components/creditnote/CreditNoteForm";
import { today } from "@/lib/dates";
import { listSkuOptions } from "@/lib/creditnote/data";

export const dynamic = "force-dynamic";

export default async function NewCreditNotePage() {
  const skus = await listSkuOptions();
  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <PageHeader icon={ReceiptText} title="New credit note" subtitle="It starts as Pending until someone approves or rejects it." />
        <CreditNoteForm today={today()} skus={skus} />
      </div>
    </div>
  );
}
