"use client";

import React, { useState } from "react";
import { ClipboardIllustration, GaiaLogo } from "@/components/brand";

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
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-white to-slate-50 font-sans px-6 py-10 box-border">
      <div className="w-full max-w-6xl flex items-center justify-between gap-10 flex-wrap">
        {/* Left illustration */}
        <div className="flex-1 min-w-[280px] max-w-[520px] basis-[420px]">
          <ClipboardIllustration className="w-full h-auto" />
        </div>

        {/* Right login card */}
        <div className="flex-1 min-w-[300px] max-w-[420px] basis-[380px]">
          <div className="mb-2">
            <GaiaLogo className="w-full h-auto max-w-[300px]" />
          </div>

          <h1 className="text-4xl font-bold text-neutral-800 mt-2 mb-2">Login</h1>
          <p className="text-gray-400 text-[15px] mb-7">
            Welcome back, please login to the costing workspace.
          </p>

          {errors.general && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <label htmlFor="username" className="block text-sm font-semibold text-neutral-800 mb-2">
              <span className="text-red-500">*</span> User Name :
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter User Name"
              className={`w-full box-border px-4 py-3.5 text-sm rounded-lg bg-slate-50 outline-none border ${
                errors.username ? "border-red-500 mb-1" : "border-slate-200 mb-5"
              }`}
            />
            {errors.username && <div className="text-red-500 text-xs mb-4">{errors.username}</div>}

            <label htmlFor="password" className="block text-sm font-semibold text-neutral-800 mb-2">
              <span className="text-red-500">*</span> Password :
            </label>
            <div className={`relative ${errors.password ? "mb-1" : "mb-7"}`}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter Password"
                className={`w-full box-border pl-4 pr-11 py-3.5 text-sm rounded-lg bg-slate-50 outline-none border ${
                  errors.password ? "border-red-500" : "border-slate-200"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-gray-400 flex items-center p-0"
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M3 3l18 18M10.6 10.7a3 3 0 0 0 4.2 4.2M6.6 6.7C4.3 8.2 2.7 10.4 2 12c0 0 3.5 7 10 7 1.9 0 3.5-.5 4.9-1.3M9.9 5.2A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7-.4.8-1.1 1.9-2.1 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && <div className="text-red-500 text-xs mb-6">{errors.password}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 text-[15px] font-semibold text-white bg-blue-800 hover:bg-blue-900 disabled:opacity-60 disabled:cursor-not-allowed border-none rounded-lg cursor-pointer transition-colors duration-150"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
