"use client";

import Link from "next/link";
import { useActionState } from "react";

import { startExam, type StartState } from "./actions";

const FIELD =
  "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20";
const NOTICE = "mt-6 rounded-lg border border-black/10 p-4 text-sm dark:border-white/15";

export function StartForm() {
  const [state, start, starting] = useActionState<StartState, FormData>(startExam, { kind: "idle" });

  const errorFor = (field: string): string | undefined =>
    state.kind === "invalid" ? state.errors.find((error) => error.field === field)?.message : undefined;

  if (state.kind === "started") {
    return (
      <div className={NOTICE} role="status">
        <p className="font-medium">
          {state.resumed ? "Welcome back." : "You are ready to begin."}
        </p>
        <p className="mt-1 text-black/70 dark:text-white/70">
          {state.resumed
            ? "Your exam is already in progress and will continue where you left off."
            : "Your exam has been started."}
        </p>
        <Link
          href="/exam"
          className="mt-4 inline-block rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          {state.resumed ? "Continue exam" : "Open exam"}
        </Link>
      </div>
    );
  }

  if (state.kind === "completed") {
    return (
      <div className={NOTICE} role="status">
        You have already completed this exam.
      </div>
    );
  }

  if (state.kind === "closed") {
    return (
      <div className={NOTICE} role="status">
        The exam is currently closed. Please contact the administrator.
      </div>
    );
  }

  return (
    <form action={start} className="mt-8 space-y-4">
      <label className="block text-sm font-medium">
        Full name
        <input name="name" maxLength={200} required autoComplete="name" className={FIELD} />
        {errorFor("name") ? (
          <span className="mt-1 block text-sm font-normal text-red-600 dark:text-red-400">
            {errorFor("name")}
          </span>
        ) : null}
      </label>

      <label className="block text-sm font-medium">
        Email
        <input name="email" type="email" maxLength={320} required autoComplete="email" className={FIELD} />
        {errorFor("email") ? (
          <span className="mt-1 block text-sm font-normal text-red-600 dark:text-red-400">
            {errorFor("email")}
          </span>
        ) : null}
      </label>

      <label className="block text-sm font-medium">
        Mobile number
        <input name="mobile" inputMode="tel" maxLength={20} required autoComplete="tel" className={FIELD} />
        <span className="mt-1 block text-sm font-normal text-black/50 dark:text-white/50">
          Please enter the same mobile number you used in the application form.
        </span>
        {errorFor("mobile") ? (
          <span className="mt-1 block text-sm font-normal text-red-600 dark:text-red-400">
            {errorFor("mobile")}
          </span>
        ) : null}
      </label>

      {state.kind === "ineligible" ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Please enter the same mobile number you used in the application form.
        </p>
      ) : null}

      {state.kind === "failed" ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          The exam could not be started. Please tell your supervisor.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={starting}
        className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {starting ? "Starting…" : "Start exam"}
      </button>
    </form>
  );
}
