"use client";

import { useTransition } from "react";
import { addAppLoginAction, createMissingAppLoginsAction, setAppLoginAction } from "@/lib/distributor/actions";

type Kind = "distributor" | "salesman" | "retailer";
const btn = "rounded-md px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50";

/** Per-row Gaia app login controls: create one, set a new PIN, switch it off or on. `status` is the row's "App login" value. */
export function AppLoginActions({ kind, uid, status }: { kind: Kind; uid: string; status: string }) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok && r.error) window.alert(r.error);
    });

  if (status === "No login") {
    return (
      <button
        type="button"
        disabled={pending}
        className={`${btn} text-foreground`}
        onClick={() => {
          const pin = window.prompt("PIN for the app (4-8 digits). They sign in with the mobile number on this record.");
          if (pin) run(() => addAppLoginAction(kind, uid, pin.trim()));
        }}
      >
        Create login
      </button>
    );
  }
  return (
    <>
      <button
        type="button"
        disabled={pending}
        className={`${btn} text-foreground`}
        onClick={() => {
          const pin = window.prompt("New PIN (4-8 digits). They are signed out of their phone.");
          if (pin) run(() => setAppLoginAction(kind, uid, { pin: pin.trim() }));
        }}
      >
        Set PIN
      </button>
      <button type="button" disabled={pending} className={`${btn} text-foreground`} onClick={() => run(() => setAppLoginAction(kind, uid, { active: status === "Disabled" }))}>
        {status === "Disabled" ? "Enable login" : "Disable login"}
      </button>
    </>
  );
}

/** Creates a login for everyone listed who has none, then downloads the PIN list (the PINs cannot be shown again). */
export function CreateMissingLogins({ kind }: { kind: Kind }) {
  const [pending, start] = useTransition();
  const who = kind === "distributor" ? "distributor" : kind === "retailer" ? "retailer" : "sales officer";
  return (
    <button
      type="button"
      disabled={pending}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted disabled:opacity-60"
      onClick={() =>
        start(async () => {
          if (!window.confirm(`Create an app login for every ${who} that does not have one, on the mobile number in their record? A PIN list will download - keep it safe, the PINs cannot be shown again.`)) return;
          const r = await createMissingAppLoginsAction(kind);
          if (!r.ok) { window.alert(r.error ?? "Could not create the logins."); return; }
          if (r.csv && r.created) {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([r.csv], { type: "text/csv" }));
            a.download = `gaia-app-logins-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(a.href);
          }
          window.alert(`${r.created ?? 0} logins created.${r.skipped?.length ? `\n\nSkipped ${r.skipped.length}:\n${r.skipped.join("\n")}` : ""}`);
        })
      }
    >
      {pending ? "Creating…" : `Create missing ${who} logins`}
    </button>
  );
}
