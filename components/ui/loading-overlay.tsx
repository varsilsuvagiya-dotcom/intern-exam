import Image from "next/image";

/// The full-screen loading state: the CloudUS mark on a white page.
///
/// The ground is opaque rather than translucent: the logo is a dark wordmark
/// and needs a solid light surface to read against. `backdrop-blur` is kept so
/// anything that does paint behind it stays soft.
///
/// A `div`, not a `main`: during a route transition Next renders this
/// alongside the outgoing page, and two `main` landmarks existed at once. It
/// is a status region announcing progress, not the page's main content.
export function LoadingOverlay({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-exam-surface px-6 backdrop-blur-md"
    >
      <Image
        src="/cloudus-logo.png"
        alt=""
        width={2825}
        height={685}
        priority
        className="h-14 w-auto max-w-[80vw]"
      />

      {/* Indeterminate: the sweep says "working", it does not claim to know
          how far along the load is. */}
      <div
        aria-hidden="true"
        className="h-0.5 w-56 max-w-[70vw] overflow-hidden rounded-full bg-exam-inset"
      >
        <span className="block h-full w-1/3 rounded-full bg-exam-primary motion-safe:animate-[loader-sweep_1.4s_ease-in-out_infinite]" />
      </div>

      <p className="text-sm text-exam-muted">{label}</p>
    </div>
  );
}
