"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { searchRecipients, sendNotification } from "@/app/shop-orders/notifications/actions";
import { AUDIENCES, ONE_OF, type Audience, type NotifyApp, type Recipient } from "@/lib/push/audiences";

const box = "w-full rounded-lg border border-border bg-input/30 px-3 py-1.5 text-[13px] focus:border-primary focus:outline-none";

/** Sends a push notification to one app's users: the D2C app, or the distributor / retailer app. */
export function NotificationForm({ app }: { app: NotifyApp }) {
  const router = useRouter();
  const audiences = AUDIENCES[app];
  const one = ONE_OF[app];
  const [audience, setAudience] = useState<Audience>(audiences[0].v);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Recipient[]>([]);
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (audience !== one || recipient || q.trim().length < 2) return;
    const t = setTimeout(() => searchRecipients(app, q).then(setFound), 250);
    return () => clearTimeout(t);
  }, [q, audience, recipient, app, one]);

  function send() {
    setNote(null);
    start(async () => {
      const r = await sendNotification({ audience, recipientId: recipient?.id, title, body });
      if (!r.ok) return setNote({ ok: false, text: r.error });
      const { sent, failed, audience: a } = r.summary;
      const text = `${a}: ${sent} phone(s) notified${failed ? `, ${failed} failed` : ""}${sent + failed === 0 ? " - no phone is signed in for that audience" : ""}.`;
      setNote({ ok: failed === 0 && sent > 0, text });
      if (sent > 0) { setTitle(""); setBody(""); }
      router.refresh();
    });
  }

  const who = app === "d2c" ? "Customer" : "Distributor or retailer";
  const show = (r: Recipient) => `${r.name} (${r.kind ? `${r.kind}, ` : ""}${r.phone})`;
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-[12px] text-muted-foreground">Send to
          <select className={box} value={audience} onChange={(e) => { setAudience(e.target.value as Audience); setRecipient(null); setQ(""); }}>
            {audiences.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
          </select>
        </label>
        {audience === one ? (
          <div className="relative space-y-1 text-[12px] text-muted-foreground">
            <label>{who}
              <input className={box} placeholder="Search by name or mobile" value={recipient ? show(recipient) : q}
                onChange={(e) => { setRecipient(null); setQ(e.target.value); }} />
            </label>
            {found.length > 0 && !recipient && q.trim().length >= 2 ? (
              <ul className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow">
                {found.map((c) => (
                  <li key={c.id}><button type="button" className="w-full px-3 py-1.5 text-left text-[13px] hover:bg-muted" onClick={() => { setRecipient(c); setFound([]); }}>{show(c)}</button></li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
      <label className="block space-y-1 text-[12px] text-muted-foreground">Title
        <input className={box} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={app === "d2c" ? "e.g. Fresh paneer is back" : "e.g. New scheme on curd this week"} />
      </label>
      <label className="block space-y-1 text-[12px] text-muted-foreground">Message
        <textarea className={box} rows={3} maxLength={300} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What should the phone show?" />
      </label>
      <div className="flex items-center gap-3">
        <Button onClick={send} disabled={pending || !title.trim() || !body.trim() || (audience === one && !recipient)}>
          <Send className="mr-2 h-4 w-4" /> {pending ? "Sending..." : "Send notification"}
        </Button>
        {note ? <span className={`text-[13px] ${note.ok ? "text-emerald-600" : "text-red-600"}`}>{note.text}</span> : null}
      </div>
    </div>
  );
}
