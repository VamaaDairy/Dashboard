"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { searchCustomers, sendNotification, type Audience } from "@/app/shop-orders/notifications/actions";

const box = "w-full rounded-lg border border-border bg-input/30 px-3 py-1.5 text-[13px] focus:border-primary focus:outline-none";
const AUDIENCES: { v: Audience; label: string }[] = [
  { v: "all", label: "Everyone with the app" },
  { v: "customers", label: "All customers (signed in)" },
  { v: "riders", label: "All riders" },
  { v: "distributors", label: "All distributors" },
  { v: "customer", label: "One customer" },
];

type Customer = { id: number; name: string; phone: string };

export function NotificationForm() {
  const router = useRouter();
  const [audience, setAudience] = useState<Audience>("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (audience !== "customer" || customer || q.trim().length < 2) { setFound([]); return; }
    const t = setTimeout(() => searchCustomers(q).then(setFound), 250);
    return () => clearTimeout(t);
  }, [q, audience, customer]);

  function send() {
    setNote(null);
    start(async () => {
      const r = await sendNotification({ audience, customerId: customer?.id, title, body });
      if (!r.ok) return setNote({ ok: false, text: r.error });
      const { sent, failed, audience: a } = r.summary;
      const text = audience === "all"
        ? (sent ? "Sent to everyone." : "Firebase refused the message - see the server log.")
        : `${a}: ${sent} phone(s) notified${failed ? `, ${failed} failed` : ""}${sent + failed === 0 ? " - no phone is signed in for that audience" : ""}.`;
      setNote({ ok: failed === 0 && sent > 0, text });
      if (sent > 0) { setTitle(""); setBody(""); }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-[12px] text-muted-foreground">Send to
          <select className={box} value={audience} onChange={(e) => { setAudience(e.target.value as Audience); setCustomer(null); setQ(""); }}>
            {AUDIENCES.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
          </select>
        </label>
        {audience === "customer" ? (
          <div className="relative space-y-1 text-[12px] text-muted-foreground">
            <label>Customer
              <input className={box} placeholder="Search by name or mobile" value={customer ? `${customer.name} (${customer.phone})` : q}
                onChange={(e) => { setCustomer(null); setQ(e.target.value); }} />
            </label>
            {found.length > 0 ? (
              <ul className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow">
                {found.map((c) => (
                  <li key={c.id}><button type="button" className="w-full px-3 py-1.5 text-left text-[13px] hover:bg-muted" onClick={() => { setCustomer(c); setFound([]); }}>{c.name} ({c.phone})</button></li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
      <label className="block space-y-1 text-[12px] text-muted-foreground">Title
        <input className={box} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fresh paneer is back" />
      </label>
      <label className="block space-y-1 text-[12px] text-muted-foreground">Message
        <textarea className={box} rows={3} maxLength={300} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What should the phone show?" />
      </label>
      <div className="flex items-center gap-3">
        <Button onClick={send} disabled={pending || !title.trim() || !body.trim() || (audience === "customer" && !customer)}>
          <Send className="mr-2 h-4 w-4" /> {pending ? "Sending..." : "Send notification"}
        </Button>
        {note ? <span className={`text-[13px] ${note.ok ? "text-emerald-600" : "text-red-600"}`}>{note.text}</span> : null}
      </div>
    </div>
  );
}
