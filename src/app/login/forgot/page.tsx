"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Mail } from "lucide-react";
import { GaiaLogo } from "@/components/brand";

const input =
  "w-full rounded-lg border border-border bg-input/30 px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/30";
const label = "mb-1.5 block text-xs font-medium text-muted-foreground";
const primary =
  "w-full rounded-lg border border-border bg-white py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60";

type Step = "email" | "code" | "done";

async function post(url: string, body: object): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return await res.json();
  } catch {
    return { success: false, error: "Connection error. Please try again." };
  }
}

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [wait, setWait] = useState(0);

  // "Send a new code" unlocks a minute after the last one went out
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter the email saved on your profile.");
    setLoading(true);
    const r = await post("/api/auth/forgot", { email });
    setLoading(false);
    if (!r.success) return setError(r.error ?? "Could not send the code.");
    setCode("");
    setWait(60);
    setStep("code");
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(code.trim())) return setError("Enter the 6-digit code from the email.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("The two passwords do not match.");
    setLoading(true);
    const r = await post("/api/auth/reset", { email, code: code.trim(), password });
    setLoading(false);
    if (!r.success) return setError(r.error ?? "Could not reset the password.");
    setStep("done");
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <GaiaLogo className="h-auto w-40" />
        </div>

        <div className="rounded-xl border border-border bg-card p-7 shadow-2xl shadow-black/40">
          {step === "done" ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-600" />
              <h1 className="text-lg font-semibold text-foreground">Password changed</h1>
              <p className="mt-1 mb-6 text-sm text-muted-foreground">You can now sign in with your new password.</p>
              <Link href="/login" className={`${primary} block text-center`}>
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-foreground">Forgot password</h1>
              <p className="mt-1 mb-6 text-sm text-muted-foreground">
                {step === "email"
                  ? "Enter the recovery email saved on your profile and we will send you a code."
                  : <>We sent a 6-digit code to <span className="font-medium text-foreground">{email.trim()}</span> if it is on a profile. It works for 10 minutes.</>}
              </p>

              {error && (
                <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive">
                  {error}
                </div>
              )}

              {step === "email" ? (
                <form onSubmit={sendCode} className="space-y-4">
                  <div>
                    <label htmlFor="email" className={label}>Recovery email</label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className={`${input} pl-10`}
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className={primary}>
                    {loading ? "Sending…" : "Send code"}
                  </button>
                </form>
              ) : (
                <form onSubmit={reset} className="space-y-4">
                  <div>
                    <label htmlFor="code" className={label}>6-digit code</label>
                    <input
                      id="code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      autoFocus
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="••••••"
                      className={`${input} text-center font-mono text-lg tracking-[0.5em]`}
                    />
                  </div>
                  <div>
                    <label htmlFor="password" className={label}>New password</label>
                    <div className="relative">
                      <input
                        id="password"
                        type={show ? "text" : "password"}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className={`${input} pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShow((s) => !s)}
                        aria-label={show ? "Hide password" : "Show password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="confirm" className={label}>Confirm new password</label>
                    <input
                      id="confirm"
                      type={show ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className={input}
                    />
                  </div>
                  <button type="submit" disabled={loading} className={primary}>
                    {loading ? "Saving…" : "Reset password"}
                  </button>
                  <div className="flex items-center justify-between text-xs">
                    <button type="button" onClick={() => { setError(""); setStep("email"); }} className="text-muted-foreground hover:text-foreground">
                      Change email
                    </button>
                    <button
                      type="button"
                      disabled={wait > 0 || loading}
                      onClick={() => sendCode()}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      {wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>

        {step !== "done" && (
          <Link href="/login" className="mt-5 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
          </Link>
        )}
      </div>
    </div>
  );
}
