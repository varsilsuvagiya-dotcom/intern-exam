"use client";

import { PrismAsyncLight as SyntaxHighlighter } from "react-syntax-highlighter";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import vscDarkPlus from "react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus";

SyntaxHighlighter.registerLanguage("javascript", javascript);

/// The code a candidate is asked to read, styled like an editor rather than a
/// flat grey box: a dark theme with real JS syntax colour, and a title bar so
/// it visually reads as "code" before a word of it is parsed.
///
/// Every CloudUS section that carries a code block writes it in JS, so one
/// language is registered rather than the full Prism grammar set — no reason
/// to ship every language's tokenizer for source that is always JS.
export function CodeBlock({ code }: { code: string }) {
  return (
    <div
      role="group"
      aria-label="Code for this question"
      className="mt-4 max-w-full overflow-hidden rounded-exam-md border border-[#3c3c3c] bg-[#1e1e1e] shadow-sm"
    >
      {/* Title bar: the traffic-light dots are decorative only — there is
          nothing here for them to control — so they carry no accessible name
          and no ability to focus. */}
      <div
        aria-hidden="true"
        className="flex items-center gap-1.5 border-b border-[#3c3c3c] bg-[#2d2d2d] px-4 py-2.5"
      >
        <span className="size-2.5 rounded-full bg-[#ff5f56]" />
        <span className="size-2.5 rounded-full bg-[#ffbd2e]" />
        <span className="size-2.5 rounded-full bg-[#27c93f]" />
      </div>

      {/* `min-w-0` on the article's children is what keeps a long code line
          scrolling inside this box instead of widening the page. Focusable so
          a keyboard user can scroll it without a mouse. */}
      <div tabIndex={0} className="max-w-full overflow-x-auto">
        <SyntaxHighlighter
          language="javascript"
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: "1rem",
            background: "transparent",
            fontSize: "13px",
            lineHeight: "1.7",
          }}
          codeTagProps={{ style: { fontFamily: "var(--font-mono, monospace)" } }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
