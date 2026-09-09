"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { Eye, EyeOff } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

import { login, type LoginState } from "./actions";

const LABEL = "block text-[13px] leading-4 font-medium text-ink";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, null);
  const [visible, setVisible] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const error = state?.error;

  // The alert is announced by its own role="alert"; this only scrolls it into
  // view on a short viewport. Focus is deliberately left where it is so a
  // keyboard user is not yanked out of the field they were correcting.
  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [error]);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      {/* A failed sign-in is an Alert, never a toast: the admin has to read it
          and act on it, so it stays until the next attempt. */}
      {error ? (
        <div ref={errorRef}>
          <Alert tone="danger">{error}</Alert>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="email" className={LABEL}>
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          required
          disabled={pending}
          // Both fields are marked invalid on failure because the server
          // deliberately does not say which one was wrong.
          invalid={Boolean(error)}
          aria-describedby={error ? "login-error" : undefined}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className={LABEL}>
          Password
        </label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            required
            disabled={pending}
            invalid={Boolean(error)}
            aria-describedby={error ? "login-error" : undefined}
            className="pr-11"
          />
          {/* Purely a rendering toggle on the existing input — the value never
              leaves the field and no authentication behaviour changes. */}
          <button
            type="button"
            onClick={() => setVisible((shown) => !shown)}
            disabled={pending}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted transition-colors duration-[120ms] hover:text-ink disabled:text-disabled"
          >
            {visible ? (
              <EyeOff aria-hidden="true" className="size-4" />
            ) : (
              <Eye aria-hidden="true" className="size-4" />
            )}
          </button>
        </div>
      </div>

      {/* Referenced by aria-describedby on both fields, so a screen reader
          reaching either one hears why the attempt failed. */}
      {error ? (
        <span id="login-error" className="sr-only">
          {error}
        </span>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={pending}
        loadingLabel="Signing in…"
        className="mt-2 w-full"
      >
        Sign in
      </Button>
    </form>
  );
}
