import type { ReactNode } from "react";

/// The candidate examination frame.
///
/// This is a visual scope, **not** an authorization boundary — `/exam` keeps
/// its own session check and `/exam/start` is deliberately open. All this does
/// is put every candidate surface inside `.cloudus-exam` so the examination
/// tokens apply and cannot reach the admin panel or the public landing page.
///
/// `min-h-screen` rather than `h-screen`: a long question with a code block
/// must be able to grow past the viewport and scroll normally.
export default function ExamLayout({ children }: { children: ReactNode }) {
  return <div className="cloudus-exam flex min-h-screen w-full flex-col">{children}</div>;
}
