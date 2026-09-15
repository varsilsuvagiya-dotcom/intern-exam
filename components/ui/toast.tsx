"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

import type { StatusTone } from "./badge";

/// Transient confirmation that an action completed: "that worked, carry on."
///
/// A toast never replaces an Alert. Anything the admin has to act on — a
/// validation failure, a save that did not go through — belongs in the content
/// flow where it persists. Accordingly `error` toasts never auto-dismiss, and
/// should be rare.

export type ToastTone = Extract<StatusTone, "success" | "warning" | "danger" | "info">;

export type ToastInput = {
  tone?: ToastTone;
  message: string;
  /// One short supporting line. Anything longer belongs in an Alert.
  detail?: string;
};

type Toast = ToastInput & {
  id: number;
  tone: ToastTone;
  /// Repeats of the same message increment this instead of stacking duplicates.
  count: number;
};

const DURATION: Record<ToastTone, number | null> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  // Never auto-dismisses: an error the admin has not read is worse than clutter.
  danger: null,
};

const MAX_VISIBLE = 3;

const TONE: Record<ToastTone, { accent: string; icon: typeof Info; fg: string }> = {
  success: { accent: "bg-success", icon: CheckCircle2, fg: "text-success" },
  warning: { accent: "bg-warning", icon: AlertTriangle, fg: "text-warning" },
  danger: { accent: "bg-danger", icon: AlertCircle, fg: "text-danger" },
  info: { accent: "bg-info", icon: Info, fg: "text-info" },
};

type ToastContextValue = { push: (toast: ToastInput) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

/// Raises a toast. Prefer `useActionToast` below, which derives toasts from a
/// Server Action's own result rather than firing them imperatively.
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside <ToastProvider>.");
  }

  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((input: ToastInput) => {
    const tone = input.tone ?? "success";

    setToasts((current) => {
      // A repeat of the message already on screen bumps its count rather than
      // stacking an identical card.
      const last = current[current.length - 1];

      if (last && last.message === input.message && last.tone === tone) {
        return [...current.slice(0, -1), { ...last, count: last.count + 1 }];
      }

      const toast: Toast = { ...input, tone, id: nextId.current++, count: 1 };

      // Oldest falls off the top once the stack is full.
      return [...current, toast].slice(-MAX_VISIBLE);
    });
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/*
        Both live regions exist from first render, before any toast does.
        Creating a live region at the same moment as its content is the classic
        way to make screen readers miss the announcement entirely.

        Two regions because the politeness differs by tone: success and info
        wait for a pause, warnings and errors interrupt.
      */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed top-0 right-0 z-50 flex w-full flex-col-reverse items-center gap-2 p-4 md:w-auto md:items-end md:p-6"
      >
        {toasts
          .filter((toast) => toast.tone === "success" || toast.tone === "info")
          .map((toast) => (
            <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
      </div>

      <div
        aria-live="assertive"
        role="alert"
        aria-atomic="false"
        className="pointer-events-none fixed top-0 right-0 z-50 flex w-full flex-col-reverse items-center gap-2 p-4 md:w-auto md:items-end md:p-6"
      >
        {toasts
          .filter((toast) => toast.tone === "warning" || toast.tone === "danger")
          .map((toast) => (
            <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const { accent, icon: Icon, fg } = TONE[toast.tone];
  const [paused, setPaused] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const duration = DURATION[toast.tone];

  useEffect(() => {
    // Hovering or focusing holds the toast open — otherwise it can vanish
    // mid-read, which is the most common complaint about toast systems.
    if (duration === null || paused) {
      return;
    }

    const timer = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timer);
    // `toast.count` restarts the timer when a repeat arrives.
  }, [duration, paused, toast.id, toast.count, onDismiss]);

  return (
    <div
      ref={cardRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onDismiss(toast.id);
        }
      }}
      className={[
        "pointer-events-auto relative flex w-full items-center gap-3 overflow-hidden",
        "rounded-md border border-line bg-surface py-3 pl-4 pr-2 shadow-lg",
        "md:w-auto md:min-w-[280px] md:max-w-[400px]",
        "motion-safe:animate-[toast-in_180ms_ease-out]",
      ].join(" ")}
    >
      {/* 3px status bar: carries the tone without tinting the whole surface,
          which keeps toasts visually distinct from inline alerts. */}
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-[3px] ${accent}`} />

      <Icon aria-hidden="true" className={`size-4 shrink-0 ${fg}`} />

      <div className="min-w-0 flex-1 text-sm text-ink">
        <p className="font-medium">
          {toast.message}
          {toast.count > 1 ? (
            <span className="ml-1.5 text-xs font-normal text-muted">×{toast.count}</span>
          ) : null}
        </p>
        {toast.detail ? <p className="mt-0.5 text-xs text-muted">{toast.detail}</p> : null}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-[120ms] hover:bg-subtle hover:text-ink max-md:size-11"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

/// Derives a toast from a Server Action's own result.
///
/// This is the intended way to raise toasts. The alternative — calling a global
/// `toast()` imperatively wherever it seems useful — lets a success message fire
/// without the mutation having actually succeeded. Here the server's returned
/// state is the trigger, so a toast can only follow a real result.
///
/// `state` is whatever the action returns through `useActionState`; `select`
/// maps it to a toast, or to null when the state does not warrant one.
export function useActionToast<T>(
  state: T,
  select: (state: T) => ToastInput | null,
): void {
  const { push } = useToast();
  const seen = useRef<T | undefined>(undefined);
  const selectRef = useRef(select);

  // Kept current in an effect rather than during render: writing a ref while
  // rendering is impure and breaks under concurrent rendering.
  useEffect(() => {
    selectRef.current = select;
  });

  useEffect(() => {
    // Only fire on a genuine transition, so a re-render with the same result
    // does not repeat the toast.
    if (seen.current === state) {
      return;
    }

    seen.current = state;
    const toast = selectRef.current(state);

    if (toast) {
      push(toast);
    }
  }, [state, push]);
}
