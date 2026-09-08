"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>CloudUS is unavailable</h1>
        <p style={{ marginTop: "0.75rem", opacity: 0.7 }}>
          An unexpected error stopped the application from loading.
        </p>
        <button type="button" onClick={reset} style={{ marginTop: "1.5rem" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
