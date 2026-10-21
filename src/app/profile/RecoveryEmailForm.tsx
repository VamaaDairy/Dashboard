"use client";

import { useState, useTransition } from "react";
import { saveRecoveryEmail } from "./actions";

export function RecoveryEmailForm({ initial }: { initial: string }) {
  const [email, setEmail] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const r = await saveRecoveryEmail(email);
          setMsg(r.ok ? { ok: true, text: email.trim() ? "Saved. Password reset codes will go to this email." : "Recovery email removed." } : { ok: false, text: r.error });
        });
      }}
    >
      <label className="block text-xs font-medium text-muted-foreground">
        Recovery email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-1.5 w-full rounded-lg border border-border bg-input/30 px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </label>
      <p className="text-xs text-muted-foreground">Used only for &quot;Forgot password&quot; on the sign-in page. It can be different from the email you sign in with.</p>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-60">
          {pending ? "Saving…" : "Save"}
        </button>
        {msg ? <span className={`text-sm ${msg.ok ? "text-green-600" : "text-destructive"}`}>{msg.text}</span> : null}
      </div>
    </form>
  );
}
