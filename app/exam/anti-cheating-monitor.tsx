"use client";

import { useEffect, useRef, useState } from "react";

import { AlertTriangle } from "lucide-react";

import { ExamButton } from "@/components/exam/button";
import { canonicalViolationType, shouldReport } from "@/lib/exam/anti-cheating/dedup";
import type { RecordViolationResult, ViolationType } from "@/lib/exam/anti-cheating/types";

import { reportViolation } from "./actions";

/// Detects and reports browser-observable anti-cheating events during an
/// active examination, and shows the warning/termination UI the server's
/// response calls for.
///
/// What this component is NOT: a security boundary. Every check here can be
/// defeated by a determined candidate with OS-level access (a second device,
/// a screenshot, a VM). It exists to catch ordinary, casual attempts —
/// switching tabs, copying a question out, opening DevTools by habit — and to
/// give the server something to count. The server is what decides whether an
/// attempt ends; this component only reports what it saw.
///
/// Mounted once, only while the exam is live (ExamShell stops rendering it
/// once `finalStatus`/termination is set), and scoped to the exam route: it
/// attaches document-level listeners for the lifetime of the exam screen and
/// removes them on unmount, so nothing here reaches outside `/exam`.
export function AntiCheatingMonitor({
  onTerminated,
}: {
  onTerminated: () => void;
}) {
  const [warning, setWarning] = useState<{ count: number; limit: number } | null>(null);
  /// True once an automatic re-entry into fullscreen has been rejected by the
  /// browser. `requestFullscreen()` only succeeds when called synchronously
  /// from a user gesture (a click, a keypress); calling it from inside a
  /// `fullscreenchange` handler — which is what firing this after Esc means —
  /// has no gesture of its own to ride on, so browsers correctly refuse it.
  /// The fix is the same one every other site with this problem uses: ask for
  /// one click, which *is* a fresh gesture.
  const [needsFullscreenResume, setNeedsFullscreenResume] = useState(false);

  // Dedup window: several browser events can fire for one candidate action
  // (blur often accompanies visibilitychange, for instance). A report is
  // skipped if an equivalent one was just sent, so one incident is not
  // counted twice — see lib/exam/anti-cheating/dedup.ts for the rule itself,
  // kept pure and separate so it can be unit tested without a browser.
  const lastReported = useRef<{ type: ViolationType; at: number } | null>(null);

  const reporting = useRef(false);

  const report = (type: ViolationType, metadata?: Record<string, unknown>) => {
    const now = Date.now();

    if (!shouldReport(type, now, lastReported.current)) {
      return;
    }
    lastReported.current = { type: canonicalViolationType(type), at: now };

    // Reports are fire-and-forget in the sense that the candidate cannot do
    // anything about a dropped one — the exam is unaffected either way. But
    // outcomes are not swallowed: warning/terminated results drive the UI
    // below, and the server remains the sole authority on the count.
    void reportViolation(type, metadata)
      .then((result: RecordViolationResult) => {
        if (result.kind === "warning") {
          setWarning({ count: result.count, limit: result.limit });
        } else if (result.kind === "terminated") {
          onTerminated();
        }
        // "already-final" / "unauthorized": the exam has already ended by some
        // other route (submit, auto-submit, a prior termination); nothing to
        // show here, the shell is about to stop rendering this component.
      })
      .catch(() => {
        // Network failure reporting a violation. Not retried: retrying a
        // stale event on a flaky connection risks reporting it twice under a
        // different dedup window, and a missed event here is not a
        // correctness problem for the exam itself.
      });
  };

  // Tab/window monitoring. `visibilitychange` fires when the tab itself is
  // hidden (switched away, minimized); `blur` fires on the window losing
  // focus more broadly (another app brought forward). Both are legitimate
  // signals and both are deduplicated against each other above.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        report("TAB_SWITCH");
      }
    };
    const onBlur = () => report("WINDOW_BLUR");

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fullscreen exit. Restoring fullscreen is attempted once, quietly, rather
  // than looped: a candidate who does not grant it back (or whose browser
  // blocks a script-initiated request outside a user gesture) is not fought
  // over it repeatedly. The violation is recorded either way.
  useEffect(() => {
    const onFullscreenChange = () => {
      if (document.fullscreenElement) {
        setNeedsFullscreenResume(false);
        return;
      }

      report("FULLSCREEN_EXIT");

      const root = document.documentElement;
      if (root.requestFullscreen) {
        root.requestFullscreen().catch(() => {
          // No user gesture to ride on from inside this handler — expected,
          // not an error. The resume prompt below supplies the gesture.
          setNeedsFullscreenResume(true);
        });
      }
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resumeFullscreen = () => {
    document.documentElement.requestFullscreen?.().then(
      () => setNeedsFullscreenResume(false),
      () => {
        // Still refused (e.g. the browser itself disallows fullscreen here).
        // Leave the prompt up rather than pretending it worked.
      },
    );
  };

  // Clipboard, context menu, drag/drop, print, and restricted shortcuts.
  // Scoped to the document while this component is mounted (i.e. only while
  // the exam screen is live), not attached globally to the app.
  useEffect(() => {
    const isFormField = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      const tag = el?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA";
    };

    // Right-click, copy, cut and paste are blocked outright but deliberately
    // not reported as violations: they are the most common accidental
    // triggers (an ordinary right-click, a reflexive Ctrl+C) and counting
    // them would exhaust the warning budget on harmless behaviour. Silently
    // preventing the action is the actual deterrent here; the violation
    // budget is reserved for signals that the candidate left the exam or
    // reached for a real bypass (tab switch, DevTools, restricted shortcuts).
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const onCopy = (event: ClipboardEvent) => {
      event.preventDefault();
    };

    const onCut = (event: ClipboardEvent) => {
      // A free-text answer field must stay usable, so cutting typed input
      // works normally there; only cutting exam content elsewhere is blocked.
      if (isFormField(event.target)) return;
      event.preventDefault();
    };

    const onPaste = (event: ClipboardEvent) => {
      event.preventDefault();
    };

    // Blocked but not reported, same reasoning as the clipboard events above.
    const onDragStart = (event: DragEvent) => {
      if (isFormField(event.target)) return;
      event.preventDefault();
    };

    const onDrop = (event: DragEvent) => {
      event.preventDefault();
    };

    const onBeforePrint = () => {};

    // Keyboard shortcuts. Only the combinations named in scope are
    // intercepted; plain typing, arrow keys, Tab, Enter and Space are never
    // touched, and form fields keep normal Ctrl/Cmd+A/C/V/X so answering a
    // free-text question still works.
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      // Refresh/reload is blocked but not reported: it would otherwise route
      // through the normal resume flow anyway (the exam restores exactly
      // where it left off), so a stray F5 is not worth counting.
      if (key === "f5" || (meta && key === "r")) {
        event.preventDefault();
        return;
      }

      // DevTools and view-source shortcuts are blocked but not reported, same
      // reasoning as the clipboard/print/save shortcuts above: pressing F12
      // out of habit is common and not itself proof of anything. The
      // window-dimension heuristic further down remains the actual DevTools
      // signal that counts, because it reflects the panel being open rather
      // than a single keypress.
      if (key === "f12") {
        event.preventDefault();
        return;
      }

      if (meta && event.shiftKey && ["i", "j", "c"].includes(key)) {
        event.preventDefault();
        return;
      }

      if (meta && key === "u") {
        event.preventDefault();
        return;
      }

      // Print and save-page are blocked but not reported, same reasoning as
      // the clipboard shortcuts: a reflexive Ctrl+P/Ctrl+S is common and not
      // worth spending the violation budget on.
      if (meta && key === "p") {
        event.preventDefault();
        return;
      }

      if (meta && key === "s") {
        event.preventDefault();
        return;
      }

      // Blocked but not reported, same as the clipboard events above: these
      // are the shortcut form of copy/cut/paste/select-all, not a distinct
      // signal worth spending the violation budget on.
      if (!isFormField(event.target) && meta && ["c", "x", "v", "a"].includes(key)) {
        event.preventDefault();
      }
    };

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("drop", onDrop);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("beforeprint", onBeforePrint);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("drop", onDrop);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("beforeprint", onBeforePrint);
    };
  }, []);

  // DevTools dimension heuristic. Deliberately soft: a large, sustained gap
  // between outer and inner window dimensions can indicate a docked DevTools
  // panel, but is equally explained by browser zoom, OS scaling, or unusual
  // window chrome — so this alone never terminates anything, only reports
  // like any other event, and is heavily debounced so resizing the window
  // does not generate a stream of them.
  useEffect(() => {
    const THRESHOLD_PX = 160;
    let lastSignalAt = 0;

    const check = () => {
      const widthGap = window.outerWidth - window.innerWidth;
      const heightGap = window.outerHeight - window.innerHeight;
      const likely = widthGap > THRESHOLD_PX || heightGap > THRESHOLD_PX;
      const now = Date.now();

      // Only re-reported after a stretch of continued sustained gap, not on
      // every resize tick.
      if (likely && now - lastSignalAt > 30_000) {
        lastSignalAt = now;
        report("DEVTOOLS", { heuristic: "window-dimensions" });
      }
    };

    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Page leave. Not relied on for security — a candidate can always close the
  // tab outright, and the browser gives no way to stop that — but a
  // confirmation prompt at least catches an accidental navigation, and the
  // attempt itself is unaffected either way since state is already persisted
  // server-side as the candidate goes.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      report("PAGE_LEAVE");
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Best-effort fullscreen entry at mount. Browsers require this to originate
  // from a user gesture in many cases; a rejection is expected and silent —
  // ExamShell's own start flow (Before You Begin) is the actual gesture this
  // rides on when it works, and the exam is fully usable without fullscreen
  // when it does not.
  useEffect(() => {
    if (reporting.current) return;
    reporting.current = true;

    const root = document.documentElement;
    if (root.requestFullscreen && !document.fullscreenElement) {
      root.requestFullscreen().catch(() => {});
    }
  }, []);

  const dismiss = () => {
    setWarning(null);
    // The click that dismisses this dialog is itself a fresh user gesture, so
    // it is the natural place to retry entering fullscreen if the earlier
    // automatic attempt was refused.
    if (needsFullscreenResume) {
      resumeFullscreen();
    }
  };

  if (needsFullscreenResume && !warning) {
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="anti-cheat-fullscreen-title"
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 sm:p-6"
      >
        <div className="w-full max-w-md rounded-exam-lg border border-exam-line bg-exam-surface p-5 shadow-exam-lg sm:p-6">
          <div className="flex gap-3">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-exam-warning" />
            <div className="min-w-0">
              <h2 id="anti-cheat-fullscreen-title" className="text-lg font-semibold text-exam-ink">
                Return to fullscreen
              </h2>
              <p className="mt-2 text-sm text-exam-ink-secondary">
                Your examination must stay in fullscreen. Click below to continue.
              </p>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <ExamButton variant="primary" onClick={resumeFullscreen} autoFocus>
              Resume fullscreen
            </ExamButton>
          </div>
        </div>
      </div>
    );
  }

  if (!warning) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="anti-cheat-warning-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 sm:p-6"
    >
      <div className="w-full max-w-md rounded-exam-lg border border-exam-warning/40 bg-exam-surface p-5 shadow-exam-lg sm:p-6">
        <div className="flex gap-3">
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-6 shrink-0 text-exam-warning"
          />
          <div className="min-w-0">
            <h2 id="anti-cheat-warning-title" className="text-lg font-semibold text-exam-ink">
              Unauthorized activity detected
            </h2>
            <p className="mt-2 text-sm text-exam-ink-secondary">
              We detected activity that is not permitted during the examination.
            </p>
            <p className="mt-2 text-sm font-semibold text-exam-warning">
              Warning {warning.count} of {warning.limit}
            </p>
            <p className="mt-2 text-sm text-exam-ink-secondary">
              Please remain on the examination screen and do not use restricted browser actions.
              If unauthorized activity continues, your examination may be terminated automatically.
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <ExamButton variant="primary" onClick={dismiss} autoFocus>
            I understand
          </ExamButton>
        </div>
      </div>
    </div>
  );
}
