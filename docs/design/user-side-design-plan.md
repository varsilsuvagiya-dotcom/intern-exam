# CloudUS User-Side Design Plan
### Candidate Examination Experience — Source of Truth

**Status:** Design Phase 0 complete (audit + plan). No implementation started.
**Scope:** the candidate-facing examination experience only.
**Companion document:** `docs/design/admin-panel-design-plan.md` (Admin track — COMPLETE).
**Functional source of truth:** `exam-app-requirements.md` (never modified).

This document is the source of truth for the entire User-Side Design Track. It records what the
candidate application *actually is* today — audited from the repository and the live database on
2026-09-09 — and what the design track will do to it. Where this document and an assumption
disagree, the audit sections were written from the code and win.

---

## 1. Design Goals

The candidate interface is not an admin panel with different colors. An admin browses; a candidate
performs, once, under time pressure, on a machine they do not own, with a job riding on it. That
difference sets every goal below.

1. **The candidate always knows where they are.** Section, question number, questions remaining,
   time remaining — visible without scrolling, without opening anything, at every moment.
2. **The question is the loudest thing on screen.** Everything else is instrumentation.
3. **Nothing is ambiguous under stress.** "Saved" means saved on the server. A red timer means
   under five minutes. No state requires interpretation.
4. **The interface never costs the candidate time.** No animation they must wait through, no
   confirmation they must dismiss twice, no control that moves.
5. **An interruption is survivable and visibly survivable.** The app already recovers correctly
   (§11); the interface must *say so*, because a candidate whose PC restarted does not know that.
6. **It looks like an examination the candidate should take seriously.** Institutional, calm,
   deliberate — the visual register of a national CBT, not of a quiz app.
7. **Accessibility is structural.** Radio semantics, focus order, live regions and contrast are
   part of the build, not a later pass.

---

## 2. Design Principles

These twelve govern every later phase. A change that violates one is rejected regardless of how it
looks.

| # | Principle | What it forbids in practice |
|---|---|---|
| 1 | **Exam first** | Any layout where the timer, section, or question position can leave the viewport |
| 2 | **Question content gets priority** | Chrome that competes with the question for visual weight |
| 3 | **Persistent orientation** | Collapsing or hiding exam/section/number/timer/progress at any width |
| 4 | **Status must be obvious** | Palette states a candidate must consult a legend to distinguish |
| 5 | **No color-only meaning** | Any status carried by hue alone — every state needs shape, weight, glyph or text |
| 6 | **Minimal distraction** | Decorative gradients, entrance animations, hover flourishes, shadows-as-ornament |
| 7 | **Professional CBT** | Consumer-product visual language: playful type, bright fills, rounded pills |
| 8 | **CloudUS, not NTA** | NTA branding, terminology, or its negative-marking and profile-photo furniture |
| 9 | **Preserve functionality** | Any visual change that alters what a Server Action does or what it returns |
| 10 | **Server truth wins** | Client-side timers, optimistic answer state, or client-decided submission |
| 11 | **Accessibility is mandatory** | Shipping a phase with a known unlabelled control or lost focus state |
| 12 | **Desktop-first, graceful smaller** | Optimizing for phones at the cost of the 1920/1440 supervised-PC case |

---

## 3. Reference Interpretation

The supplied NTA-style screenshot is a **UX reference only**. Read against CloudUS's actual
requirements, it divides cleanly.

### Adopt — patterns that serve a real CloudUS need

| Reference pattern | Why it applies here |
|---|---|
| Examination top bar with exam title, timer, submit | Requirements §49 specifies exactly this bar |
| Persistent candidate identity panel | Supervisor at the desk must confirm the right person is sitting the right paper |
| Question status legend with counts | CloudUS has three states today and a candidate cannot currently see totals per state |
| Question palette grid | Requirements §51 — grid 1–55, jump anywhere |
| Section context on the question | Requirements §49 — section name in the top bar |
| Question number + marks near the question | Already present; the reference's placement is better |
| Distinct bottom action bar | Save & Next as a single deliberate action reduces mis-clicks |
| Instructions access | Requirements §39 mandates an instruction box; today it does not exist (§17 GAP-1) |

### Adopt with change

| Reference pattern | CloudUS adaptation |
|---|---|
| "Marked for Review" | Adopt the *state*, drop the NTA colour semantics. See §8 — this is new UI over a **new client-only** concept, and is the single largest open question in this plan (§23 Q1) |
| Avatar block | Keep the identity panel, drop the photo. CloudUS has no candidate photo and will not add one |
| Section tabs | CloudUS has 8 fixed sections in fixed order; tabs imply free section switching. Adapt as *orientation*, not as a second navigation system |
| "Question Paper" viewer | Adapt to a full-paper overview only if it earns its place; the palette may already cover the need (§23 Q4) |

### Reject outright

- **Negative marking display** — CloudUS has none. Rendering "Negative Marks: -1" would be a lie.
- **NTA branding, wordmarks, colour palette, terminology.**
- **Profile photograph.**
- **Any proctoring affordance** — no webcam, recording, tab tracking, or focus-loss warnings.
- **The reference's visual styling itself** — 2010s gradients, heavy blues, tight legacy chrome.

---

## 4. CloudUS-Specific UX Decisions

Decisions taken now so later phases do not relitigate them:

1. **One question at a time.** Confirmed by requirements and by the current build.
2. **Section order is fixed 1→8 and is not navigable as sections.** The candidate moves by question;
   the section is *shown*, not *chosen*. A deliberate divergence from the reference.
3. **The palette is the primary jump mechanism**; Previous/Next is the primary sequential one.
4. **No score, ever, on the candidate side** — not on completion, not in the submit dialog, not in
   a progress indicator. The submit dialog may state *answered counts*, never marks.
5. **Free-text S8 must be visually unmistakable** as unscored and open-ended.
6. **S7 lesson text belongs to the group, not the question** — visually shared across its three
   questions, never re-read as if new.
7. **The timer is informational, not decorative.** No progress ring, no colour wash of the page.
8. **Dark mode is out of scope** for the candidate track (see §20 and §23 Q3).

---

## 5. Route Inventory

Every candidate-facing route, as it exists in the repository.

| Route | File | Purpose | Rendering | Session requirement |
|---|---|---|---|---|
| `/` | `app/page.tsx` | Public landing. Title + tagline only. No link to the exam. | Static server component | None |
| `/exam/start` | `app/exam/start/page.tsx` | Candidate identity + eligibility entry | `force-dynamic` server; `StartForm` is a client component | None — this is the entry point |
| `/exam` | `app/exam/page.tsx` | The examination itself; also renders completion for finalized attempts | `force-dynamic` server; `ExamShell` is a client component | `cloudus_exam_session` cookie; redirects to `/exam/start` without one |
| `/api/integrations/candidates` | `app/api/integrations/candidates/route.ts` | Apps Script candidate sync. **Not candidate-facing**; no UI | Route handler | Shared-secret, not a candidate session |

**Routes that do not exist as routes.** Documented because the requirements or the reference imply
them, and their absence shapes the phase plan:

| Expected | Reality |
|---|---|
| Completion / "done" route | **Not a route.** `CompletionScreen` is a component rendered by `/exam` in three places (`app/exam/page.tsx:47`, `:53`, `:71`) and by `ExamShell` on finalization (`app/exam/exam-shell.tsx:124`) |
| Resume / recovery route | **Not a route.** Recovery is re-entry through `/exam/start` with the same mobile number |
| Submit route | **Not a route.** A dialog inside `ExamShell` calling the `submitExam` Server Action |
| Instructions screen | **Does not exist at all.** See §17 GAP-1 |
| Question-paper viewer | **Does not exist.** Reference-only concept |
| Candidate-scoped error / not-found | **Do not exist.** `/exam` failures fall to root `app/error.tsx` and `app/not-found.tsx`, which are generic and offer "Back to home" |

**Shared boundary files:** `app/layout.tsx` (fonts, metadata, `body` shell) and `app/globals.css`
are shared with the admin panel. `app/loading.tsx`, `app/error.tsx`, `app/not-found.tsx`,
`app/global-error.tsx` currently serve the candidate side by default.

---

## 6. Existing Architecture Overview

### Server / client boundary

The split is clean and correct, and the design track must preserve it exactly.

```
/exam (server, force-dynamic)
  ├── getExamSessionAttemptId()      cookie → attemptId          lib/exam/exam-session.ts
  ├── prisma.attempt.findUnique      terminal-status short-circuit
  ├── getCandidatePaper(attemptId)   the paper DTO               lib/exam/candidate-paper.ts
  ├── getAttemptTiming(attemptId)    server clock                lib/exam/exam-timer.ts
  ├── loadAnswers(attemptId)         restored answers            lib/exam/save-answer.ts
  └── <ExamShell paper initialAnswers initialTiming />   (client from here down)
        ├── ExamTimerDisplay      countdown + 30s resync
        ├── QuestionDisplay       question, options, S7 lesson, S8 textarea
        ├── QuestionGrid          palette + legend
        ├── SubmitDialog          summary → confirm → finalize
        └── useAutosave           debounce, sequencing, flush
```

### Server Actions (`app/exam/actions.ts`)

| Action | Returns | Notes |
|---|---|---|
| `fetchTiming()` | `ok \| unauthorized \| finished` | Called every 30s by the timer |
| `fetchSubmissionSummary()` | `ok \| not-found \| finished` | Counts computed from the database, not the browser |
| `submitExam(intent)` | `finalized \| not-expired \| not-found` | Server decides the resulting status from its own clock |
| `persistAnswer(qid, value)` | `saved \| expired \| finished \| unauthorized \| invalid \| failed` | One answer |

**Security property to preserve (`app/exam/actions.ts:18-20`):** no action accepts an attempt id.
Every one resolves the attempt from the session cookie. There is no argument a candidate can change
to reach another candidate's exam. **No design phase may add an attempt id, candidate id, or
question-ownership claim to any action signature.**

### Domain layer (`lib/exam/**`, all `server-only`)

`exam-session` (cookie ↔ hashed token), `exam-timer` (authoritative timing), `candidate-paper`
(the DTO that deliberately omits `correct` and `explanation`), `save-answer`, `finalize-attempt`,
`scoring`, `paper-generation`, `difficulty-allocation`, `start-exam`.

### Styling

`app/globals.css` has **two disjoint systems**:

- **Candidate (lines 11–34):** exactly two variables, `--background` and `--foreground`, plus a
  `prefers-color-scheme: dark` block. That is the entire candidate token set.
- **Admin (lines 47–104):** the full designed token system, and **every admin rule is scoped under
  `.cloudus-admin`** (line 113) precisely so it cannot reach candidate pages.

The candidate UI therefore uses **raw Tailwind opacity utilities** — `border-black/15`,
`text-black/60`, `dark:border-white/20` — throughout. There are no candidate design tokens. This is
the single largest structural finding of this audit and shapes Phase 1 (§21).

---

## 7. Current Candidate UI Audit

Audited file by file. This section records **what exists**, not what should.

### 7.1 `/exam/start` — Start screen

`app/exam/start/page.tsx` + `start-form.tsx`.

- Centered `max-w-md` column, exam name as `h1`, sub-line "Please enter your details to begin."
- Three fields — name, email, mobile — each an implicit `<label>` wrapping its input. Real labels,
  correct `autoComplete`, sensible `maxLength`, `inputMode="tel"` on mobile.
- Mobile carries the requirements' mandated note: *"Please enter the same mobile number you used in
  the application form."*
- Per-field errors render below the field in red text.
- Form-level `ineligible` and `failed` states render as `role="alert"` red paragraphs.
- Success (`started`) replaces the whole form with a `role="status"` notice and a "Continue exam" /
  "Open exam" link to `/exam`. `completed` and `closed` likewise replace the form.
- Closed-exam state is rendered by the **page** when `settings.isOpen` is false, and *also* by the
  **form** if the exam closes between render and submit. Both paths exist and both are correct.
- Styling: two local class constants, `FIELD` and `NOTICE`. Submit button is `bg-black` /
  `dark:bg-white`.

**Findings.** No instruction box (requirements §39 — GAP-1). Field errors are not wired with
`aria-describedby`/`aria-invalid` (GAP-6). No token usage. The success state is a text link rather
than a primary action, and reads weaker than the "Start exam" button that preceded it.

### 7.2 `/exam` — Examination screen

`app/exam/exam-shell.tsx` (207 lines) is the whole layout.

**Header** (`:129-152`), a single flex row, `max-w-7xl`, wrapping:
exam name (semibold) · candidate name · `Section {n} — {sectionName}` · then right-aligned:
save-status text · `ExamTimerDisplay` · `SubmitDialog` trigger.

**Expiry banner** (`:154-161`): full-width `role="alert"` strip, red-tinted, shown when `expired`.

**Body** (`:163-204`): `max-w-7xl` flex row, `gap-8`.
- `<main>` — `QuestionDisplay`, then a bottom `<nav>` with `← Previous`, a centered
  `{answered} of {total} answered`, and `Next →`.
- `<QuestionGrid>` — fixed `w-64` aside.

**Findings.** The header is a wrapping flex row with no hierarchy: exam name, candidate name and
section all render at similar weight, and on a narrow viewport they reflow into an unpredictable
stack (GAP-11). The palette is a fixed `w-64` sibling in a `flex` row with **no responsive treatment
at all** — below roughly 900px it crushes the question column (GAP-10, §15). There is no Save & Next,
no Mark for Review, no Clear Response (§8, §20). Progress is a bare count sentence.

### 7.3 `QuestionDisplay`

`app/exam/question-display.tsx`.

- `<article>` with `<h1>` "Question N of M" and a marks chip.
- S7 lesson: `<section aria-label="Lesson">` with an uppercase "Learn" `h2`, tinted box,
  `whitespace-pre-wrap`, rendered as **plain text — never as markup** (`:40` is explicit about it).
- Question text: `whitespace-pre-wrap`, `text-base`.
- Code block: `<pre><code>` with `overflow-x-auto`, monospace, tinted. Correct.
- S8: labelled `<textarea id="free-text-answer">`, `rows={6}`, keyed by question id so it remounts
  per question, with the note *"There is no right or wrong answer here."*
- MCQ: `<fieldset>` + `<legend class="sr-only">Choose one answer</legend>`, options as `<label>`
  wrapping a real `<input type="radio">`, selected state via border + background.

**Findings.** Semantically strong — real radios, real fieldset, real label association. But
`QuestionDisplay` renders an `<h1>` (`:23`) while `/exam` has no other `h1`, so the page's top-level
heading is "Question 1 of 55" and the exam name in the header is not a heading at all (GAP-7).
Option rows have no visible focus treatment beyond the browser default (GAP-8). Marks are shown but
the section is not (it lives only in the header). No question-type label.

### 7.4 `QuestionGrid` (palette)

`app/exam/question-grid.tsx`.

- `w-64` aside, `h2` "Questions", `<ol>` grid `grid-cols-5`, one button per question.
- Three states — `answered` (filled blue), `visited` (outlined), `unvisited` (grey fill) — each with
  a **distinct border, fill and font weight**, and the file comments (`:7-8`) say this is
  deliberately not colour-only. That claim holds up.
- Current question gets `ring-2 ring-black` plus `aria-current="true"`.
- Each button carries `aria-label="Question N, {state}"`.
- A `<dl>` legend beneath maps each swatch to its label, plus "current question".

**Findings.** This component is the strongest part of the candidate UI and its accessibility
approach is sound. Gaps: the legend is a `<dl>` containing `<dd>` elements with **no `<dt>`**
(GAP-9 — invalid list structure); there are no per-state **counts** (the reference has them and they
are genuinely useful); there is no section grouping, so a candidate cannot see where S7 begins;
buttons are `h-9` (36px), below the 44px touch minimum; and at 55 questions in 5 columns the grid is
11 rows, which at 768px height competes with the question for vertical space.

### 7.5 `ExamTimerDisplay`

`app/exam/exam-timer-display.tsx`. Audited in full in §9.

**Findings.** Renders as `text-sm` body text — the same size and weight as the candidate's name
beside it. For the single most time-critical element on an examination screen this is the clearest
visual-hierarchy failure in the build (GAP-2). `aria-live` is `polite` only under five minutes and
`off` otherwise, which is a considered choice and should be kept. Format is `MM:SS` — at 75 minutes
this reads "74:59", not "01:14:59" (GAP-3).

### 7.6 `SubmitDialog`

`app/exam/submit-dialog.tsx`. Five-phase state machine: `closed → loading → ready → submitting`,
plus `error`.

- Trigger is a `bg-black` button in the header.
- Overlay is `fixed inset-0 bg-black/50`; the panel has `role="dialog"`, `aria-modal="true"`,
  `aria-labelledby="submit-title"`.
- `ready` shows answered/total, the unanswered **display numbers**, and "You cannot return to the
  exam after submitting."
- Actions: "Go back" and "Confirm submit", the latter disabled unless `phase === "ready"`.

**Findings.** Correct semantics and correct copy. But there is **no focus trap, no initial focus
move, and no Escape-to-close** (GAP-4) — the admin panel's drawer does all three. The overlay is not
click-to-dismiss either, which is defensible for a submit dialog and should be kept deliberate.

### 7.7 `CompletionScreen`

`app/exam/completion-screen.tsx`. Two variants keyed on `auto_submitted`. Renders no score, no
marks, no answer data — and the file comment (`:3-4`) states that as intent.

**Findings.** Correct and safe. Visually the plainest screen in the app; it is also the last thing
every candidate sees, and currently gives no closure cue beyond one paragraph.

---

## 8. Question Status Model

The single most important audit finding for the design track.

### What exists

| State | Where it lives | Survives refresh? |
|---|---|---|
| **Answered** | `answers[question.id] !== undefined`, hydrated from `loadAnswers()` on the server | **Yes** — read from the `Answer` table |
| **Visited** | `visited` state in `ExamShell` (`:38-44`), seeded from answered questions + question 1 | **No** — client-only, rebuilt on every load |
| **Not visited** | Absence from `visited` | **No** |
| **Current** | `current` index in `ExamShell` (`:34`) | **No** — always resets to question 1 |
| **Marked for review** | **Does not exist** | — |
| **Answered + marked** | **Does not exist** | — |
| **Saving / saved / failed / expired** | `SaveStatus` in `useAutosave`; one **global** status, not per-question | No |

### Consequences

1. **`visited` does not survive a refresh or a crash recovery.** After a PC restart, a candidate who
   had walked through 30 questions sees them as "not visited" unless they answered them. Answered
   state is fully restored; visited state is not. This is a **real behavioural gap**, not a visual
   one — recorded as GAP-5 and as a design input, **not** as something Phase 0 fixes.
2. **Question position resets to 1** on every load, including resume. A candidate on question 42
   whose browser crashed returns to question 1. GAP-12.
3. **Save status is global.** "Saved" refers to the most recent save of *any* question, so the
   palette cannot show per-question save state, and the header label can read "Saved" while a
   different question's save has failed.
4. **Mark for Review does not exist.** The reference has it; the requirements do **not** mention it.
   Adding it is new product functionality and is therefore an **open question, not a decision**
   (§23 Q1).

### Database representation

`Answer` rows (`selectedOption` for MCQ, `textAnswer` for S8) are the only persisted per-question
candidate state. There is no "visited", "flagged" or "review" column, and this plan does **not**
propose adding one — see §22.

---

## 9. Timer Behavior

**Server-authoritative, and correctly so.** `lib/exam/exam-timer.ts:5-10` states the contract and
the implementation honours it.

- **Deadline** = `attempt.startedAt + settings.durationMinutes`, computed server-side
  (`computeTiming`, `:25`). Never sent by the browser, never stored as an expiry the client can move.
- **Client display** counts down from a **measured server/client clock skew**
  (`exam-timer-display.tsx:31-36`): `skew = serverNow - Date.now()`, and every tick recomputes from
  `Date.now() + skew`. Changing the machine clock shifts both sides equally and buys nothing. This
  is a genuinely good implementation and must not be simplified.
- **Resync every 30s** (`RESYNC_MS`), which re-measures skew *and* re-reads `expiresAt`, so an admin
  changing the duration mid-exam propagates within 30 seconds.
- **At zero:** `onExpire()` → `ExamShell` sets `expired` → an effect (`exam-shell.tsx:53-87`) calls
  `submitExam("automatic")` in a **retry loop every 2s until the server accepts**, because the
  client can reach zero fractionally before the server agrees. The server refuses an automatic
  submit while time remains (`finalize-attempt.ts:154`).
- **On expiry the UI** sets `expired`, which disables answering (`exam-shell.tsx:102`), disables the
  submit trigger, and shows the red banner.
- **If the resync fails or the attempt is gone**, the timer treats it as expiry and stops answering
  (`exam-timer-display.tsx:63-67`) — fail-closed, correct.
- **Network failure during the auto-submit loop:** the loop retries indefinitely while the component
  is mounted. If the tab is closed before the server accepts, the attempt stays `in_progress` until
  an admin or a later request finalizes it. A known limitation, documented rather than fixed here.

**Design constraint:** the countdown is a *display*. No phase may make the client the source of
truth, cache the deadline, or remove the resync.

---

## 10. Autosave Behavior

`app/exam/use-autosave.ts`.

- **MCQ saves immediately** on selection; **free text debounces 600ms** (`TEXT_DEBOUNCE_MS`).
- **Per-question sequence numbers** (`:22`, `:29-31`, `:40-42`) — a slow save of "B" landing after a
  fast save of "C" is discarded rather than allowed to claim B was stored. Correct and non-obvious.
- **Status transitions:** `idle → saving → saved | failed | expired`. Global, not per-question (§8).
- **Failure:** status `failed`, header label *"Not saved — retrying when you change it again"*.
  The candidate **can continue** — nothing is blocked — but there is **no automatic retry**; the
  next change to that question is the retry. The label says so honestly.
- **`flush()`** (`:107-124`) sends anything still on a debounce timer and awaits every in-flight
  request, returning false if any failed. `SubmitDialog` calls it *before* fetching the summary
  (`submit-dialog.tsx:32`) and refuses to proceed if it fails — so the confirmation counts can never
  overstate what is stored.
- **`pagehide`** triggers a best-effort flush (`:127-131`).
- **Restoration:** `loadAnswers()` on the server hydrates `initialAnswers`; the S8 textarea is keyed
  by question id so it remounts with the right value.

**Findings.** The mechanism is sound. The *presentation* is thin: a global status string in the
header at `text-sm`, easy to miss, with no per-question indication and no visible affordance to
retry a failed save other than editing the answer again (GAP-13).

---

## 11. Recovery Behavior

Recovery is **re-entry through `/exam/start` with the same mobile number** — there is no recovery
route and no "resume" link.

| Situation | Actual behaviour | Where |
|---|---|---|
| Identity recovery | Mobile is normalized and matched against `Candidate`; name/email are recorded on the attempt but **never used to find the candidate** | `start-exam.ts:98-119` |
| Attempt recovery | Most recent attempt for that candidate; if `in_progress`, it is **resumed** — `startedAt` untouched, so the timer keeps running from the real start | `start-exam.ts:125-136` |
| Paper recovery | `ensureExamPaper` returns the stored paper. **A paper is drawn once and never redrawn** — refresh, resume, a changed bank or a changed difficulty mix all leave it exactly as it was | `paper-generation.ts:275-282` |
| Answer recovery | `loadAnswers()` restores every saved answer | `save-answer.ts:116` |
| Timer recovery | Recomputed from `startedAt`; elapsed time during the outage **counts against the candidate**, by design | `exam-timer.ts:26` |
| Session recovery | A fresh `ExamSession` row and cookie are issued on every start/resume | `start-exam.ts:53` |
| Question position | **Not recovered** — resets to question 1 (GAP-12) | `exam-shell.tsx:34` |
| Visited state | **Not recovered** (GAP-5) | `exam-shell.tsx:38` |
| Already submitted | `{ kind: "completed" }` → "You have already completed this exam." One exam per candidate | `start-exam.ts:138-142` |
| Expired but not finalized | The attempt is still `in_progress`, so it *resumes*; `/exam` then finds `timing.expired`, and the auto-submit loop finalizes it. The candidate briefly sees the exam, then the completion screen | |
| Double-click race on start | Unique violation `P2002` is caught and resolved by resuming the winning attempt | `start-exam.ts:161-168` |
| Invalid/expired session cookie | `getExamSessionAttemptId()` returns null (deleting the expired row as it goes) → `/exam` redirects to `/exam/start` | `exam-session.ts:43-67` |
| Multiple attempts | Impossible to create: a partial unique index enforces one active attempt, and any non-`in_progress` attempt yields `completed` | |

**Design consequence.** Resume works well and is invisible. The interface currently marks it with a
single line — *"Your exam is already in progress and will continue where you left off."* — on the
start screen, and then nothing. A candidate whose machine restarted gets no confirmation on the exam
screen that their answers survived. That is a design problem worth solving, and it is solvable
**entirely presentationally**, since the data is already restored.

---

## 12. Submission Behavior

| Path | Behaviour |
|---|---|
| **Manual** | Header trigger → `flush()` → `fetchSubmissionSummary()` → `ready` phase → "Confirm submit" → `submitExam("manual")` |
| **Auto** | Timer zero → `expired` → retry loop → `submitExam("automatic")`, which the server honours **only once its own clock agrees** |
| **Status decision** | The **server** decides: a manual submit arriving after the deadline is recorded `auto_submitted` (`finalize-attempt.ts:158`). `intent` only expresses which button was pressed |
| **Idempotence** | A conditional `updateMany` guarded on `status = in_progress` (`:160-163`) — exactly one request can perform the transition. A second submit, a racing auto-submit or a retry all find zero rows and are told the state that won |
| **Scoring** | Runs after finalization and its failure is **deliberately swallowed** (`:98-114`): the attempt stays finalized with `scoredAt` null, which a later re-run completes. Reverting to `in_progress` would hand a submitted candidate their exam back |
| **After submission** | `/exam` short-circuits on any non-`in_progress` status before loading a paper (`page.tsx:41-48`). Answers cannot be changed: `saveAnswer` returns `finished` |
| **Score exposure** | None. `CandidatePaper` omits `correct` and `explanation` by explicit field-by-field mapping; `CompletionScreen` shows no score; the summary reports counts only |
| **Submission failure** | The dialog shows *"Your exam could not be submitted. Please tell your supervisor."* No automatic retry on the manual path — the candidate must press again |

**Verified against the requirements:** score is not exposed ✅ · answers immutable after submission ✅
· auto-submit at zero ✅ · confirmation lists unanswered numbers ✅.

---

## 13. S7 Behavior — Learn-and-Apply

**Generation** (`paper-generation.ts`): the unit of choice is the **lesson group**, not the question.
Groups with fewer than 3 questions are discarded as unusable (`:147-149`); two complete groups are
drawn; **order within a group never varies** (`:190`); `validateGeneratedPaper` asserts exactly 2
groups, exactly 3 questions each, and that each group is **contiguous** in display order
(`:244-262`). The invariant is enforced before anything reaches the database.

**Rendering** (`question-display.tsx:32-43`): each question carries its own `lessonText` snapshot,
and the lesson box is re-rendered **identically above all three questions of the group** — matching
requirements §61. It is rendered as plain text, never as markup.

**Findings.** Functionally exact. Presentationally, the lesson repeats with no indication that it is
*the same lesson* the candidate just read — there is no "Lesson 1 of 2", no "Question 2 of 3 in this
lesson", and no visual continuity between the three. A candidate cannot tell whether the box above
question 44 is new material or the one they read at question 43. This is the clearest single UX
improvement available in the whole candidate track, and it needs **no data change**: `lessonGroup`
is already on the DTO (`candidate-paper.ts:26`) and is currently unused by the UI.

---

## 14. S8 Behavior — Attitude

- **Free-text is decided server-side** from the stored section via `sectionBlueprint(section).scored`
  — in `candidate-paper.ts:142`, in `save-answer.ts:68`, and again in `finalize-attempt.ts:42`.
  **No client flag decides it**, so a tampered request cannot turn an MCQ into free text.
- **Limit:** `MAX_TEXT_ANSWER = 5000`, enforced server-side. The textarea has **no `maxLength`**, so
  a candidate can type past the limit and the save fails as `invalid` — surfaced only as the generic
  "Not saved" status (GAP-14).
- **Trim:** outer whitespace only; deliberate line breaks and indentation are preserved
  (`save-answer.ts:84-86`).
- **Marks:** `marksPerQuestion: 0`, `scored: false`. `QuestionDisplay` renders "0 marks" for S8 —
  technically true, and arguably the wrong message to a candidate (GAP-15).
- **Scoring:** skipped entirely; stored, never scored.
- **Answered-ness:** free text counts as answered when it holds more than whitespace
  (`finalize-attempt.ts:44`).
- **Labelling:** "There is no right or wrong answer here." — matches requirements §63.

---

## 15. Responsive Audit

Assessed from the layout code. The candidate UI contains **no breakpoint utilities whatsoever** —
grep confirms zero `sm:`, `md:`, `lg:` or `max-md:` classes anywhere in `app/exam/**`. Everything
below follows from that.

| Width | Behaviour |
|---|---|
| **1920×1080** | Fine. `max-w-7xl` (1280px) centers with wide margins; the question column is comfortable and the palette sits right. The best-served width |
| **1440×900** | Fine. Effectively the design target |
| **1280×800** | Fine, tight. Content exactly fills `max-w-7xl` |
| **1024×768** | **Degraded.** After `px-6` and `gap-8`, the question column is roughly 700px minus the fixed 256px palette. Workable but cramped; the 11-row palette plus header plus bottom nav leaves little vertical room for a long question |
| **768×1024** | **Broken.** The `flex` row does not wrap. Question column ≈ 430px beside a fixed 256px palette. The header's flex-wrap produces a ragged multi-row stack. Code blocks scroll internally (correct), but the question column is too narrow to read comfortably |
| **375×812** | **Unusable.** ~70px question column beside a 256px palette. The palette's 5-column grid alone exceeds the viewport. Page-level horizontal overflow is expected |

**Also:** palette buttons are 36px (below the 44px touch minimum); the bottom nav is a three-item
`justify-between` row that will crowd; `<pre>` blocks correctly scroll internally rather than pushing
the page — the one responsive thing done right.

**Position for the track.** Examinations run on supervised office PCs, so 1920/1440 is the design
target and the ≤768 breakage is not a production incident. But "unusable at 375" is not acceptable
as a *shipped state* even for an unlikely width, and graceful degradation is cheap. **No responsive
behaviour is changed in Phase 0.**

---

## 16. Accessibility Audit

### Strengths — genuinely good, and to be preserved

- **Real form semantics.** Radios are real `<input type="radio">` in a real `<fieldset>` with a
  `<legend>`; the S8 textarea has a real associated `<label>`. Start-page fields use wrapping labels.
- **Palette labelling.** Every palette button has `aria-label="Question N, {state}"` and the current
  one carries `aria-current`.
- **Status is not colour-only.** Palette states differ in border, fill *and* weight, deliberately
  (`question-grid.tsx:7-8`).
- **Live regions used with judgement.** Save status is `role="status"`; the expiry banner is
  `role="alert"`; the timer announces only under five minutes rather than every second.
- **Dialog semantics.** `role="dialog"`, `aria-modal`, `aria-labelledby`.
- **Errors announced.** Start-page form errors are `role="alert"`.

### Gaps

| ID | Gap | Where |
|---|---|---|
| GAP-4 | Submit dialog has **no focus trap, no initial focus, no Escape-to-close** | `submit-dialog.tsx` |
| GAP-6 | Start-page field errors are not linked by `aria-describedby` / `aria-invalid` | `start-form.tsx` |
| GAP-7 | `<h1>` is "Question N of M"; the exam name is not a heading. Heading order on `/exam` is `h1` (question) → `h2` (Learn), `h2` (Questions) — the page has no title-level heading | `question-display.tsx:23` |
| GAP-8 | Option rows have no designed focus-visible treatment; the candidate side has **no** `:focus-visible` rule at all (the admin one is `.cloudus-admin`-scoped) | `globals.css:126` |
| GAP-9 | Palette legend is a `<dl>` of `<dd>` with **no `<dt>`** — invalid definition-list structure | `question-grid.tsx:66-77` |
| GAP-16 | No skip link; no landmark label for the palette (`<aside>` is unlabelled) | `exam-shell.tsx` |
| GAP-17 | Touch targets: palette 36px, nav buttons ~34px, submit trigger ~30px — all below 44px | throughout |
| GAP-18 | No `prefers-reduced-motion` handling on the candidate side (currently moot — there is no motion — but live the moment any is added) | `globals.css:156` |
| GAP-19 | Keyboard: no next/previous shortcuts, and 55 palette buttons sit in the tab order between the question and the bottom nav, so tabbing from the last option to "Next" is a long trip | `exam-shell.tsx` |
| GAP-20 | Contrast unverified. `text-black/50` on white ≈ 4.1:1 — **below 4.5:1 for normal text** — and it is used for the timer's label, the progress count and several hints | throughout |

---

## 17. Functional Requirement Cross-Check

| Requirement | Status | Evidence / Location | Notes |
|---|---|---|---|
| No candidate accounts/passwords | **COMPLETE** | `start-exam.ts` | Mobile is the eligibility key |
| Start with name + email + mobile | **COMPLETE** | `start-form.tsx` | |
| Mobile must match synced record | **COMPLETE** | `start-exam.ts:115-123` | Normalized with the same function the Apps Script sync uses |
| Warning if verification fails | **COMPLETE** | `start-form.tsx:90-94` | Deliberately identical whether the number is malformed or simply absent — no enumeration |
| Instruction box on start screen | **MISSING** | — | **GAP-1.** Requirements §39 specifies 55 questions / 75 minutes / can revisit / auto-submits / don't close the browser. None of it is on screen |
| 55 questions, 8 sections, fixed order | **COMPLETE** | `exam-blueprint.ts`, `validateGeneratedPaper` | Enforced as an invariant before write |
| 70 marks total | **COMPLETE** | `TOTAL_MARKS`, validated | |
| Random paper, drawn once, persisted | **COMPLETE** | `paper-generation.ts:275-282` | Crypto-quality shuffle |
| Options shuffled and persisted | **COMPLETE** | `shuffledOptionOrder`, `candidate-paper.ts:46` | Nothing randomized at render time |
| S7 = 2 complete lesson groups × 3 | **COMPLETE** | `:130-191`, invariant `:244-262` | Contiguity asserted |
| S7 lesson shown above all 3 questions | **COMPLETE** | `question-display.tsx:32` | Presentation gap only — §13 |
| S8 free text, unscored | **COMPLETE** | `save-answer.ts:68`, `scoring.ts` | Server-decided |
| One question at a time | **COMPLETE** | `exam-shell.tsx:91` | |
| Right-side palette 1–55 | **COMPLETE** | `question-grid.tsx` | Responsive gap — §15 |
| Previous / Next | **COMPLETE** | `exam-shell.tsx:174-194` | |
| Grid colour coding (grey / blue / outline) | **COMPLETE** | `question-grid.tsx:9-13` | Matches requirements §53-56 exactly |
| Autosave on selection, no save button | **COMPLETE** | `use-autosave.ts` | |
| Server-authoritative timer | **COMPLETE** | `exam-timer.ts` | Skew-corrected; clock tampering ineffective |
| Crash recovery / resume | **PARTIAL** | `start-exam.ts:131-136` | Answers, paper and timer recover exactly. **Question position and visited state do not** — GAP-5, GAP-12 |
| Submit confirmation with unanswered list | **COMPLETE** | `submit-dialog.tsx:102-123` | Counts read from the database after a flush |
| Manual submit | **COMPLETE** | `finalize-attempt.ts` | |
| Auto-submit at zero | **COMPLETE** | `exam-shell.tsx:53-87` | Retry loop until the server agrees |
| Completion screen, no score | **COMPLETE** | `completion-screen.tsx` | |
| No candidate results page | **COMPLETE** | Route inventory §5 | |
| No negative marking | **COMPLETE** | `scoring.ts` | Must not be introduced by the reference |
| Top bar: name, section, timer, submit | **COMPLETE** | `exam-shell.tsx:129-152` | Present; hierarchy is the issue — GAP-11 |
| Question type indicator | **MISSING** | — | Reference-derived, not a CloudUS requirement. Optional |
| Mark for review | **MISSING** | — | **Not a CloudUS requirement.** Reference-only. See §23 Q1 |
| Difficulty mix 40/40/20 | **BUG / RISK** | §19 below | Stored 60/20/20. Documented, not fixed |

### GAP register

| ID | Gap | Kind | Owning phase |
|---|---|---|---|
| GAP-1 | No instruction box on the start screen | **Missing requirement** | Phase 2 |
| GAP-2 | Timer has no visual priority | Design | Phase 3 |
| GAP-3 | `MM:SS` past 60 minutes | Design | Phase 3 |
| GAP-4 | Submit dialog: no focus trap / initial focus / Escape | **A11y defect** | Phase 7 |
| GAP-5 | Visited state lost on refresh/recovery | **Behavioural** | §23 Q2 |
| GAP-6 | Start-page errors not `aria-describedby`-linked | A11y | Phase 2 |
| GAP-7 | `h1` is the question; no page-title heading | A11y | Phase 3 |
| GAP-8 | No candidate `:focus-visible` treatment | A11y | Phase 1 |
| GAP-9 | Legend `<dl>` has `<dd>` without `<dt>` | A11y | Phase 6 |
| GAP-10 | Palette has no responsive behaviour | Responsive | Phase 6 |
| GAP-11 | Header hierarchy is flat and wraps unpredictably | Design | Phase 3 |
| GAP-12 | Question position resets to 1 on resume | **Behavioural** | §23 Q2 |
| GAP-13 | Save status is global, thin, and easy to miss | Design | Phase 4 |
| GAP-14 | S8 textarea has no `maxLength`; overrun fails opaquely | Design (client-side only) | Phase 5 |
| GAP-15 | S8 renders "0 marks" | Copy | Phase 5 |
| GAP-16 | No skip link; palette landmark unlabelled | A11y | Phase 3 |
| GAP-17 | Touch targets below 44px | A11y | Phase 8 |
| GAP-18 | No reduced-motion handling | A11y | Phase 1 |
| GAP-19 | 55 palette buttons sit in the tab path | A11y | Phase 6 |
| GAP-20 | `text-black/50` ≈ 4.1:1, below AA | A11y | Phase 1 |

---

## 18. Component / Design-System Audit

### What the candidate side has

| Kind | Reality |
|---|---|
| Layout | None. `ExamShell` hand-rolls the whole layout inline |
| Buttons | None. Every button is a hand-written class string; **four different button styles** exist across five files |
| Inputs | None. `start-form.tsx` has a local `FIELD` constant; the S8 textarea has its own |
| Alerts | None. Three ad-hoc treatments: the expiry banner, `role="alert"` red paragraphs, the `NOTICE` box |
| Dialog | One, hand-rolled, in `SubmitDialog` |
| Loading | `LoadingOverlay` (shared, from the admin track) via `app/exam/loading.tsx` |
| Typography | Inline utilities. No scale |
| Colour | **Raw Tailwind opacity utilities** — `black/10`, `black/15`, `black/50`, `black/60`, `white/15`… |
| Tokens | **None.** Two CSS variables (`--background`, `--foreground`) |
| Icons | **None.** `lucide-react` is installed and used by the admin panel; the candidate side uses text arrows (`←`, `→`) |
| Dark mode | Present, via `dark:` utilities and `prefers-color-scheme` — and **untested** |

### Can admin primitives be reused?

Assessed component by component. The honest answer is *some*, and the track must not force the rest.

| Admin primitive | Reuse? | Reasoning |
|---|---|---|
| `LoadingOverlay` | **Yes — already is** | Neutral, and `app/exam/loading.tsx` already uses it |
| `Button` | **Yes, with a candidate size scale** | The variant model (primary/secondary/ghost + `loading` + `icon`) is right. But admin sizes are 32/36/40px, and exam actions need to be larger and easier to hit under pressure |
| `Alert` | **Probably** | Needs review against the expiry banner, which is full-bleed rather than in-flow |
| `Field` | **Yes, for `/exam/start`** | It already solves GAP-6 (`aria-describedby` + `aria-invalid`), which is exactly the gap |
| `Badge` | **Maybe** | For section/marks chips. Not for question status — the palette needs its own vocabulary |
| `Table`, `Pagination`, `FilterBar`, `EmptyState` | **No** | Nothing on the candidate side is a table or a list view |
| `Toast` | **NO — explicitly** | Transient, auto-dismissing, corner-anchored notifications are wrong for an exam. A candidate reading a question must never have save or timer information appear and then vanish. Exam status must be **persistent and in place** |
| `AdminShell`, `PageHeader`, nav | **No** | Different information architecture entirely |
| Design tokens | **Yes — extended, not adopted wholesale** | See below |

### The token decision

The admin tokens are `.cloudus-admin`-scoped (`globals.css:113`) specifically so they cannot reach
candidate pages, and they are **light-mode only by design** (`:41-44`). The candidate side needs a
parallel, deliberately-chosen set. **Recommendation:** introduce a `.cloudus-exam` scope with its
own token block, sharing the primitives that are genuinely universal (radius scale, shadow scale,
font stack, spacing rhythm, the CloudUS blue) while defining exam-specific surface, text, status and
palette-state colours at sizes and contrasts chosen for a long reading session. This keeps both
sides isolated and uses the same mechanism that has already proven it prevents leakage.

---

## 19. Business Rule — Difficulty Mix Discrepancy

**Verified live on 2026-09-09 by read-only query.**

```
SETTINGS  easyPercent: 60, mediumPercent: 20, hardPercent: 20
SCHEMA    prisma/schema.prisma:219-221 → default(40) / default(40) / default(20)
```

| | Easy | Medium | Hard |
|---|---|---|---|
| Requirements intent | 40% | 40% | 20% |
| Schema default | 40% | 40% | 20% |
| **Stored value** | **60%** | **20%** | **20%** |

**The discrepancy is unresolved and remains so.** It was documented across the admin track and is
re-confirmed here. It is **not changed in this phase**, and **no user-side design phase may change
it**: the mix affects paper generation, not presentation, and altering it is a business decision
that belongs to the product owner, not to a design track.

**Database state at audit time** (read-only): 0 candidates, 0 attempts, 0 questions, 0 exam
sessions; exam name "CloudUS Online Exam", 75 minutes, **CLOSED**. The question bank is empty, so no
paper can currently be generated — QA in later phases will need temporary fixtures under the same
discipline the admin track used (capture baseline → create identifiable temp data → QA → delete →
verify equality with baseline).

---

## 20. Keep / Improve / Redesign / Remove

### Keep — already right, do not touch

- Server-authoritative timer with clock-skew correction (§9)
- Autosave sequencing, `flush()`-before-submit, and the honest failure copy (§10)
- Real radio/fieldset/label semantics in `QuestionDisplay` (§7.3)
- Palette `aria-label`s, `aria-current`, and the non-colour-only state encoding (§7.4)
- The submit dialog's state machine, its copy, and its refusal to submit on unflushed answers
- `CompletionScreen` showing no score, ever
- Code blocks scrolling internally rather than pushing the page
- S7 lesson text rendered as plain text, never as markup
- The `.cloudus-admin` scoping mechanism — reused as the model for `.cloudus-exam`

### Improve — works, needs design

- **Timer** → strongest single element on screen; tabular figures; hours when duration exceeds 60 (GAP-2, GAP-3)
- **Header** → real hierarchy: exam identity, candidate identity, section context, then controls (GAP-11)
- **Save status** → persistent, legible, positioned where it is seen without hunting (GAP-13)
- **Palette** → per-state counts, section grouping, larger targets, responsive placement
- **Progress** → "23 of 55 answered" deserves more than a sentence between two buttons
- **S7** → lesson continuity: "Lesson 1 of 2", "Question 2 of 3", visual grouping in the palette (§13)
- **S8** → drop "0 marks", add a client `maxLength` mirroring the server's 5000, make unscored-ness explicit (GAP-14, GAP-15)
- **Start screen** → add the required instruction box (GAP-1); use `Field` for error wiring (GAP-6)
- **Completion screen** → give it the finality it deserves
- **Resume** → tell the candidate on the exam screen that their answers were restored (§11)

### Redesign — structural

- **The whole visual language.** Raw `black/15` utilities → a `.cloudus-exam` token system (§18)
- **Exam layout.** A three-region examination shell (header / question / palette) with real
  responsive behaviour rather than an unguarded flex row (§15)
- **Bottom action bar.** Currently Previous / count / Next. The reference's dedicated action bar with
  a primary Save & Next is better suited to the task — pending §23 Q1
- **Focus system.** The candidate side has no `:focus-visible` rule at all (GAP-8)

### Remove — genuinely unnecessary

Very little, deliberately. Nothing in the candidate UI is decorative enough to delete outright.

- **Candidate-side dark mode** — *proposed for removal*, pending §23 Q3. Exams run on supervised
  office PCs; a candidate whose OS is in dark mode gets a colour scheme that has never been designed
  or contrast-tested. Committing to one well-tested light scheme is the safer examination decision.
  **Not removed in Phase 0.**
- The `←` / `→` text arrows, in favour of real icons (`lucide-react` is already a dependency).

**Nothing functional is proposed for removal.**

---

## 21. Proposed Design Phases

The suggested structure was 8 phases + audit. Two deviations, both driven by findings:

1. **A dedicated Phase 1 for the token/primitive foundation.** The admin track could style pages
   incrementally because tokens already existed. Here they do not — the candidate side has two CSS
   variables (§6). Every later phase would otherwise invent its own colours, and the track would end
   in the same drift Admin Phase 11 had to clean up. Foundation first is cheaper.
2. **Palette and navigation split from the exam shell** (Phases 3 and 6 rather than one). The palette
   is where the status model, the counts, the section grouping, the responsive strategy and the
   largest accessibility questions all meet. It is the densest single surface in the app and it
   depends on the S7 grouping decided in Phase 5.

Total: **Phase 0 (this document) + Phases 1–8.**

---

### Phase 1 — Foundation: Tokens, Primitives, Focus

**Objective.** Establish the candidate design system so no later phase invents colour.
**Involves.** `app/globals.css`, a new `.cloudus-exam` scope, candidate button/field/alert
primitives, focus treatment.
**UX focus.** Typography scale for long-form reading; a contrast-verified palette; one focus
treatment everywhere.
**Untouched.** All logic. No component's behaviour changes; this phase may restyle at most one
surface to prove the primitives.
**Responsive.** Define the candidate breakpoint strategy; implement none of it.
**Accessibility.** GAP-8 (focus), GAP-18 (reduced motion), GAP-20 (contrast) resolved here.
**Testing.** Contrast ratios computed for every text/background pair; admin panel verified unchanged
(shared `globals.css`); build + typecheck + lint.
**Depends on.** Phase 0. **Blocked by** §23 Q3.

### Phase 2 — Candidate Start / Identity

**Objective.** Make the entry screen a proper examination entry: identity, eligibility, instructions.
**Involves.** `app/exam/start/page.tsx`, `start-form.tsx`.
**UX focus.** GAP-1 — the required instruction box (55 questions, 75 minutes, revisitable,
auto-submits, don't close the browser). Clear eligibility failure. A strong resume affordance.
**Untouched.** `startOrResumeExam`, all validation, all server messages, the eligibility rule, and
the identical-response property for malformed vs absent numbers.
**Responsive.** Single column; must work at 375 — the one candidate screen that plausibly meets a
phone.
**Accessibility.** GAP-6. The instruction box must be a real list in a labelled region.
**Testing.** All six `StartOutcome` states rendered; both closed-exam paths; validation unchanged.
**Depends on.** Phase 1.

### Phase 3 — Exam Shell / Header / Candidate Panel

**Objective.** The examination frame: identity, section, timer, submit, and the layout regions.
**Involves.** `exam-shell.tsx` (layout + header), `exam-timer-display.tsx`.
**UX focus.** GAP-2, GAP-3, GAP-11. The timer becomes the strongest instrument on screen; the header
gets hierarchy; the candidate panel gets a home.
**Untouched.** **The entire timer mechanism** — skew measurement, 30s resync, expiry callback,
auto-submit loop. This phase restyles `ExamTimerDisplay`'s output and must not alter its effects.
**Responsive.** Establish the shell's region behaviour at all six widths.
**Accessibility.** GAP-7 (heading structure), GAP-16 (skip link, landmarks). The timer's `aria-live`
policy is kept as-is.
**Testing.** Timer verified against a real attempt: correct countdown, resync, five-minute threshold,
zero → expiry → auto-submit.
**Depends on.** Phases 1, 2.

### Phase 4 — Question Experience

**Objective.** The question itself — the screen the candidate spends 75 minutes reading.
**Involves.** `question-display.tsx`.
**UX focus.** Reading measure and rhythm; option rows as unmistakable targets; code blocks; question
metadata (number, section, marks); save state made legible (GAP-13).
**Untouched.** Radio semantics, `name`/`value`/`checked` wiring, the `onAnswer` contract, the S8
textarea's remount-by-key behaviour, `whitespace-pre-wrap` on all candidate-authored text.
**Responsive.** Question column at all six widths; code blocks keep scrolling internally.
**Accessibility.** Option focus and hit area; the selected state must not be conveyed by colour alone.
**Testing.** Every question shape: plain, code block, long text, all four options, S7, S8.
**Depends on.** Phases 1, 3.

### Phase 5 — S7 Learn-and-Apply + S8 Attitude

**Objective.** The two sections that are not ordinary MCQs.
**Involves.** `question-display.tsx`.
**UX focus.** S7 lesson continuity — "Lesson 1 of 2", "Question 2 of 3 in this lesson", visual
grouping (§13), using the already-present-but-unused `lessonGroup` field. S8 unmistakably unscored:
remove "0 marks" (GAP-15), add a client `maxLength` (GAP-14).
**Untouched.** Lesson-group generation, contiguity invariants, the server-side free-text decision,
`MAX_TEXT_ANSWER` as the server's limit, S8's exclusion from scoring.
**Responsive.** The lesson box at all six widths; it is the tallest element on the candidate side.
**Accessibility.** Lesson region labelling; the relationship between lesson and question must be
available to a screen reader, not only visually.
**Testing.** A generated paper's S7 verified as 2 groups × 3 contiguous questions; S8 save verified
at and beyond 5000 characters.
**Depends on.** Phases 1, 4.

### Phase 6 — Question Palette / Navigation

**Objective.** The densest surface: status at a glance, jump anywhere, orient by section.
**Involves.** `question-grid.tsx`, the bottom navigation in `exam-shell.tsx`.
**UX focus.** Per-state counts; section grouping (including the S7 lesson groups from Phase 5);
larger targets; the responsive strategy (GAP-10); the bottom action bar — Previous / Next, and
Save & Next if §23 Q1 resolves that way.
**Untouched.** The `onJump` contract; answered state deriving from `answers`; the requirements'
colour-coding meanings (grey / blue / outline).
**Responsive.** The main event. The palette must have a defined behaviour at 1024, 768 and 375.
**Accessibility.** Preserve `aria-label` and `aria-current`; keep the non-colour-only encoding; 44px
targets; GAP-9 (legend structure), GAP-19 (tab order).
**Testing.** All states across a 55-question paper; keyboard reachability; overflow measured at all
six widths.
**Depends on.** Phases 1, 3, 5. **Blocked by** §23 Q1.

### Phase 7 — Submit / Auto-Submit / Completion / Recovery

**Objective.** The end of the exam, and the interruptions before it.
**Involves.** `submit-dialog.tsx`, `completion-screen.tsx`, the expiry banner, resume messaging.
**UX focus.** A confirmation that is calm and unambiguous; a completion screen with real finality; a
recovery experience that *tells the candidate their answers survived* (§11).
**Untouched.** The five-phase state machine, `flush()`-before-summary, the refusal to submit on a
failed flush, server-decided terminal status, idempotent finalization, **and the absolute rule that
no score reaches the candidate**.
**Responsive.** The dialog at 375; the completion screen at all widths.
**Accessibility.** GAP-4 — focus trap, initial focus, Escape. Deliberately *not*
click-outside-to-dismiss.
**Testing.** Manual submit, auto-submit at zero, double-submit, submit with a failed save, submit
after expiry, resume after a hard refresh, an already-submitted candidate re-entering.
**Depends on.** Phases 1–6.

### Phase 8 — Final Consistency, Accessibility & Full QA

**Objective.** The Admin Phase 11 equivalent: cross-screen consistency, not redesign.
**Involves.** Everything, minimally.
**UX focus.** Drift between screens; loading/error/recovery states; a candidate-scoped `error.tsx`
and `not-found.tsx` (currently absent — §5).
**Untouched.** Everything functional. This phase fixes inconsistency, not design opinion.
**Responsive.** Overflow measured at all six widths on every candidate route.
**Accessibility.** GAP-17 (touch targets) and a full sweep of the register.
**Testing.** Full browser QA; contrast verified; `tsc`, `eslint`, `next build`, `prisma migrate
status`; database restored exactly to baseline.
**Depends on.** Phases 1–7. **Blocked by** §23 Q2.

---

## 22. Explicitly Out of Scope

Out of scope for the entire user-side track unless the product owner rules otherwise in writing.

**Proctoring and surveillance** — webcam, video, microphone, screen recording, tab/focus tracking,
AI proctoring, copy-paste blocking, fullscreen enforcement, right-click suppression.

**Candidate account model** — accounts, passwords, password reset, email verification, login.

**Result exposure** — candidate results page, score display, marks feedback, correct answers,
explanations, per-section breakdown, rank, percentile. `CandidateQuestion` omits `correct` and
`explanation` deliberately and **must continue to**.

**Business logic** — scoring, paper generation, difficulty selection, the 60/20/20 discrepancy,
the section blueprint, marks, S7 grouping rules, timer semantics, autosave mechanics, submission
rules, eligibility, the one-attempt rule.

**Data layer** — Prisma schema changes, migrations, new columns (including any "visited" or
"flagged" column), new tables, new API routes, new Server Actions, changed action signatures.

**Dependencies** — no new runtime dependency. `lucide-react` is already present and may be used.

**The admin panel** — complete, and not reopened by this track. Shared files (`app/globals.css`,
`app/layout.tsx`) may be touched **additively only**, and any change must be verified not to alter
admin rendering.

**Product features** — negative marking, question bookmarking beyond §23 Q1, section-wise timing,
calculator, scratchpad, chat/support, multi-language, practice mode, sample papers.

---

## 23. Known Risks and Open Questions

**These must be answered before the phase that depends on them.**

> **Q1 — Mark for Review: add it, or not?** *(blocks Phase 6; affects Phases 3, 4)*
> The reference screenshot has it prominently. The CloudUS requirements **never mention it**. It is
> genuinely useful in a 55-question exam — but it is **new product functionality**, and it needs a
> home: client-only state (lost on refresh, like `visited`) or a persisted column (a schema change,
> which §22 forbids). *Recommendation:* **defer.** Ship the track without it and revisit it as a
> product decision. Adding it later is cheap; adding it now silently expands scope and forces a
> schema question this track is not allowed to answer.

> **Q2 — Should `visited` and question position survive a refresh?** *(GAP-5, GAP-12; blocks Phase 8)*
> Both are real gaps, and both are **behavioural, not visual**. A candidate whose PC restarts returns
> to question 1 with their progress markers cleared. Options: (a) leave as-is and document;
> (b) `sessionStorage` — client-only, no schema change, survives a refresh but not a machine restart;
> (c) persist server-side, which needs a schema change (forbidden by §22).
> *Recommendation:* **(b)** — it resolves the common case (refresh, accidental tab close) at near-zero
> cost and stays inside the track's constraints. Needs explicit approval, since it changes behaviour.

> **Q3 — Keep candidate-side dark mode?** *(blocks Phase 1)*
> It exists via `dark:` utilities and has never been designed or contrast-tested. Exams run on
> supervised office PCs. *Recommendation:* **remove**, and commit to one well-tested light scheme —
> the same reasoning the admin panel used. Needs approval: it is a visible change for any candidate
> whose OS is set to dark.

> **Q4 — Does the "Question Paper" viewer earn a place?** *(affects Phase 6)*
> The reference has one. The palette may already cover the need. *Recommendation:* **no** — it is new
> functionality with no requirement behind it.

### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| The question bank is **empty** (0 questions) — no paper can be generated | Blocks all realistic QA from Phase 3 onward | Temporary fixtures under the admin track's discipline: capture baseline → identifiable temp rows → QA → delete → verify equality |
| `app/globals.css` and `app/layout.tsx` are shared with the completed admin panel | A token change could silently alter admin rendering | Scope every candidate token under `.cloudus-exam`; verify admin rendering after every phase touching `globals.css` |
| The timer, autosave and submission are correct but subtle | A well-meant refactor during restyling could break clock-skew handling or save sequencing | Restyle only. No phase may edit `use-autosave.ts` logic or `ExamTimerDisplay`'s effects |
| The exam is **CLOSED** and there are 0 candidates | `/exam/start` renders only the closed state; the exam screen is unreachable without fixtures | Same fixture discipline; restore `isOpen: false` exactly |
| Production session cookie is `secure: true` | Browser QA over plain HTTP cannot hold a session under `next start` | QA on `next dev`, as the admin track did. **Do not weaken cookie security for QA** |
| Candidate dark mode is untested | Contrast failures may already exist in dark mode | Resolve Q3 in Phase 1 before styling anything |

---

## 24. Rules for Future User-Side Design Phases

Binding on every phase in this track.

1. **Read this document first.** It is the source of truth. If it is wrong, correct it in the same
   change and say so.
2. **One phase at a time. Stop at the end of each phase and wait for approval.** Never begin the next
   phase unprompted.
3. **Do not change business logic.** Scoring, paper generation, difficulty selection, timer
   semantics, autosave mechanics, submission rules, eligibility, session handling. Restyle the
   output; never alter the behaviour.
4. **Do not change Server Action signatures or return shapes.** In particular, **never add an attempt
   id, candidate id, or ownership claim to any action** — the current design is a deliberate security
   property (§6).
5. **No score, ever, on the candidate side.** Not in a component, not in a DTO, not in a debug path.
6. **No new dependencies. No schema changes. No migrations. No new routes.**
7. **Additive only in shared files.** `globals.css` and `app/layout.tsx` are shared with the finished
   admin panel; verify admin rendering after touching either.
8. **Accessibility is part of the phase, not a follow-up.** A phase that leaves a known unlabelled
   control or an unreachable focus state is not complete.
9. **Status must never be colour-only.** Inherited from the current build; do not regress it.
10. **Test what you claim.** Do not report a state as verified without exercising it. Distinguish a
    real defect from an incorrect test assertion, explicitly.
11. **Database discipline.** Prefer read-only QA. If fixtures are needed: capture baseline → create
    clearly identifiable temporary rows → QA → delete every one → verify the final state equals the
    baseline. Leave no test data. Restore every setting, including `isOpen: false`.
12. **Do not touch the 60/20/20 discrepancy** (§19). Documented, unresolved, and not this track's to
    resolve.
13. **Do not reopen the admin panel.** That track is complete.
14. **Answer the open questions (§23) before the phase that depends on them.** Do not decide them
    silently by implementing one option.
15. **Every phase reports:** routes audited · files changed · what changed and why · states verified ·
    responsive results at 1920/1440/1280/1024/768/375 with explicit overflow findings · accessibility
    results · functionality preserved · static checks · database state · limitations.

---

*Design Phase 0 — audit and plan. No application source file, database row, dependency, or migration
was changed in producing this document.*
