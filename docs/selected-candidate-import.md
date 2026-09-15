# Selected Candidate import (Phase 15 backend, Phase 16 admin UI)

Imports a file listing which already-existing candidates are selected to sit
a particular exam. Phase 15 built the backend (parsing, validation, matching,
`CandidateExam` writes); Phase 16 added the admin UI on top of it, reusing
that server action as-is — no matching or import logic lives in the browser.

**Admin UI:** `/admin/candidates`, an "Import Selected Candidates" button
next to "Add candidate" and "Import CSV" in the page toolbar
([app/admin/candidates/candidate-editor.tsx](../app/admin/candidates/candidate-editor.tsx)).
Opens `SelectCandidatesDialog`
([app/admin/candidates/select-dialog.tsx](../app/admin/candidates/select-dialog.tsx)),
built on the same `Dialog` primitive and result-display pattern Phase 14
established for the live candidate import
([app/admin/candidates/import-dialog.tsx](../app/admin/candidates/import-dialog.tsx)) —
same loading/double-submit/close behavior, same success/partial/zero-success
states, adapted for this import's different result shape
(`selected`/`alreadySelected`/`notFound`/`conflicts`/`failed`). The dialog
shows the exact contract (`Email Address2` canonical, `Email address`
ignored, `Mobile Number (WhatsApp)` fallback) so an admin preparing the file
doesn't have to guess. The exam is resolved server-side via `SETTINGS_ID`
([app/admin/candidates/selection-actions.ts](../app/admin/candidates/selection-actions.ts)) —
no exam picker in the UI, since the application has only the one
`ExamSetting` singleton.

## Purpose

The live candidate CSV ([docs/candidate-csv-import.md](candidate-csv-import.md))
imports *everyone who applied* into `Candidate`. Being in that table says
nothing about whether someone is allowed to sit a specific exam. This import
is the second, separate step: given a file naming the candidates who were
selected, it marks each one eligible for one exam by creating a
`CandidateExam` row — the schema Phase 12 built exactly for this purpose.

## Live candidate import vs. selected candidate import

|                     | Live candidate import (Phase 13)          | Selected candidate import (Phase 15) |
|---------------------|--------------------------------------------|----------------------------------------|
| Input                | Full application data, ~27 columns          | Name, two email columns, mobile         |
| Writes               | `Candidate` (create or update)             | `CandidateExam` only                    |
| Ever creates Candidate? | Yes                                      | **Never**                               |
| Ever updates Candidate profile fields? | Yes                         | **Never**                               |
| File format          | CSV only                                    | CSV **or** XLSX                         |
| Matching              | Email, falling back to mobile              | Email, falling back to mobile (same priority) |

## Supported file formats

CSV and XLSX (`.csv`, `.xlsx`). `.xls` (the legacy binary format) is not
accepted — nothing in this project requires it, and Phase 13's own CSV
importer only accepts CSV, so XLSX-vs-CSV-only is a deliberate difference
for this file type specifically, not an oversight.

XLSX is read with the `xlsx` package already used by the question-bank
importer (`lib/question-bank/read-source-file.ts`) — no new dependency was
added. Only the **first worksheet** is read; a workbook with additional
sheets is not an error, they are simply not consulted. If the workbook has
zero worksheets, the file is rejected with "Excel file contains no
worksheets."

Limits (same order of magnitude as the live import, kept independent in
case they need to diverge later): 10 MB max file size, 20,000 max rows.

## File contract

**No example selected-candidate file exists anywhere in this repository.**
The contract below reuses the live sheet's own header naming (the selected
file is drawn from the same source data), confirmed explicitly after an
earlier draft of this phase incorrectly used a single `"Email Address"`
column with email-only matching — that draft was corrected to the contract
below before this phase was accepted.

Confirmed contract:

| Spreadsheet header | Role | Notes |
|---|---|---|
| `Email Address2` | **Canonical email — primary matching key** | Trimmed, lowercased, matched against `Candidate.email`. Matched by exact, case-sensitive header text, same protection the live import gives this header. |
| `Email address` | **Explicitly ignored** | Never read, never used for matching — the same rule as the live candidate import ([lib/candidate-import/csv-contract.ts](../lib/candidate-import/csv-contract.ts)). A file may contain this column as a decoy; it is never consulted. |
| `Mobile Number (WhatsApp)` | **Fallback matching key** | Used only when the email is blank or matches no existing candidate. Normalized with the existing `normalizeMobile()` ([lib/integrations/candidate-payload.ts](../lib/integrations/candidate-payload.ts)) — the same function the live import, the Google Form sync, and manual candidate entry all use; not reimplemented here. |
| `Full Name` | Optional, reporting only | Carried through into row errors for readability. **Never used for identity, never written to Candidate.** |

Both `Email Address2` and `Mobile Number (WhatsApp)` are required columns —
missing either fails the whole file. A given *row* does not need both
values, only at least one usable one (see "Matching strategy" below).

See `CANONICAL_EMAIL_HEADER`, `IGNORED_EMAIL_HEADER`, `MOBILE_HEADER`, and
`NAME_HEADER` in
[lib/candidate-selection-import/selection-contract.ts](../lib/candidate-selection-import/selection-contract.ts).

Headers are matched by exact, case-sensitive text — never through a
normalizer — the same protection the live import applies to its two email
columns: `"Email address"` and `"Email Address2"` must never be confused
with each other, and a file whose only email column is literally
`"Email Address"` (no "2") is correctly rejected as missing the required
column rather than silently accepted.

## Required columns

`Email Address2` and `Mobile Number (WhatsApp)`. Missing either fails the
entire file:

```
Missing required column: "Email Address2".
Missing required column: "Mobile Number (WhatsApp)".
```

## Matching strategy

Mirrors the live import's own priority
([lib/candidate-import/match-candidate.ts](../lib/candidate-import/match-candidate.ts)):
**email first, mobile fallback.** The decision logic is in
[lib/candidate-selection-import/match-selection.ts](../lib/candidate-selection-import/match-selection.ts)
(pure, unit tested, mirroring how the live import separates its own matching
decision from the database calls that feed it).

1. Normalize the row's email (trim, lowercase) from `Email Address2`.
2. If it matches exactly one existing `Candidate`, that candidate is
   selected.
3. Otherwise (email blank, invalid, or matching nothing), try the row's
   normalized mobile from `Mobile Number (WhatsApp)`.
4. If that matches exactly one existing `Candidate`, that candidate is
   selected.
5. If email identifies one candidate and mobile identifies a *different*
   one, that is an **identity conflict** — nothing is written.
6. If either key alone matches more than one existing candidate, that is
   also a conflict — a pre-existing data-quality issue in `Candidate`, not
   something this import resolves by guessing.
7. If neither key matches anything, the row is **not found**.

## Email rules

`Email Address2` is canonical, matched against `Candidate.email`.
`Email address` is always ignored — a file may contain both columns (one may
be a stale/decoy value), and only `Email Address2` is ever read. Normalized
the same way as the live import: trimmed, lowercased.

## Mobile rules

`Mobile Number (WhatsApp)`, normalized via the existing `normalizeMobile()`
— reused, not reimplemented, so this import cannot drift from the live
import's already-fixed handling (the Phase 13 bugfix where a genuine
10-digit number starting `91` was corrupted; see
[docs/candidate-csv-import.md](candidate-csv-import.md)). Stored/compared as
a string throughout, never parsed as a number.

## Candidate-not-found behavior

**No `Candidate` is ever created by this import.** A row whose email and
mobile both fail to match any existing candidate is reported:

```
Candidate not found in the Candidate table. This candidate must first exist
in the live candidate import.
```

and counted under `notFound`, not `failed` — it's a normal, expected outcome
(the selected file is a subset of people who should already be in
`Candidate` via the live import), not a malformed row.

## Identity-conflict behavior

A row whose email identifies one existing candidate and whose mobile
identifies a *different* existing candidate is reported as a conflict and
**nothing is written** for that row:

```
Email identifies candidate #<id> but mobile identifies a different candidate
#<id>. Identity conflict — not selected automatically.
```

Verified against the real database: a row built exactly this way produced
zero `CandidateExam` writes for either candidate.

## CandidateExam creation

On a successful match with no existing `CandidateExam` for
`(candidateId, examId)`, one is created with the schema default status
(`SELECTED`). Nothing else is written: no `Candidate` field is touched, and
`Attempt`, `Answer`, and `ExamSession` are never created or modified by this
import.

## Eligibility enforcement (Phase 17)

`CandidateExam` existence is now the actual gate on starting the exam — not
just data sitting unused. `startOrResumeExam()`
([lib/exam/start-exam.ts](../lib/exam/start-exam.ts)) checks for a
`CandidateExam` row matching `(candidateId, SETTINGS_ID)` immediately after
identifying the candidate by mobile and before any `Attempt` or
`ExamSession` can be created or resumed:

- **Has a `CandidateExam` for the current exam** → the existing start/resume
  flow continues exactly as before this phase — same paper generation, same
  session cookie, same resume-in-progress behavior.
- **No `CandidateExam` for the current exam** → exam start is rejected. No
  `Attempt`, `ExamSession`, or `Answer` is created, and `Candidate` is never
  modified. The candidate sees: "You are not currently selected for this
  examination. Please contact the examination administrator if you believe
  this is incorrect." — no mention of `CandidateExam`, the database, Prisma,
  or `ExamSetting`.

The check is keyed on `SETTINGS_ID` — the same constant this import already
uses to resolve `examId`
([lib/exam-settings/index.ts](../lib/exam-settings/index.ts)) — so a
`CandidateExam` created for one exam only ever grants access to that same
exam; there is no cross-exam leakage even conceptually, since the
application has just the one `ExamSetting` singleton today.

**A candidate already mid-exam when this shipped is not automatically
exempt.** If they have no `CandidateExam` row, their next resume attempt
(refresh, reopen) is rejected the same as a fresh start would be — see the
Phase 17 implementation report for the real database state this was
verified against before deploy.

**No deselection exists.** A `CandidateExam` row, once created, is never
removed by any current feature — eligibility can only be granted, never
revoked, until a future phase adds that.

## Duplicate / idempotency behavior

`CandidateExam`'s existing `@@unique([candidateId, examId])` (Phase 12) is
the final guarantee. Before writing, this import also does its own existence
check ([lib/candidate-selection-import/select-candidates.ts](../lib/candidate-selection-import/select-candidates.ts))
so a normal re-import reports `alreadySelected` cleanly rather than relying
solely on a caught database error. Two admins importing the same file
concurrently is still handled safely: if both transactions race past the
existence check, the unique constraint rejects the loser's insert, and that
row is counted as `alreadySelected` rather than `failed` — see
`isUniqueViolation` in select-candidates.ts.

Verified against the real database: importing an identical 4-row file
(2 valid matches, 1 conflict, 1 not-found) twice produced
`selected: 2, notFound: 1, conflicts: 1` on the first run and
`selected: 0, alreadySelected: 2, notFound: 1, conflicts: 1` on the second,
with `candidate_exams` growing by exactly 2 total, not 4.

Row order and duplicate rows within one file are both safe: the same
candidate appearing twice in one file (or across two separate imports) still
produces exactly one `CandidateExam` row — matching is by candidate identity,
never by row position.

## Partial success

Header problems (missing `Email Address2` or `Mobile Number (WhatsApp)`)
fail the whole file. Row problems are independent: a file with some valid,
some not-found, and some conflicting rows processes every valid row and
reports the rest — no row's outcome affects another's. Each row's database
work happens inside its own transaction, never one transaction spanning the
whole file.

## Exam association

The application currently has only the `ExamSetting` singleton (`SETTINGS_ID`
in [lib/exam-settings/index.ts](../lib/exam-settings/index.ts)). Rather than
hardcoding that id inside the import pipeline, `examId` is an explicit
parameter to `importSelectedCandidatesFromFile(file, examId)`
([lib/candidate-selection-import/run-selection-import.ts](../lib/candidate-selection-import/run-selection-import.ts)) —
the caller (currently the server action in
[app/admin/candidates/selection-actions.ts](../app/admin/candidates/selection-actions.ts),
which reads `SETTINGS_ID`) decides which exam a selection applies to. The
import itself validates that `examId` names a real `ExamSetting` before
writing anything, so a bad id fails safely with no orphan `CandidateExam`
rows rather than silently defaulting to something.

## Authorization

`requireAdmin()` — the same session-based check every other admin server
action in this codebase uses. No second auth mechanism. Enforced in the
server action, so it protects the backend regardless of whether any UI
exists to call it.

## Candidate profile preservation

**Selected Candidate Import does not create or update Candidate records.**
Every field on an existing `Candidate` — name, email, mobile, date of birth,
qualification, college, technologies, project info, resume, LinkedIn,
GitHub, everything — is left exactly as it was, even when the selected
file's `Full Name` column names them differently. Verified against the real
database: two candidates matched by email and by mobile respectively, both
with a different name in the selected file, kept their original
`name`/`email`/`mobile` after import.

**Selected Candidate Import does not create Attempts or Exam Sessions.**
Verified against the real database: `attempts`, `answers`, and
`exam_sessions` row counts were identical before and after a real import run
(`candidates` count also unchanged; only `candidate_exams` grew, and only by
the number of genuinely new selections).

**CandidateExam represents selection/eligibility data and will be enforced
by a later exam-start phase.** `lib/exam/start-exam.ts` is untouched by this
phase — existing candidates can still start the exam exactly as they could
before, regardless of whether they have a `CandidateExam` row. A future,
separate phase will change exam-start to check for one.

## Result structure

```ts
{
  totalRows: number;        // rows in the file (all outcomes combined)
  selected: number;         // newly created CandidateExam rows
  alreadySelected: number;  // CandidateExam already existed
  notFound: number;         // neither email nor mobile matched a Candidate
  conflicts: number;        // email and mobile identified different candidates,
                             // or either key alone matched more than one
  failed: number;           // row validation failures + unexpected DB errors
  errors: {
    row: number;       // 1-based, header is row 1
    field: string;
    name?: string;
    email?: string;
    mobile?: string;
    message: string;
  }[];
}
```

No raw database errors are ever returned — a database failure on a row is
logged server-side (name/message only) and surfaced as a generic
"could not be processed" error for that row.

## Files

- `lib/candidate-selection-import/selection-contract.ts` — the file contract
  (required headers, accepted extensions, limits).
- `lib/candidate-selection-import/read-selection-file.ts` — CSV/XLSX reading
  into a raw header/row grid (first worksheet only for XLSX).
- `lib/candidate-selection-import/parse-selection.ts` — header validation +
  per-row email/mobile parsing (email via trim+lowercase, mobile via the
  reused `normalizeMobile()`).
- `lib/candidate-selection-import/match-selection.ts` — pure matching
  decision (found / not found / conflict), unit tested.
- `lib/candidate-selection-import/select-candidates.ts` — the actual
  database lookups and `CandidateExam` writes, one transaction per row.
- `lib/candidate-selection-import/run-selection-import.ts` — orchestrates the
  above and validates the exam id; `importSelectedCandidatesFromFile(file, examId)`
  is the one entry point other code should call.
- `app/admin/candidates/selection-actions.ts` — the admin server action
  (`requireAdmin()`, resolves `examId` via `SETTINGS_ID`, calls the pipeline).
- `app/admin/candidates/select-dialog.tsx` — the Phase 16 admin dialog
  (`SelectCandidatesDialog`) that calls the server action above and renders
  its result.
- `app/admin/candidates/candidate-editor.tsx` — the candidates page toolbar;
  the "Import Selected Candidates" button and dialog mount live here,
  alongside "Add candidate" and "Import CSV".
