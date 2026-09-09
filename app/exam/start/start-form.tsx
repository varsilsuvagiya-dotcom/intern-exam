"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";

import { examButtonClass, ExamButton } from "@/components/exam/button";
import { ExamField, ExamInput } from "@/components/exam/field";
import { ExamNotice, ExamPanel } from "@/components/exam/surface";

import { startExam, type StartState } from "./actions";

/// The examination entry form.
///
/// The action, the field names, the validation and every server message are
/// unchanged from before this phase — `startOrResumeExam` still decides
/// everything. What changed is that the states are now told apart visually and
/// the fields are wired for assistive technology.
export function StartForm({ className = "" }: { className?: string }) {
  const [state, start, starting] = useActionState<StartState, FormData>(startExam, {
    kind: "idle",
  });

  const errorFor = (field: string): string | undefined =>
    state.kind === "invalid"
      ? state.errors.find((error) => error.field === field)?.message
      : undefined;

  // Verified and ready to enter. The resume wording is driven by the server's
  // own `resumed` flag — the page never guesses whether an attempt exists.
  if (state.kind === "started") {
    return (
      <ExamPanel as="section" className={className}>
        <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
          <CheckCircle2 aria-hidden="true" className="size-6 text-exam-success" />
          <div role="status">
            <p className="text-base font-semibold text-exam-ink">
              {state.resumed ? "You have an examination in progress" : "You are ready to begin"}
            </p>
            <p className="mt-1.5 text-sm text-exam-muted">
              {state.resumed
                ? "You will return to the question you were working on, with your answers intact. Your remaining time has kept running since you started."
                : "Your examination has been prepared. The timer starts when you open it."}
            </p>
          </div>
          <Link
            href="/exam"
            className={examButtonClass("primary", "lg", "mt-2 w-full sm:w-auto")}
          >
            {state.resumed ? "Resume examination" : "Open examination"}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </ExamPanel>
    );
  }

  if (state.kind === "completed") {
    return (
      <ExamNotice tone="info" title="You have already completed this examination" className={className}>
        Your answers were submitted and recorded. Our team will contact shortlisted candidates.
      </ExamNotice>
    );
  }

  // The exam can close between the page rendering and the form being
  // submitted, so this state exists in addition to the page-level one.
  if (state.kind === "closed") {
    return (
      <ExamNotice tone="warning" title="This examination is currently closed" className={className}>
        You cannot begin at the moment. Please speak to your examination supervisor.
      </ExamNotice>
    );
  }

  return (
    <ExamPanel as="section" aria-labelledby="your-details" className={className}>
      <h2
        id="your-details"
        className="border-b border-exam-line px-5 py-3 text-sm font-semibold text-exam-ink"
      >
        Your details
      </h2>

      <form action={start} className="flex flex-col gap-5 px-5 py-5">
        <ExamField id="candidate-name" label="Full name" error={errorFor("name")}>
          {(field) => (
            <ExamInput
              {...field}
              name="name"
              maxLength={200}
              required
              autoComplete="name"
              autoCapitalize="words"
            />
          )}
        </ExamField>

        <ExamField id="candidate-email" label="Email" error={errorFor("email")}>
          {(field) => (
            <ExamInput
              {...field}
              name="email"
              type="email"
              maxLength={320}
              required
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
            />
          )}
        </ExamField>

        <ExamField
          id="candidate-mobile"
          label="Mobile number"
          hint="Please enter the same mobile number you used in the application form."
          error={errorFor("mobile")}
        >
          {(field) => (
            <ExamInput
              {...field}
              name="mobile"
              inputMode="tel"
              maxLength={20}
              required
              autoComplete="tel"
            />
          )}
        </ExamField>

        {/* Both server-decided failures. The wording is unchanged: an
            unrecognised number and a malformed one deliberately produce the
            same message, so neither reveals whether a number is registered. */}
        {state.kind === "ineligible" ? (
          <ExamNotice tone="danger" title="We could not verify your details">
            Please enter the same mobile number you used in the application form. If it is correct,
            speak to your examination supervisor.
          </ExamNotice>
        ) : null}

        {state.kind === "failed" ? (
          <ExamNotice tone="danger" title="The examination could not be started">
            Please tell your examination supervisor.
          </ExamNotice>
        ) : null}

        <ExamButton
          type="submit"
          variant="primary"
          size="lg"
          loading={starting}
          loadingLabel="Verifying…"
          className="w-full"
        >
          Start examination
        </ExamButton>

        <p className="flex items-start gap-2 text-[13px] text-exam-muted">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            Your details are checked against your application before the examination begins.
          </span>
        </p>
      </form>
    </ExamPanel>
  );
}
