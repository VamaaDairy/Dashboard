"use client";

import { useState } from "react";
import Link from "next/link";
import { saveTransporter } from "@/app/transport/actions";
import { ActionForm, Empty, Field, Section, SubmitButton, Text, THead, Th } from "@/components/tanks/ui";
import { TRANSPORT_SECTIONS } from "@/lib/transport/sections";
import type { TransportSection, TransporterRow } from "@/lib/transport/data";

/** The fields the add and edit forms share. */
function TransporterFields({ t }: { t?: TransporterRow }) {
  return (
    <>
      <Field label="Transporter name" width="w-56">
        <Text name="name" defaultValue={t?.name} placeholder="Roshni Transport" required />
      </Field>
      <Field label="Notes" width="w-64" hint={t ? undefined : "optional"}>
        <Text name="notes" defaultValue={t?.notes} />
      </Field>
      <label className="flex items-center gap-2 pb-2 text-[12px] font-semibold text-muted-foreground">
        <input type="checkbox" name="is_active" defaultChecked={t?.is_active ?? true} />
        Active
      </label>
    </>
  );
}

export function TransporterList({
  section, title, description, transporters,
}: {
  section: TransportSection;
  title: string;
  description: React.ReactNode;
  transporters: TransporterRow[];
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <Section
      title={title}
      description={description}
      actions={
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded-lg border border-border bg-white px-3 py-1.5 text-[12px] font-semibold text-foreground hover:bg-accent"
        >
          {adding ? "Cancel" : "Add transporter"}
        </button>
      }
    >
      {adding ? (
        <ActionForm
          action={saveTransporter}
          onSuccess={() => setAdding(false)}
          className="flex flex-wrap items-end gap-3 border-b border-border bg-muted/30 px-4 py-4"
        >
          <input type="hidden" name="section" value={section} />
          <TransporterFields />
          <SubmitButton>Add transporter</SubmitButton>
        </ActionForm>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <THead>
            <Th align="left">Transporter</Th>
            <Th align="left">Notes</Th>
            <Th />
          </THead>
          <tbody>
            {transporters.map((t) =>
              editing === t.id ? (
                <tr key={t.id} className="border-b border-border/70">
                  <td colSpan={3} className="p-2">
                    <ActionForm
                      action={saveTransporter}
                      onSuccess={() => setEditing(null)}
                      className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-muted/30 px-4 py-4"
                    >
                      <input type="hidden" name="id" value={t.id} />
                      <TransporterFields t={t} />
                      <SubmitButton>Save</SubmitButton>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="pb-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </ActionForm>
                  </td>
                </tr>
              ) : (
                <tr
                  key={t.id}
                  className={`border-b border-border/70 hover:bg-muted ${t.is_active ? "" : "text-muted-foreground"}`}
                >
                  <td className="px-3 py-1.5 font-semibold text-foreground">
                    {t.name}
                    {t.is_active ? null : <span className="ml-1 text-[10px] font-normal text-muted-foreground">inactive</span>}
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">{t.notes}</td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      onClick={() => setEditing(t.id)}
                      className="text-[12px] font-semibold text-muted-foreground hover:text-foreground"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ),
            )}
            {transporters.length === 0 ? <Empty colSpan={3}>No transporters yet. Add the first one above.</Empty> : null}
          </tbody>
        </table>
      </div>

      <p className="border-t border-border/70 px-4 py-2 text-[11px] text-muted-foreground">
        Km, rate and fuel cost for each transporter are on the{" "}
        <Link href={`/fuel/${TRANSPORT_SECTIONS[section].path}`} className="font-semibold text-foreground hover:underline">
          Fuel · {TRANSPORT_SECTIONS[section].label}
        </Link>{" "}
        page.
      </p>
    </Section>
  );
}
