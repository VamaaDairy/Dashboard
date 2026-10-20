"use client";

import { useEffect } from "react";

/** Last resort when the root layout itself fails. It replaces the whole document, so it carries its own styles. */
export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          background: "#fafafa",
          color: "#18181b",
        }}
      >
        <title>Something went wrong</title>
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>The app hit a problem</h1>
          <p style={{ fontSize: 14, color: "#52525b", margin: "0 0 20px" }}>
            Please try again. If it keeps happening, contact the admin and quote the reference below.
          </p>
          <button
            onClick={() => retry()}
            style={{
              background: "#3E9B4F",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ fontSize: 12, color: "#71717a", marginTop: 16 }}>Reference: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
