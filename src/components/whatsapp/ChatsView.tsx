"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, Bot, Check, CheckCheck, Clock, Hand, MapPin, Paperclip, Search, Send, ShoppingCart, Store, User, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearNeedsHuman, sendCatalogTo, setBotEnabled } from "@/app/whatsapp/actions";
import type { Contact, ConversationRow, Message, Order, PricedCart } from "@/lib/whatsapp/store";
import {
  Empty, MediaThumb, OrderStatusBadge, PaymentBadge, getJson, money, phone, usePoll, when,
} from "./shared";

interface Thread {
  contact: Contact;
  messages: Message[];
  orders: Order[];
  cart: PricedCart;
  windowOpen: boolean;
}

export function ChatsView({ initialWaId }: { initialWaId: string | null }) {
  const [selected, setSelected] = useState<string | null>(initialWaId);
  const [search, setSearch] = useState("");

  const list = usePoll(() => getJson<ConversationRow[]>(`/api/whatsapp/conversations?q=${encodeURIComponent(search)}`), [search], 4000);
  const thread = usePoll(
    () => (selected ? getJson<Thread>(`/api/whatsapp/conversations/${selected}`) : Promise.resolve(null)),
    [selected],
    3000,
  );

  function open(waId: string) {
    setSelected(waId);
    thread.setData(null);
    window.history.replaceState(null, "", `/whatsapp/chats?c=${waId}`);
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-[520px] overflow-hidden rounded-xl border border-border bg-card">
      {/* ------------------------------------------------ conversation list */}
      <aside className={`${selected ? "hidden md:flex" : "flex"} w-full flex-col border-r border-border md:w-80 md:shrink-0`}>
        <div className="border-b border-border p-3">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or number"
              className="h-8 w-full bg-transparent text-sm outline-none"
            />
          </label>
        </div>
        <div className="flex-1 overflow-y-auto">
          {list.error ? <p className="p-3 text-xs text-destructive">{list.error}</p> : null}
          {list.data && !list.data.length ? <Empty>No conversations yet. Message your WhatsApp test number to start one.</Empty> : null}
          {list.data?.map((c) => (
            <button
              key={c.wa_id}
              onClick={() => open(c.wa_id)}
              className={`flex w-full items-start gap-3 border-b border-border/60 px-3 py-2.5 text-left hover:bg-muted/60 ${selected === c.wa_id ? "bg-muted" : ""}`}
            >
              <Avatar name={c.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">{c.name || phone(c.wa_id)}</span>
                  {c.needs_human ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-label="Needs a person" /> : null}
                  {!c.bot_enabled ? <Hand className="h-3.5 w-3.5 shrink-0 text-warning-foreground" aria-label="Handled by a person" /> : null}
                  <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{when(c.last_message_at)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-xs text-muted-foreground">
                    {c.last_direction === "out" ? "You: " : ""}
                    {c.last_type && !["text", "interactive", "button"].includes(c.last_type) ? `[${c.last_type}] ` : ""}
                    {c.last_body}
                  </span>
                  {c.open_orders ? (
                    <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground">
                      <ShoppingCart className="h-3 w-3" />{c.open_orders}
                    </span>
                  ) : null}
                  {c.unread && selected !== c.wa_id ? (
                    <span className="ml-1 shrink-0 rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white">{c.unread}</span>
                  ) : null}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* ------------------------------------------------ the conversation */}
      <section className={`${selected ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
        {!selected ? (
          <Empty>Pick a conversation.</Empty>
        ) : !thread.data ? (
          <Empty>{thread.error ?? "Loading…"}</Empty>
        ) : (
          <Conversation key={selected} thread={thread.data} onBack={() => setSelected(null)} refresh={thread.refresh} />
        )}
      </section>
    </div>
  );
}

function Avatar({ name }: { name: string | null }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600/15 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
      {name?.trim()?.[0]?.toUpperCase() ?? <User className="h-4 w-4" />}
    </span>
  );
}

function Conversation({ thread, onBack, refresh }: { thread: Thread; onBack: () => void; refresh: () => void }) {
  const { contact, messages, orders, cart, windowOpen } = thread;
  const scroller = useRef<HTMLDivElement>(null);
  const lastId = messages.at(-1)?.id;
  const [showSide, setShowSide] = useState(false);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [lastId]);

  const [sendingCatalog, setSendingCatalog] = useState(false);
  async function shareCatalog() {
    setSendingCatalog(true);
    const r = await sendCatalogTo(contact.wa_id);
    setSendingCatalog(false);
    if (!r.ok) alert(r.error);
    refresh();
  }

  async function toggleBot() {
    await setBotEnabled(contact.wa_id, !contact.bot_enabled);
    refresh();
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* header */}
        <header className="flex items-center gap-3 border-b border-border px-3 py-2">
          <button onClick={onBack} className="rounded p-1 hover:bg-muted md:hidden" aria-label="Back">
            <X className="h-4 w-4" />
          </button>
          <Avatar name={contact.name} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{contact.name || phone(contact.wa_id)}</div>
            <div className="text-xs text-muted-foreground">{phone(contact.wa_id)}</div>
          </div>
          {contact.needs_human ? (
            <Button size="sm" variant="destructive" onClick={async () => { await clearNeedsHuman(contact.wa_id); refresh(); }}>
              <AlertTriangle /> Needs a person · dismiss
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={shareCatalog} disabled={sendingCatalog} title="Send product photos and the Order now list">
            <Store /> {sendingCatalog ? "Sending…" : "Send catalog"}
          </Button>
          <button
            role="switch"
            aria-checked={contact.bot_enabled}
            onClick={toggleBot}
            title={contact.bot_enabled ? "AI answers this customer. Click to turn it off and reply yourself." : "AI is off - only you reply. Click to let the AI answer again."}
            className={`flex h-8 items-center gap-2 rounded-lg border px-2.5 text-xs font-semibold ${
              contact.bot_enabled ? "border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400" : "border-warning/50 bg-warning/15 text-warning-foreground"
            }`}
          >
            {contact.bot_enabled ? <Bot className="h-4 w-4" /> : <Hand className="h-4 w-4" />}
            AI auto-reply
            <span className={`relative h-4 w-7 rounded-full transition-colors ${contact.bot_enabled ? "bg-emerald-600" : "bg-muted-foreground/40"}`}>
              <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${contact.bot_enabled ? "left-3.5" : "left-0.5"}`} />
            </span>
            {contact.bot_enabled ? "ON" : "OFF"}
          </button>
          <Button size="sm" variant="ghost" className="xl:hidden" onClick={() => setShowSide((v) => !v)}>
            <ShoppingCart /> {orders.length}
          </Button>
        </header>

        {/* messages */}
        <div ref={scroller} className="flex-1 space-y-1.5 overflow-y-auto bg-[color-mix(in_oklch,var(--muted),transparent_40%)] px-3 py-4 sm:px-6">
          {messages.map((m) => <Bubble key={m.id} m={m} />)}
        </div>

        {!windowOpen ? (
          <div className="flex items-center gap-2 border-t border-border bg-warning/15 px-3 py-1.5 text-[12px] text-warning-foreground">
            <Clock className="h-3.5 w-3.5" /> The customer hasn&apos;t written in 24 hours - WhatsApp only delivers approved templates until they message again.
          </div>
        ) : null}
        <Composer waId={contact.wa_id} botOn={contact.bot_enabled} onSent={refresh} />
      </div>

      {/* customer side panel */}
      <aside className={`${showSide ? "block" : "hidden"} w-72 shrink-0 overflow-y-auto border-l border-border p-4 xl:block`}>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Delivery</h3>
        {contact.delivery_address ? (
          <p className="flex gap-1.5 text-sm"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{contact.delivery_name ? `${contact.delivery_name}, ` : ""}{contact.delivery_address}</p>
        ) : <p className="text-sm text-muted-foreground">Not given yet</p>}

        <h3 className="mb-1 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cart</h3>
        {cart.lines.length ? (
          <div className="space-y-1 text-sm">
            {cart.lines.map((l) => (
              <div key={l.retailer_id} className="flex justify-between gap-2">
                <span className="truncate">{l.name} × {l.qty}</span><span className="num">{money(l.line_total, cart.currency)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-border pt-1 font-semibold">
              <span>Total</span><span className="num">{money(cart.total, cart.currency)}</span>
            </div>
          </div>
        ) : <p className="text-sm text-muted-foreground">Empty</p>}

        <h3 className="mb-1 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Orders</h3>
        {orders.length ? (
          <div className="space-y-2">
            {orders.map((o) => (
              <Link key={o.id} href={`/whatsapp/orders?o=${o.id}`} className="block rounded-lg border border-border p-2 hover:bg-muted">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>{o.order_no}</span><span className="num">{money(o.total, o.currency)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <OrderStatusBadge status={o.status} />
                  <PaymentBadge status={o.payment_status} method={o.payment_method} />
                  <span className="ml-auto text-[11px] text-muted-foreground">{when(o.created_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">None yet</p>}
      </aside>
    </div>
  );
}

function Bubble({ m }: { m: Message }) {
  const out = m.direction === "out";
  const who = m.sender === "agent" ? "You" : m.sender === "bot" ? "AI" : m.sender === "system" ? "Auto" : null;
  const interactive = m.type === "interactive" && out ? (m.payload as { interactive?: { action?: { sections?: { rows: { title: string }[] }[] } } } | null) : null;
  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm shadow-sm sm:max-w-[70%] ${
          out
            ? m.status === "failed" ? "rounded-br-sm bg-destructive/10" : "rounded-br-sm bg-emerald-100 dark:bg-emerald-950"
            : "rounded-bl-sm bg-background"
        }`}
      >
        {who ? <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{who}</div> : null}
        {m.media_id ? <MediaThumb id={m.media_id} mime={m.media_mime} className="mb-1 max-h-72 w-full max-w-xs" /> : null}
        {!m.media_id && m.type === "image" && out ? (() => {
          const link = (m.payload as { image?: { link?: string } } | null)?.image?.link;
          // eslint-disable-next-line @next/next/no-img-element -- catalog image from Meta's CDN
          return link ? <img src={link} alt="" className="mb-1 max-h-60 w-full max-w-xs rounded-md object-cover" /> : null;
        })() : null}
        {m.body ? <p className="whitespace-pre-wrap break-words">{waFormat(m.body)}</p> : null}
        {interactive?.interactive?.action?.sections ? (
          <div className="mt-1 text-[11px] text-muted-foreground">
            Options: {interactive.interactive.action.sections.flatMap((s) => s.rows.map((r) => r.title)).join(" · ")}
          </div>
        ) : null}
        {m.error ? <p className="mt-1 text-[11px] text-destructive">Not delivered: {m.error}</p> : null}
        <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
          {m.order_id ? <Link href={`/whatsapp/orders?o=${m.order_id}`} className="mr-auto underline">order</Link> : null}
          {when(m.created_at)}
          {out ? <Tick status={m.status} /> : null}
        </div>
      </div>
    </div>
  );
}

function Tick({ status }: { status: string | null }) {
  if (status === "read") return <CheckCheck className="h-3.5 w-3.5 text-sky-500" />;
  if (status === "delivered") return <CheckCheck className="h-3.5 w-3.5" />;
  if (status === "sent") return <Check className="h-3.5 w-3.5" />;
  if (status === "failed") return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
  return <Clock className="h-3 w-3" />;
}

/** WhatsApp's *bold* and _italic_, rendered. */
function waFormat(text: string): React.ReactNode[] {
  return text.split(/((?<!\w)\*[^*\n]+\*(?!\w)|(?<!\w)_[^_\n]+_(?!\w))/g).map((part, i) =>
    part.startsWith("*") && part.endsWith("*") && part.length > 2 ? <strong key={i}>{part.slice(1, -1)}</strong>
    : part.startsWith("_") && part.endsWith("_") && part.length > 2 ? <em key={i}>{part.slice(1, -1)}</em>
    : part,
  );
}

function Composer({ waId, botOn, onSent }: { waId: string; botOn: boolean; onSent: () => void }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function submit() {
    if (busy || (!text.trim() && !file)) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("text", text);
    if (file) fd.set("file", file);
    try {
      const r = await fetch(`/api/whatsapp/conversations/${waId}/send`, { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) setError(d.error ?? `Send failed (${r.status})`);
      else {
        setText("");
        setFile(null);
      }
    } finally {
      setBusy(false);
      onSent();
    }
  }

  return (
    <div className="border-t border-border p-2">
      {botOn ? (
        <p className="px-1 pb-1 text-[11px] text-muted-foreground">AI auto-reply is ON for this chat. Anything you send goes out alongside it - turn it OFF above to take over.</p>
      ) : null}
      {file ? (
        <div className="mb-1 flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs">
          <Paperclip className="h-3.5 w-3.5" /> <span className="truncate">{file.name}</span>
          <button onClick={() => setFile(null)} className="ml-auto" aria-label="Remove attachment"><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : null}
      {error ? <p className="px-1 pb-1 text-xs text-destructive">{error}</p> : null}
      <div className="flex items-end gap-2">
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,application/pdf" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Button variant="ghost" size="icon" onClick={() => fileInput.current?.click()} aria-label="Attach photo or PDF">
          <Paperclip />
        </Button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          rows={1}
          placeholder={file ? "Caption (optional)" : "Type a message"}
          className="max-h-32 min-h-9 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
        />
        <Button size="icon" onClick={submit} disabled={busy || (!text.trim() && !file)} className="bg-emerald-600 text-white hover:bg-emerald-700" aria-label="Send">
          <Send />
        </Button>
      </div>
    </div>
  );
}
