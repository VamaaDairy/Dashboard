"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Mail, RotateCcw, Search, Send, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, Section, THead, Th } from "@/components/tanks/ui";
import {
  changeTestMode, loadPartyLedger, saveRecipient, sendMany, sendOne, type PartyLedger,
} from "@/app/outstandings/actions";
import type { Debtor, SendResult } from "@/lib/outstandings/statement";
import type { OsSettings } from "@/lib/outstandings/store";

const inr = (n: number) => Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const day = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });
const box = "rounded-lg border border-border bg-input/30 px-3 py-1.5 text-[13px] focus:border-primary focus:outline-none";

export function Statements({ debtors, settings: initial }: { debtors: Debtor[]; settings: OsSettings }) {
  const [settings, setSettings] = useState(initial);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [from, setFrom] = useState(() => daysAgo(30));
  const [to, setTo] = useState(() => iso(new Date()));
  const [drafts, setDrafts] = useState<Record<string, string>>(
    () => Object.fromEntries(debtors.map((d) => [d.name, d.recipientEmail || d.tallyEmail || ""])),
  );
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<Record<string, { sending: boolean; result?: SendResult }>>({});
  const [bulkTarget, setBulkTarget] = useState<"selected" | "all" | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResults, setBulkResults] = useState<SendResult[] | null>(null);
  const [confirmMode, setConfirmMode] = useState(false);
  const [togglingMode, setTogglingMode] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? debtors.filter((d) => d.name.toLowerCase().includes(q)) : debtors;
  }, [debtors, search]);
  const allSelected = visible.length > 0 && visible.every((d) => selected.has(d.name));
  const noEmail = debtors.filter((d) => !(drafts[d.name] ?? "").trim()).length;
  const total = debtors.reduce((s, d) => s + d.balance, 0);

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const d of visible) allSelected ? next.delete(d.name) : next.add(d.name);
      return next;
    });
  }
  function toggle(name: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next; });
  }

  async function save(name: string) {
    const email = (drafts[name] ?? "").trim();
    if (!email) return true;
    setSaving((s) => ({ ...s, [name]: true }));
    const res = await saveRecipient(name, email).catch(() => ({ ok: false as const, error: "Could not save the email." }));
    setSaving((s) => ({ ...s, [name]: false }));
    if (!res.ok) { setError(`${name}: ${res.error}`); return false; }
    return true;
  }

  async function send(name: string) {
    if (!(drafts[name] ?? "").trim()) return;
    setRows((s) => ({ ...s, [name]: { sending: true } }));
    if (!(await save(name))) { setRows((s) => ({ ...s, [name]: { sending: false } })); return; }
    const res = await sendOne(name, from, to).catch((e) => ({ ok: false as const, error: String(e) }));
    const result: SendResult = res.ok ? res.result : { ledgerName: name, success: false, error: res.error };
    setRows((s) => ({ ...s, [name]: { sending: false, result } }));
  }

  async function runBulk() {
    if (!bulkTarget) return;
    const names = bulkTarget === "all" ? visible.map((d) => d.name) : [...selected];
    setBulkSending(true);
    setBulkResults(null);
    // keep every typed address, so what is on screen is what is used
    await Promise.all(names.map((n) => (drafts[n] ?? "").trim() && drafts[n].trim() !== (debtors.find((d) => d.name === n)?.recipientEmail ?? "") ? save(n) : true));
    const res = await sendMany(names, from, to).catch((e) => ({ ok: false as const, error: String(e) }));
    setBulkResults(res.ok ? res.results : [{ ledgerName: "", success: false, error: res.error }]);
    setBulkSending(false);
    setBulkTarget(null);
  }

  async function flipMode() {
    setTogglingMode(true);
    const res = await changeTestMode(!settings.testMode).catch(() => null);
    if (res?.ok) setSettings(res.settings);
    else setError(res && !res.ok ? res.error : "Could not change test mode.");
    setTogglingMode(false);
    setConfirmMode(false);
  }

  const bulkCount = bulkTarget === "all" ? visible.length : selected.size;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-[13px] text-tertiary-foreground">
          {debtors.length} outstanding {debtors.length === 1 ? "party" : "parties"} · ₹ {inr(total)} total
          {noEmail ? <> · <span className="font-medium text-foreground">{noEmail} without an email</span></> : null}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-[12px] text-tertiary-foreground">Statement from
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={box} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-tertiary-foreground">to
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={box} />
          </label>
          <Button variant="ghost" size="sm" title="Reset to the last 30 days" onClick={() => { setFrom(daysAgo(30)); setTo(iso(new Date())); }}>
            <RotateCcw /> Last 30 days
          </Button>
        </div>
      </div>

      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-[13px] ${settings.testMode ? "border-border bg-card" : "border-red-500/40 bg-red-500/10"}`}>
        <span className="flex items-center gap-2">
          {settings.testMode ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4 text-red-600" />}
          <span>
            <b>{settings.testMode ? "Test mode is on" : "Test mode is OFF - live sending"}</b>{" · "}
            {settings.testMode ? `every send goes to ${settings.testRecipientEmail} instead of the real party.` : "sends go to each party's real recipient email."}
          </span>
        </span>
        <Button size="sm" variant={settings.testMode ? "outline" : "destructive"} onClick={() => setConfirmMode(true)}>
          {settings.testMode ? "Turn off test mode" : "Turn test mode back on"}
        </Button>
      </div>

      {error ? (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-[13px] text-red-700 dark:text-red-400">
          <span>{error}</span><button className="underline" onClick={() => setError(null)}>Dismiss</button>
        </div>
      ) : null}

      {bulkResults ? (
        <div className={`rounded-lg border p-3 text-[13px] ${bulkResults.every((r) => r.success) ? "border-border bg-card" : "border-red-500/40 bg-red-500/10"}`}>
          <p className="flex items-center gap-2 font-medium">
            {bulkResults.every((r) => r.success) ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
            Sent {bulkResults.filter((r) => r.success).length} of {bulkResults.length}
          </p>
          {bulkResults.some((r) => !r.success) ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {bulkResults.filter((r) => !r.success).map((r, i) => <li key={i}>{r.ledgerName ? `${r.ledgerName}: ` : ""}{r.error}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary-foreground" />
          <Input placeholder="Filter by party..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-tertiary-foreground">{selected.size} selected</span>
          <Button variant="outline" size="sm" disabled={selected.size === 0} onClick={() => setBulkTarget("selected")}>
            <Send /> Send to selected ({selected.size})
          </Button>
          <Button variant="primary" size="sm" disabled={visible.length === 0} onClick={() => setBulkTarget("all")}>
            <Mail /> Send to all ({visible.length})
          </Button>
        </div>
      </div>

      <Section title="Outstanding parties" description="Open a party to see its ledger. Type or correct the email in the box - it is saved when you leave the box or press Send. Tally's own email is used until you set one.">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <THead>
              <Th align="left" className="w-8">
                <input type="checkbox" className="size-4 accent-primary" checked={allSelected} onChange={toggleAll} aria-label="Select all visible parties" />
              </Th>
              <Th align="left">Party</Th>
              <Th>Balance</Th>
              <Th align="left">Recipient email</Th>
              <Th>Send</Th>
            </THead>
            <tbody>
              {visible.length === 0 ? <Empty colSpan={5}>No party matches that filter.</Empty> : visible.map((d) => {
                const r = rows[d.name];
                return (
                  <tr key={d.name} className="border-t border-border hover:bg-muted/40">
                    <td className="px-3 py-2">
                      <input type="checkbox" className="size-4 accent-primary" checked={selected.has(d.name)} onChange={() => toggle(d.name)} aria-label={`Select ${d.name}`} />
                    </td>
                    <td className="px-3 py-2 font-medium">
                      <button className="inline-flex items-center gap-1 text-left hover:underline" title="View ledger" onClick={() => setViewing(d.name)}>
                        {d.name} <ExternalLink className="h-3 w-3 text-tertiary-foreground" />
                      </button>
                      {d.lastSent ? <div className="text-[11px] font-normal text-tertiary-foreground">last sent {day(d.lastSent)}</div> : null}
                    </td>
                    <td className="num px-3 py-2 text-right">₹ {inr(d.balance)}</td>
                    <td className="min-w-56 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Input
                          type="email" value={drafts[d.name] ?? ""} placeholder="party@example.com"
                          onChange={(e) => setDrafts((s) => ({ ...s, [d.name]: e.target.value }))}
                          onBlur={() => (drafts[d.name] ?? "").trim() !== (d.recipientEmail ?? "") && save(d.name)}
                        />
                        {saving[d.name] ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {r?.result ? (r.result.success ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />) : null}
                        <Button size="sm" variant="outline" disabled={r?.sending || !(drafts[d.name] ?? "").trim()} onClick={() => send(d.name)}>
                          {r?.sending ? <Loader2 className="animate-spin" /> : <Send />} Send
                        </Button>
                      </div>
                      {r?.result && !r.result.success ? <p className="mt-1 text-right text-xs text-red-600">{r.result.error}</p> : null}
                      {r?.result?.success && r.result.testMode ? <p className="mt-1 text-right text-xs text-tertiary-foreground">test mode → {r.result.actualRecipient}</p> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <PartyLedgerDialog name={viewing} onClose={() => setViewing(null)} onSaved={(n, e) => setDrafts((s) => ({ ...s, [n]: e }))} />

      <Dialog open={confirmMode} onOpenChange={setConfirmMode}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{settings.testMode ? "Turn off test mode?" : "Turn test mode back on?"}</DialogTitle>
            <DialogDescription>
              {settings.testMode
                ? "Sends will go to each party's real recipient email instead of the test address. This affects every send from now on, including bulk sends."
                : "Every send will go to the test recipient again, whichever party it is for."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmMode(false)}>Cancel</Button>
            <Button variant={settings.testMode ? "destructive" : "primary"} disabled={togglingMode} onClick={flipMode}>
              {togglingMode ? <Loader2 className="animate-spin" /> : null}
              {settings.testMode ? "Turn off test mode" : "Turn on test mode"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkTarget !== null} onOpenChange={(o) => !o && !bulkSending && setBulkTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send statements to {bulkCount} {bulkCount === 1 ? "party" : "parties"}?</DialogTitle>
            <DialogDescription>
              {settings.testMode
                ? `Test mode is on - every one of these will actually go to ${settings.testRecipientEmail}.`
                : "Test mode is off - these will go to each party's real recipient email. A party with no recipient email is skipped and reported as a failure."}{" "}
              Each statement covers {from} to {to}. A large batch can take several minutes - keep this page open.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={bulkSending} onClick={() => setBulkTarget(null)}>Cancel</Button>
            <Button variant="primary" disabled={bulkSending} onClick={runBulk}>
              {bulkSending ? <Loader2 className="animate-spin" /> : <Send />} {bulkSending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PartyLedgerDialog({ name, onClose, onSaved }: { name: string | null; onClose: () => void; onSaved: (name: string, email: string) => void }) {
  return (
    <Dialog open={!!name} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {/* keyed by party so the dates, drafts and results reset cleanly for the next one */}
        {name ? <LedgerBody key={name} name={name} onSaved={onSaved} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function LedgerBody({ name, onSaved }: { name: string; onSaved: (name: string, email: string) => void }) {
  const [from, setFrom] = useState(() => daysAgo(30));
  const [to, setTo] = useState(() => iso(new Date()));
  const [ledger, setLedger] = useState<PartyLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [savingRecipient, setSavingRecipient] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const res = await loadPartyLedger(name, from, to).catch((e) => ({ ok: false as const, error: String(e) }));
      if (cancelled) return;
      if (res.ok) { setLedger(res.ledger); setRecipient((r) => r || res.ledger.recipientEmail || res.ledger.tallyEmail || ""); }
      else setError(res.error);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [name, from, to]);

  const totals = useMemo(() => {
    const v = ledger?.vouchers ?? [];
    return { debit: v.reduce((s, x) => s + Math.max(0, -x.amount), 0), credit: v.reduce((s, x) => s + Math.max(0, x.amount), 0) };
  }, [ledger]);

  async function saveEmail() {
    if (!recipient.trim()) return true;
    setSavingRecipient(true);
    const res = await saveRecipient(name, recipient.trim()).catch(() => ({ ok: false as const, error: "Could not save the email." }));
    setSavingRecipient(false);
    if (!res.ok) { setError(res.error); return false; }
    onSaved(name, recipient.trim());
    return true;
  }

  async function send() {
    setSending(true);
    setResult(null);
    // what is in the box is what is used
    if (await saveEmail()) {
      const res = await sendOne(name, from, to).catch((e) => ({ ok: false as const, error: String(e) }));
      setResult(res.ok ? res.result : { ledgerName: name, success: false, error: res.error });
    }
    setSending(false);
  }

  return (
    <>
      <DialogHeader><DialogTitle>{name}</DialogTitle></DialogHeader>

      {ledger ? (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div className="text-xs text-tertiary-foreground">Outstanding balance</div>
          <div className="num text-xl font-semibold">₹ {inr(ledger.balance)}</div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-[12px] text-tertiary-foreground">From
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={box} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-tertiary-foreground">To
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={box} />
        </label>
      </div>

      {error ? <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-[13px] text-red-700 dark:text-red-400">{error}</div> : null}

      {loading ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : !error && ledger ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-[13px]">
            <THead>
              <Th align="left">Date</Th>
              <Th align="left">Particulars</Th>
              <Th>Debit</Th>
              <Th>Credit</Th>
            </THead>
            <tbody>
              {ledger.vouchers.length === 0 ? <Empty colSpan={4}>No transactions in this period.</Empty> : ledger.vouchers.map((v, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="whitespace-nowrap px-3 py-1.5">{v.date}</td>
                  <td className="px-3 py-1.5">
                    {v.voucherType}
                    {v.narration ? <div className="text-xs text-tertiary-foreground">{v.narration}</div> : null}
                  </td>
                  <td className="num px-3 py-1.5 text-right">{v.amount < 0 ? inr(v.amount) : ""}</td>
                  <td className="num px-3 py-1.5 text-right">{v.amount > 0 ? inr(v.amount) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end gap-6 border-t border-border bg-muted/30 px-4 py-2 text-sm font-medium">
            <span>Debit: ₹ {inr(totals.debit)}</span>
            <span>Credit: ₹ {inr(totals.credit)}</span>
          </div>
        </div>
      ) : null}

      <div className="space-y-1">
        <label className="text-[12px] text-tertiary-foreground" htmlFor="os-recipient">Send statement to</label>
        <div className="flex gap-2">
          <Input id="os-recipient" type="email" placeholder="party@example.com" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          <Button variant="outline" disabled={savingRecipient || !recipient.trim()} onClick={saveEmail}>
            {savingRecipient ? <Loader2 className="animate-spin" /> : "Save"}
          </Button>
        </div>
        {ledger?.tallyEmail && ledger.tallyEmail !== recipient ? (
          <p className="text-xs text-tertiary-foreground">Tally has this party&apos;s email as {ledger.tallyEmail}.</p>
        ) : null}
      </div>

      {result ? (
        <div className={`rounded-lg border p-3 text-[13px] ${result.success ? "border-border bg-card" : "border-red-500/40 bg-red-500/10"}`}>
          <p className="flex items-center gap-2 font-medium">
            {result.success ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
            {result.success ? "Statement sent" : "Send failed"}
          </p>
          <p className="mt-1">
            {result.success
              ? result.testMode ? `Test mode is on - sent to ${result.actualRecipient} instead of ${result.intendedRecipient || "the party"}.` : `Sent to ${result.actualRecipient}.`
              : result.error}
          </p>
        </div>
      ) : null}

      <DialogFooter>
        <Button variant="primary" disabled={sending || loading || !recipient.trim()} onClick={send}>
          {sending ? <Loader2 className="animate-spin" /> : <Send />} {sending ? "Sending..." : "Send statement"}
        </Button>
      </DialogFooter>
    </>
  );
}
