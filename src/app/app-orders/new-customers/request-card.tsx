"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FirmRequest } from "@/lib/distributor/requests";
import { cn } from "@/lib/utils";
import { approveRequestAction, rejectRequestAction } from "../dispatch/actions";

type Opt = { value: string; label: string };
export interface Choices { channels: Opt[]; parents: Opt[]; beats: Opt[]; staff: Opt[]; classes: string[]; lists: Opt[]; codes: Record<string, string> }
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });
const box = "mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground";

export function RequestCard({ r, choices, canEdit }: { r: FirmRequest; choices: Choices; canEdit: boolean }) {
  const { channels, parents, beats, staff, classes, lists, codes } = choices;
  const router = useRouter();
  const guess = channels.find((c) => c.label.toLowerCase() === r.kind.toLowerCase())?.value ?? "";
  const [code, setCode] = useState(guess ? codes[guess] ?? "" : "");
  const [codeTyped, setCodeTyped] = useState(false);
  const [channel, setChannel] = useState(guess);
  const [parent, setParent] = useState("");
  const [beat, setBeat] = useState("");
  const [contact, setContact] = useState(r.staffUid ?? "");
  const [firmClass, setFirmClass] = useState("");
  const [credit, setCredit] = useState("");
  // rates: a price list, or "" = the channel's rates
  const [list, setList] = useState("");
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const x = await fn();
      if (!x.ok) return setError(x.error ?? "Could not save.");
      setError("");
      router.refresh();
    });
  const status = r.status === "approved" ? "bg-primary/10 text-primary ring-border-brand"
    : r.status === "rejected" ? "bg-muted text-muted-foreground ring-foreground/10" : "bg-muted text-foreground ring-border";

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{r.name}</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{r.kind}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset", status)}>{r.status}</span>
        {r.source === "app" ? <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground ring-1 ring-inset ring-border">Signed up in the app</span> : null}
        <span className="ml-auto text-[12px] text-muted-foreground">{r.source === "app" ? "self sign-up" : `by ${r.officer ?? "a sales officer"}`} · {when(r.createdAt)}</span>
      </div>
      <dl className="mt-2 grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
        <div><dt className="inline text-muted-foreground">Contact: </dt><dd className="inline">{r.contactPerson ?? "-"} · {r.phone}{r.landline ? ` · ${r.landline}` : ""}{r.email ? ` · ${r.email}` : ""}</dd></div>
        <div><dt className="inline text-muted-foreground">GSTIN: </dt><dd className="inline font-mono">{r.gstin ?? "-"}</dd></div>
        {r.pan || r.licenceNo ? (
          <div className="sm:col-span-2"><dt className="inline text-muted-foreground">PAN: </dt><dd className="inline font-mono">{r.pan ?? "-"}</dd>
            <dt className="ml-4 inline text-muted-foreground">FSSAI licence: </dt><dd className="inline font-mono">{r.licenceNo ?? "-"}</dd>
            {r.aadharNo ? <><dt className="ml-4 inline text-muted-foreground">Aadhaar: </dt><dd className="inline font-mono">{r.aadharNo}</dd></> : null}</div>
        ) : null}
        <div className="sm:col-span-2"><dt className="inline text-muted-foreground">Address: </dt><dd className="inline">{[r.address, r.area, r.city, r.district ? `${r.district} district` : null, r.state, r.pincode].filter(Boolean).join(", ")}
          {r.lat !== null && r.lng !== null ? <a className="ml-2 text-primary hover:underline" href={`https://www.google.com/maps?q=${r.lat},${r.lng}`} target="_blank" rel="noreferrer">Map pin</a> : <span className="ml-2 text-muted-foreground">no pin</span>}</dd></div>
        {r.notes ? <div className="sm:col-span-2"><dt className="inline text-muted-foreground">Note: </dt><dd className="inline">{r.notes}</dd></div> : null}
        {r.status === "approved" ? <div className="sm:col-span-2 text-primary">Created as <Link className="font-mono hover:underline" href={`/customers/firm/${r.firmUid}`}>{r.firmCode}</Link> by {r.decidedBy} · rates: {r.priceList ?? "channel rates"}{r.creditLimit != null ? ` · credit limit ₹${r.creditLimit.toLocaleString("en-IN")}` : ""}</div> : null}
        {r.status === "rejected" ? <div className="sm:col-span-2 text-muted-foreground">Rejected by {r.decidedBy}: {r.reason}</div> : null}
      </dl>

      {canEdit && r.status === "pending" ? (
        rejecting ? (
          <div className="mt-3 flex gap-2">
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={r.source === "app" ? "What to correct (they see it under My application and can send it again)" : "Why (the officer sees this)"} className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-sm" />
            <button type="button" disabled={pending} onClick={() => run(() => rejectRequestAction(r.id, reason))} className="h-9 rounded-lg border border-input px-3 text-sm text-destructive hover:bg-muted">Reject</button>
            <button type="button" onClick={() => setRejecting(false)} className="h-9 rounded-lg border border-input px-3 text-sm hover:bg-muted">Back</button>
          </div>
        ) : (
          <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-4">
            <label className="text-[12px] text-muted-foreground">Channel
              <select value={channel} onChange={(e) => { setChannel(e.target.value); if (!codeTyped) setCode(codes[e.target.value] ?? ""); }} className={box}><option value="">Choose…</option>{channels.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
            </label>
            <label className="text-[12px] text-muted-foreground">Customer code<input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeTyped(true); }} className={cn(box, "px-3 font-mono uppercase")} placeholder="Unique code" /></label>
            <label className="text-[12px] text-muted-foreground">Served by (optional)
              <select value={parent} onChange={(e) => setParent(e.target.value)} className={box}><option value="">-</option>{parents.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
            </label>
            <label className="text-[12px] text-muted-foreground">Route (optional)
              <select value={beat} onChange={(e) => setBeat(e.target.value)} className={box}><option value="">-</option>{beats.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
            </label>
            <label className="text-[12px] text-muted-foreground">Sales contact
              <select value={contact} onChange={(e) => setContact(e.target.value)} className={box}><option value="">-</option>{staff.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
            </label>
            <label className="text-[12px] text-muted-foreground">Customer class
              <input list={`classes-${r.id}`} value={firmClass} onChange={(e) => setFirmClass(e.target.value)} className={cn(box, "px-3")} placeholder="-" />
              <datalist id={`classes-${r.id}`}>{classes.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label className="text-[12px] text-muted-foreground">Credit limit (₹)<input value={credit} onChange={(e) => setCredit(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className={cn(box, "px-3")} placeholder="-" /></label>
            <label className="text-[12px] text-muted-foreground sm:col-span-2">Rates
              <select value={list} onChange={(e) => setList(e.target.value)} className={box}>
                <option value="">Channel rates (its channel&apos;s own prices)</option>
                {lists.map((c) => <option key={c.value} value={c.value}>Price list: {c.label}</option>)}
              </select>
            </label>
            {r.source === "app" ? <p className="text-[12px] text-muted-foreground sm:col-span-4">Approving switches on their Gaia Distributors app login: {r.phone} with the PIN they chose while onboarding. Their app shows it as approved.</p> : null}
            <div className="flex gap-2 sm:col-span-4">
              <button type="button" disabled={pending || !code || !channel} onClick={() => run(() => approveRequestAction(r.id, {
                code, channelUid: channel, parentUid: parent || null, beatUid: beat || null, salesContactUid: contact || null,
                firmClass: firmClass.trim() || null, creditLimit: credit ? Number(credit) : null, priceListUid: list || null,
              }))}
                className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60">{pending ? "Saving…" : "Approve and create"}</button>
              <button type="button" onClick={() => setRejecting(true)} className="h-9 rounded-lg border border-input px-3 text-sm hover:bg-muted">Reject…</button>
            </div>
          </div>
        )
      ) : null}
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
