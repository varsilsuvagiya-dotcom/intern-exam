"use server";

import { startOrResumeExam, type StartOutcome } from "@/lib/exam/start-exam";

export type StartState = StartOutcome | { kind: "idle" };

export async function startExam(_prev: StartState, formData: FormData): Promise<StartState> {
  // No admin session here: this is the candidate-facing entry point. Eligibility
  // is the authorization, and it is decided server-side from the mobile lookup.
  return startOrResumeExam(formData);
}
