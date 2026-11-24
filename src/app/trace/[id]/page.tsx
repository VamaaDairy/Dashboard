import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { one } from "@/lib/db";
import { STELLAR, explorerBase } from "@/lib/trace/stellar";
import { TraceView } from "./TraceView";
import "../trace.css";

export const dynamic = "force-dynamic";

type Head = { trace_id: string; title: string; image: string | null; name: string | null; size: string | null };

async function load(id: string): Promise<Head | null> {
  if (!/^[A-Za-z0-9._/-]{1,64}$/.test(id)) return null;
  return one<Head>(
    `select t.trace_id, t.title, l.image, l.name, nullif(concat_ws(' ', l.qty, l.unit), '') as size
       from trace_batch t left join product_label l on l.product_uid = t.product_uid
      where t.trace_id = $1`,
    [id],
  );
}

export async function generateMetadata({ params }: PageProps<"/trace/[id]">): Promise<Metadata> {
  const head = await load(decodeURIComponent((await params).id));
  return {
    title: head ? `${head.name ?? head.title} · batch check | Gaia Dairy` : "Batch check | Gaia Dairy",
    description: "Check this Gaia batch against its records on the Stellar blockchain.",
  };
}

/**
 * The public page a pack's QR opens. The product name and photo come from our catalogue; every fact
 * about the batch is read from the Stellar blockchain and the record files, and re-checked in the
 * customer's own browser - this server is not trusted for them.
 */
export default async function TracePage({ params }: PageProps<"/trace/[id]">) {
  const id = decodeURIComponent((await params).id);
  const head = await load(id);
  if (!head) notFound();

  return (
    <TraceView
      traceId={head.trace_id}
      product={{ name: head.name ?? head.title, size: head.size, image: head.image }}
      chain={{
        rpcUrl: STELLAR.rpcUrl,
        passphrase: STELLAR.passphrase,
        contractId: STELLAR.contractId,
        network: STELLAR.network,
        explorer: explorerBase(),
      }}
    />
  );
}
