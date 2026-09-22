"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { GaiaLogo } from "@/components/brand";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string; general?: string }>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: { username?: string; password?: string } = {};
    if (!username.trim()) nextErrors.username = "User name is required";
    if (!password.trim()) nextErrors.password = "Password is required";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: username, password }),
      });
      const json = await res.json();
      if (json.success) {
        window.location.href = "/";
      } else {
        setErrors({ general: json.error || "Login failed. Please check your credentials." });
      }
    } catch {
      setErrors({ general: "Connection error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <GaiaLogo className="h-auto w-40" />
        </div>

        <div className="rounded-xl border border-border bg-card p-7 shadow-2xl shadow-black/40">
          <h1 className="text-lg font-semibold text-foreground">Sign in</h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">
            Welcome back to the costing workspace.
          </p>

          {errors.general && (
            <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                User name
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="you@example.com"
                className={`w-full rounded-lg border bg-input/30 px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/30 ${
                  errors.username ? "border-destructive" : "border-border"
                }`}
              />
              {errors.username && <p className="mt-1.5 text-xs text-destructive">{errors.username}</p>}
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full rounded-lg border bg-input/30 px-3.5 py-2.5 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/30 ${
                    errors.password ? "border-destructive" : "border-border"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-destructive">{errors.password}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg border border-border bg-white py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
