"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { deleteVehicle, saveTransporter, saveVehicle, setRouteTransporter } from "@/app/transport/actions";
import { ActionForm, DeleteButton, Empty, Field, Section, SubmitButton, Text, THead, Th } from "@/components/tanks/ui";
import { TRANSPORT_SECTIONS } from "@/lib/transport/sections";
import type { DeliveryRoute, TransportSection, TransporterRow, VehicleRow } from "@/lib/transport/data";

const linkBtn = "text-[12px] font-semibold text-muted-foreground hover:text-foreground";

/** The fields the add and edit forms share. */
function TransporterFields({ t }: { t?: TransporterRow }) {
  return (
    <>
      <Field label="Transporter name" width="w-56">
        <Text name="name" defaultValue={t?.name} placeholder="Roshni Transport" required />
      </Field>
      <Field label="Contact person" width="w-48">
        <Text name="contact_person" defaultValue={t?.contact_person} />
      </Field>
      <Field label="Phone" width="w-36">
        <Text name="phone" type="tel" defaultValue={t?.phone} placeholder="10-digit mobile" />
      </Field>
      <Field label="Other phone" width="w-36" hint="optional">
        <Text name="alt_phone" type="tel" defaultValue={t?.alt_phone} />
      </Field>
      <Field label="Address" width="w-72">
        <Text name="address" defaultValue={t?.address} />
      </Field>
      <Field label="GSTIN" width="w-44" hint="optional">
        <Text name="gstin" defaultValue={t?.gstin} />
      </Field>
      <Field label="PAN" width="w-32" hint="optional">
        <Text name="pan" defaultValue={t?.pan} />
      </Field>
      <Field label="Notes" width="w-64" hint="optional">
        <Text name="notes" defaultValue={t?.notes} />
      </Field>
      <label className="flex items-center gap-2 pb-2 text-[12px] font-semibold text-muted-foreground">
        <input type="checkbox" name="is_active" defaultChecked={t?.is_active ?? true} />
        Active
      </label>
    </>
  );
}

function VehicleFields({ v }: { v?: VehicleRow }) {
  return (
    <>
      <Field label="Vehicle number" width="w-36">
        <Text name="vehicle_no" defaultValue={v?.vehicle_no} placeholder="CG04 HQ 1234" required />
      </Field>
      <Field label="Type" width="w-40">
        <Text name="vehicle_type" defaultValue={v?.vehicle_type} placeholder="Tata 407 reefer" />
      </Field>
      <Field label="Capacity" width="w-28">
        <Text name="capacity" defaultValue={v?.capacity} placeholder="3 t" />
      </Field>
      <Field label="Driver" width="w-40">
        <Text name="driver_name" defaultValue={v?.driver_name} />
      </Field>
      <Field label="Driver's phone" width="w-36">
        <Text name="driver_phone" type="tel" defaultValue={v?.driver_phone} />
      </Field>
      <Field label="Notes" width="w-48" hint="optional">
        <Text name="notes" defaultValue={v?.notes} />
      </Field>
      <label className="flex items-center gap-2 pb-2 text-[12px] font-semibold text-muted-foreground">
        <input type="checkbox" name="active" defaultChecked={v?.active ?? true} />
        In use
      </label>
    </>
  );
}

/** One transporter's vehicles, with add / edit. */
function Vehicles({ transporterId, vehicles }: { transporterId: string; vehicles: VehicleRow[] }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vehicles</span>
        <button onClick={() => setAdding((x) => !x)} className={linkBtn}>{adding ? "Cancel" : "Add vehicle"}</button>
      </div>
      {adding ? (
        <ActionForm action={saveVehicle} resetOnSuccess onSuccess={() => setAdding(false)} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="transporter_id" value={transporterId} />
          <VehicleFields />
          <SubmitButton>Add vehicle</SubmitButton>
        </ActionForm>
      ) : null}
      {vehicles.length ? (
        <table className="w-full text-[13px]">
          <tbody>
            {vehicles.map((v) =>
              editing === v.id ? (
                <tr key={v.id}>
                  <td colSpan={6} className="py-2">
                    <ActionForm action={saveVehicle} onSuccess={() => setEditing(null)} className="flex flex-wrap items-end gap-3">
                      <input type="hidden" name="id" value={v.id} />
                      <VehicleFields v={v} />
                      <SubmitButton>Save</SubmitButton>
                      <button type="button" onClick={() => setEditing(null)} className={`pb-2 ${linkBtn}`}>Cancel</button>
                    </ActionForm>
                  </td>
                </tr>
              ) : (
                <tr key={v.id} className={`border-t border-border/60 ${v.active ? "" : "text-muted-foreground"}`}>
                  <td className="py-1.5 pr-3 font-mono font-semibold">{v.vehicle_no}{v.active ? null : <span className="ml-1 font-sans text-[10px] font-normal">not in use</span>}</td>
                  <td className="py-1.5 pr-3 text-muted-foreground">{[v.vehicle_type, v.capacity].filter(Boolean).join(" · ")}</td>
                  <td className="py-1.5 pr-3">{v.driver_name}</td>
                  <td className="py-1.5 pr-3 font-mono text-muted-foreground">{v.driver_phone}</td>
                  <td className="py-1.5 pr-3 text-muted-foreground">{v.notes}</td>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    <button onClick={() => setEditing(v.id)} className={`mr-2 ${linkBtn}`}>Edit</button>
                    <DeleteButton onDelete={() => deleteVehicle(v.id)} confirmLabel={v.vehicle_no} />
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      ) : adding ? null : <p className="text-[12px] text-muted-foreground">No vehicles yet.</p>}
    </div>
  );
}

/** What a transporter's open row shows: contact, papers, routes and vehicles - only what is filled in. */
function Details({ t, vehicles, routes }: { t: TransporterRow; vehicles: VehicleRow[]; routes?: DeliveryRoute[] }) {
  const facts: Array<[string, string | null]> = [
    ["Contact", t.contact_person], ["Phone", [t.phone, t.alt_phone].filter(Boolean).join(", ") || null],
    ["Address", t.address], ["GSTIN", t.gstin], ["PAN", t.pan], ["Notes", t.notes],
  ];
  const shown = facts.filter(([, v]) => v);
  const runs = routes?.filter((r) => r.transporter_id === t.id) ?? [];
  return (
    <div className="space-y-4 px-4 pt-1 pb-4">
      {shown.length ? (
        <dl className="grid grid-cols-1 gap-x-8 gap-y-1 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
          {shown.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="w-16 shrink-0 text-muted-foreground">{k}</dt>
              <dd className={k === "GSTIN" || k === "PAN" || k === "Phone" ? "font-mono" : ""}>{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {routes ? (
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Routes</span>
          <p className="text-[13px]">
            {runs.length ? runs.map((r) => `${r.name} (${r.outlets} outlets)`).join(" · ") : <span className="text-muted-foreground">No route yet - pick one under Routes below.</span>}
          </p>
        </div>
      ) : null}
      <Vehicles transporterId={t.id} vehicles={vehicles} />
    </div>
  );
}

/** Every route with the transporter that runs it; changing one saves at once. */
function RoutesTable({ routes, transporters }: { routes: DeliveryRoute[]; transporters: TransporterRow[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const options = transporters.filter((t) => t.is_active);
  return (
    <Section title="Routes" description="Every trip on a route goes with the transporter chosen here.">
      <div className={`overflow-x-auto ${pending ? "opacity-60" : ""}`}>
        <table className="w-full text-[13px]">
          <THead>
            <Th align="left">Route</Th>
            <Th>Outlets</Th>
            <Th align="left">Transporter</Th>
          </THead>
          <tbody>
            {routes.map((r) => (
              <tr key={r.id} className={`border-b border-border/70 ${r.active ? "" : "text-muted-foreground"}`}>
                <td className="px-3 py-1.5 font-semibold">{r.name}{r.active ? null : <span className="ml-1 text-[10px] font-normal">inactive</span>}</td>
                <td className="num px-3 py-1.5 text-right">{r.outlets}</td>
                <td className="px-3 py-1.5">
                  <select
                    value={r.transporter_id ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      start(async () => {
                        const res = await setRouteTransporter(r.id, v);
                        setError(res.ok ? null : res.error);
                      });
                    }}
                    className="w-full max-w-64 rounded-lg border border-border bg-input/30 px-2 py-1 text-[13px]"
                  >
                    <option value="">No transporter</option>
                    {options.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    {r.transporter_id && !options.some((t) => t.id === r.transporter_id)
                      ? <option value={r.transporter_id}>{transporters.find((t) => t.id === r.transporter_id)?.name ?? "Removed"} (inactive)</option>
                      : null}
                  </select>
                </td>
              </tr>
            ))}
            {routes.length === 0 ? <Empty colSpan={3}>No routes yet. They come from the Route sheet.</Empty> : null}
          </tbody>
        </table>
      </div>
      {error ? <p className="px-4 py-2 text-[12px] font-semibold text-destructive">{error}</p> : null}
    </Section>
  );
}

export function TransporterList({
  section, title, description, transporters, vehicles = [], routes,
}: {
  section: TransportSection;
  title: string;
  description: React.ReactNode;
  transporters: TransporterRow[];
  vehicles?: VehicleRow[];
  /** delivery only: the Route sheet's routes, to show and choose who runs each */
  routes?: DeliveryRoute[];
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const routeNames = (id: string) => routes?.filter((r) => r.transporter_id === id).map((r) => r.name).join(", ");
  const cols = routes ? 6 : 5;

  return (
    <div className="space-y-5">
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
              <Th align="left">Contact</Th>
              <Th align="left">Phone</Th>
              {routes ? <Th align="left">Routes</Th> : null}
              <Th>Vehicles</Th>
              <Th />
            </THead>
            <tbody>
              {transporters.map((t) => {
                const mine = vehicles.filter((v) => v.transporter_id === t.id);
                if (editing === t.id) {
                  return (
                    <tr key={t.id} className="border-b border-border/70">
                      <td colSpan={cols} className="p-2">
                        <ActionForm
                          action={saveTransporter}
                          onSuccess={() => setEditing(null)}
                          className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-muted/30 px-4 py-4"
                        >
                          <input type="hidden" name="id" value={t.id} />
                          <TransporterFields t={t} />
                          <SubmitButton>Save</SubmitButton>
                          <button type="button" onClick={() => setEditing(null)} className={`pb-2 ${linkBtn}`}>Cancel</button>
                        </ActionForm>
                      </td>
                    </tr>
                  );
                }
                const isOpen = open === t.id;
                return [
                  <tr
                    key={t.id}
                    onClick={() => setOpen(isOpen ? null : t.id)}
                    className={`cursor-pointer border-b border-border/70 hover:bg-muted ${t.is_active ? "" : "text-muted-foreground"}`}
                  >
                    <td className="px-3 py-1.5 font-semibold text-foreground">
                      <span className="inline-flex items-center gap-1">
                        {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                        {t.name}
                      </span>
                      {t.is_active ? null : <span className="ml-1 text-[10px] font-normal text-muted-foreground">inactive</span>}
                    </td>
                    <td className="px-3 py-1.5">{t.contact_person}</td>
                    <td className="px-3 py-1.5 font-mono text-muted-foreground">{t.phone}</td>
                    {routes ? <td className="px-3 py-1.5">{routeNames(t.id)}</td> : null}
                    <td className="num px-3 py-1.5 text-right">{mine.filter((v) => v.active).length || ""}</td>
                    <td className="px-3 py-1.5 text-right">
                      <button onClick={(e) => { e.stopPropagation(); setEditing(t.id); }} className={linkBtn}>Edit</button>
                    </td>
                  </tr>,
                  isOpen ? (
                    <tr key={`${t.id}-open`} className="border-b border-border/70 bg-muted/20">
                      <td colSpan={cols}><Details t={t} vehicles={mine} routes={routes} /></td>
                    </tr>
                  ) : null,
                ];
              })}
              {transporters.length === 0 ? <Empty colSpan={cols}>No transporters yet. Add the first one above.</Empty> : null}
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

      {routes ? <RoutesTable routes={routes} transporters={transporters} /> : null}
    </div>
  );
}
