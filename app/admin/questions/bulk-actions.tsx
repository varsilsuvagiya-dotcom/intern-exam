"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import {
  DifficultyChip,
  QuestionActiveBadge,
} from "@/components/admin/question-status-badge";
import { Alert } from "@/components/ui/alert";
import { Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { useActionToast } from "@/components/ui/toast";
import type { QuestionListItem } from "@/lib/question-bank/query-questions";

import { bulkActivate, bulkDeactivate, type BulkState } from "./actions";

/// The selectable question table.
///
/// Selection is client state — it is transient and never needs to survive a
/// reload. Everything that *decides* anything stays on the server: the readiness
/// shown here is computed server-side and sent down, and the actions re-read and
/// re-validate every question from the database before writing. A tampered
/// checkbox can therefore change which ids are submitted, but never whether a
/// question is fit to be activated.

const IDLE: BulkState = { status: "idle" };

function ReasonList({ reasons }: { reasons: string[] }) {
  return (
    <ul className="mt-1 list-inside list-disc">
      {reasons.map((reason) => (
        <li key={reason}>{reason}</li>
      ))}
    </ul>
  );
}

function Result({ state }: { state: BulkState }) {
  // Success is a toast (see useActionToast below): a transient confirmation
  // that does not need to sit in the page after the admin has read it. An
  // error stays here as a persistent Alert — the admin may have a list of
  // problem ids to work through, which a toast has no room for and which
  // should not vanish on its own.
  if (state.status !== "error") return null;

  return (
    <Alert tone="danger" title={state.message} className="mt-4">
      {state.problems ? (
        <ul className="space-y-2">
          {state.problems.slice(0, 20).map((problem) => (
            <li key={problem.id}>
              <span className="tabular font-medium">{problem.id}</span>
              <ReasonList reasons={problem.reasons} />
            </li>
          ))}
          {state.problems.length > 20 ? (
            <li>and {state.problems.length - 20} more.</li>
          ) : null}
        </ul>
      ) : null}
    </Alert>
  );
}

export function QuestionTable({
  questions,
  reasonLabels,
}: {
  questions: QuestionListItem[];
  /// Reason code to sentence, resolved on the server so the mapping has one home.
  reasonLabels: Record<string, string>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activateState, activate, activating] = useActionState(bulkActivate, IDLE);
  const [deactivateState, deactivate, deactivating] = useActionState(bulkDeactivate, IDLE);

  const busy = activating || deactivating;
  const ids = [...selected].join(",");
  const allShown = questions.length > 0 && questions.every((q) => selected.has(q.id));

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allShown) {
        for (const question of questions) next.delete(question.id);
      } else {
        for (const question of questions) next.add(question.id);
      }
      return next;
    });
  };

  // The most recent action's result is the one worth showing.
  const state = activateState.status !== "idle" ? activateState : deactivateState;

  // A success fires a toast, which auto-dismisses on its own (see
  // components/ui/toast.tsx); an error is left to the persistent Alert below.
  useActionToast(state, (current) =>
    current.status === "done" ? { tone: "success", message: current.message } : null,
  );

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-subtle px-4 py-3">
        <p className="text-sm text-ink-secondary">
          {selected.size === 0
            ? "No questions selected"
            : `${selected.size} selected`}
        </p>

        <div className="ms-auto flex flex-wrap items-center gap-2">
          <form action={activate}>
            <input type="hidden" name="ids" value={ids} />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={selected.size === 0 || busy}
              loading={activating}
              loadingLabel="Activating…"
            >
              Activate
            </Button>
          </form>

          <form action={deactivate}>
            <input type="hidden" name="ids" value={ids} />
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={selected.size === 0 || busy}
              loading={deactivating}
              loadingLabel="Deactivating…"
            >
              Deactivate
            </Button>
          </form>

          {selected.size > 0 ? (
            <Button
              type="button"
              variant="tertiary"
              size="sm"
              onClick={() => setSelected(new Set())}
              disabled={busy}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      <Result state={state} />

      <div className="mt-4">
        {questions.length === 0 ? (
          <EmptyState
            title="No questions match the current filters"
            body="Try widening your search, or clearing the section and readiness filters."
          />
        ) : (
          <TableContainer label="Question bank table" minWidth={1140}>
            <thead>
              <tr>
                <Th className="w-10">
                  <input
                    type="checkbox"
                    checked={allShown}
                    onChange={toggleAll}
                    aria-label="Select all questions on this page"
                    className="size-4 accent-[var(--color-primary)]"
                  />
                </Th>
                <Th>Question</Th>
                <Th>Section</Th>
                <Th>Difficulty</Th>
                <Th>Active</Th>
                <Th align="right">Marks</Th>
                <Th align="right">Edit</Th>
              </tr>
            </thead>
            <tbody>
              {questions.map((question) => (
                <Tr key={question.id}>
                  <Td className="align-top">
                    <input
                      type="checkbox"
                      checked={selected.has(question.id)}
                      onChange={() => toggle(question.id)}
                      aria-label={`Select question ${question.id}`}
                      className="size-4 accent-[var(--color-primary)]"
                    />
                  </Td>
                  <Td className="align-top">
                    <div className="max-w-[420px] min-w-[240px]">
                      <p className="line-clamp-2 leading-5 font-medium text-ink">
                        {question.question}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        <span className="tabular">{question.id}</span>
                        <span aria-hidden="true">&middot;</span>
                        <span>{question.topic}</span>
                        {question.lessonGroup ? (
                          <>
                            <span aria-hidden="true">&middot;</span>
                            <span>{question.lessonGroup}</span>
                          </>
                        ) : null}
                        {question.scored ? null : (
                          <>
                            <span aria-hidden="true">&middot;</span>
                            <span className="text-warning">Unscored</span>
                          </>
                        )}
                      </p>
                    </div>
                  </Td>
                  <Td className="align-top">
                    <Chip>{question.section}</Chip>
                  </Td>
                  <Td className="align-top">
                    <DifficultyChip difficulty={question.difficulty} />
                  </Td>
                  <Td className="align-top">
                    <QuestionActiveBadge isActive={question.isActive} />
                    {question.notReadyReasons.length > 0 ? (
                      <p className="mt-1 max-w-[220px] text-xs text-warning">
                        Not ready to activate:{" "}
                        {question.notReadyReasons
                          .map((reason) => reasonLabels[reason] ?? reason)
                          .join("; ")}
                      </p>
                    ) : null}
                  </Td>
                  <Td align="right" className="align-top text-ink-secondary tabular">
                    {question.marks}
                  </Td>
                  <Td align="right" className="align-top">
                    <Link
                      href={`/admin/questions/${encodeURIComponent(question.id)}`}
                      aria-label={`Open question ${question.id}`}
                      className="rounded-sm text-sm font-medium whitespace-nowrap text-primary hover:underline"
                    >
                      Open
                    </Link>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableContainer>
        )}
      </div>
    </>
  );
}
