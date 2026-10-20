"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Catches a crash in any page and keeps the sidebar and the rest of the app usable. */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md space-y-5 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
        </div>
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            This page hit an unexpected problem. Your data is safe - try again, or head back to the dashboard.
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <Button variant="primary" onClick={() => retry()}>Try again</Button>
          <Link href="/" className="inline-flex"><Button variant="outline">Go to dashboard</Button></Link>
        </div>
        {error.digest && (
          <p className="text-xs text-muted-foreground">
            Reference: <code className="rounded bg-muted px-1.5 py-0.5">{error.digest}</code>
          </p>
        )}
      </div>
    </div>
  );
}
