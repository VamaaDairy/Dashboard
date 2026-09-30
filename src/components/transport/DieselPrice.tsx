"use client";

import { useState } from "react";
import { addDieselPrice } from "@/app/transport/actions";
import { ActionForm, Field, Section, SubmitButton, Text } from "@/components/tanks/ui";
import { formatNumber } from "@/lib/format";
import type { DieselPriceRow } from "@/lib/transport/data";

/**
 * The one diesel price every diesel-paid transporter is charged at, in both
 * sections. A new price applies from its date on; earlier days keep theirs.
 */
export function DieselPrice({ prices, today }: { prices: DieselPriceRow[]; today: string }) {
  const [adding, setAdding] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // prices arrive newest first
  const current = prices.find((p) => p.effective_from <= today);
  const upcoming = prices.filter((p) => p.effective_from > today).at(-1);

  return (
    <Section
      title="Diesel price"
      description="What a litre of diesel costs the plant. Every transporter paid by diesel used - in both Milk to plant and Delivery - is charged at this. When the price changes, add the new one with the date it starts from."
      actions={
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="text-[12px] font-semibold text-muted-foreground hover:text-foreground"
          >
            History ({prices.length})
          </button>
          <button
            onClick={() => setAdding((v) => !v)}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-[12px] font-semibold text-foreground hover:bg-accent"
          >
            {adding ? "Cancel" : "New price"}
          </button>
        </div>
      }
    >
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-4 py-3">
        {current ? (
          <>
            <span className="num text-[20px] font-black text-foreground">₹ {formatNumber(current.price_per_litre, 2)}</span>
            <span className="text-[12px] text-muted-foreground">per litre, since {current.effective_from}</span>
          </>
        ) : (
          <span className="text-[13px] font-semibold text-amber-700">No diesel price yet - add one.</span>
        )}
        {upcoming ? (
          <span className="text-[12px] text-muted-foreground">
            ₹ {formatNumber(upcoming.price_per_litre, 2)} from {upcoming.effective_from}
          </span>
        ) : null}
      </div>

      {adding ? (
        <ActionForm
          action={addDieselPrice}
          onSuccess={() => setAdding(false)}
          className="flex flex-wrap items-end gap-3 border-t border-border bg-muted/30 px-4 py-4"
        >
          <Field label="Applies from" width="w-40">
            <Text name="effective_from" type="date" defaultValue={today} required />
          </Field>
          <Field label="₹ per litre" width="w-32">
            <Text name="price_per_litre" placeholder="101.56" required />
          </Field>
          <Field label="Notes" width="w-56" hint="optional">
            <Text name="notes" />
          </Field>
          <SubmitButton>Add price</SubmitButton>
          <p className="w-full text-[11px] text-muted-foreground">
            Days before this date keep the old price. Diesel days already entered from this date on are re-costed.
          </p>
        </ActionForm>
      ) : null}

      {showHistory ? (
        <table className="mx-4 mb-3 text-[12px]">
          <tbody>
            {prices.map((p) => (
              <tr key={p.id}>
                <td className="py-0.5 pr-6 text-muted-foreground">from {p.effective_from}</td>
                <td className="num py-0.5 pr-6 text-right font-semibold">₹ {formatNumber(p.price_per_litre, 2)} / L</td>
                <td className="py-0.5 text-muted-foreground">{p.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </Section>
  );
}
