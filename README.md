# CloudUS

CloudUS is an online examination system used to assess fresher candidates during hiring.
Candidates take the exam on supervised office machines; results are produced automatically
for the hiring team.

Built so far: the database schema, admin authentication, candidate
synchronization from the Google Form, question-bank CSV import and management,
exam settings, candidate eligibility and start, and exam paper generation. The
exam interface itself, the timer, auto-save, submission and scoring are not
built yet.

## Technology stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| ORM | Prisma |
| Database | PostgreSQL, hosted on Supabase |
| Linting | ESLint |

Supabase is used **only** as a managed PostgreSQL host. Supabase Auth, Storage, Realtime,
and Edge Functions are not used. All database access goes through Prisma from the Next.js
server runtime.

```
Next.js  →  Prisma  →  PostgreSQL (Supabase)
```

Frontend and backend live in this single Next.js application.

## Requirements

- Node.js 20 or newer
- npm
- A PostgreSQL database (Supabase project)

## Local setup

```bash
npm install
cp .env.example .env   # then fill in the values
npx prisma generate
npm run dev
```

The development server runs at http://localhost:3000.

## Environment variables

Copy `.env.example` to `.env` and provide values. Every variable is server-only —
none may be prefixed with `NEXT_PUBLIC_`, and `.env` is git-ignored.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled Supabase PostgreSQL connection used at runtime |
| `DIRECT_URL` | Direct Supabase PostgreSQL connection used by Prisma migrations |
| `ADMIN_EMAIL` | Email of the admin account created by the seed |
| `ADMIN_PASSWORD` | Password for that account; stored only as a bcrypt hash |
| `GOOGLE_APPS_SCRIPT_SECRET` | Bearer secret the Apps Script sends when syncing candidates; use a long random value |

## Prisma

The schema lives in `prisma/schema.prisma`. Under Prisma 7 the connection URLs are
configured in `prisma7.config.ts` rather than in the schema itself.

```bash
npx prisma generate   # regenerate the client into lib/generated/prisma
```

The generated client is git-ignored and is regenerated automatically on `npm install`.
The shared client instance is exported from `lib/db`.

The models are `Question`, `Candidate`, `Attempt`, `AttemptQuestion`, `Answer`,
`Admin`, `AdminSession` and `ExamSetting`.

## Admin access

Create the admin account from `ADMIN_EMAIL` and `ADMIN_PASSWORD`:

```bash
npm run db:seed
```

The seed is idempotent — it upserts on the email, so running it repeatedly
never creates a second admin. It refreshes the password hash on every run, so
rotating a password means changing `ADMIN_PASSWORD` and re-seeding. It fails
with a clear error if either variable is missing.

Then sign in at `/admin/login`; `/admin` is protected and redirects there when
no valid session exists.

Sessions are server-side. Logging in stores a row in `admin_sessions` and sets
an HTTP-only, SameSite=Lax cookie (`cloudus_admin_session`, `Secure` in
production) holding a random 256-bit opaque token. Only the SHA-256 hash of that
token is stored, so a database dump cannot be replayed as a live session.
Sessions last 8 hours, expiry is enforced server-side, expired rows are deleted
when encountered, and logging out deletes the row as well as clearing the cookie.

Passwords are hashed with bcrypt (cost 12) and never logged, returned to the
browser, or stored in plaintext. Login failures always return the same message,
so the form cannot be used to discover which accounts exist.

There is no login rate limiting yet — see the security note below.

## Candidate exam interface

The exam itself is at `/exam`, reached from the start page once eligibility has
been proven and the paper generated.

### Exam session

Candidates have no accounts, so the exam screen identifies the attempt through
a short-lived session cookie rather than anything the browser names. Starting an
exam issues `cloudus_exam_session` — httpOnly, SameSite=Lax, `Secure` in
production — holding a random 256-bit opaque token whose SHA-256 hash is the
only thing stored, in `exam_sessions`. **The attempt id is never accepted from
the request**, so there is no URL or cookie edit that reaches another
candidate's exam. A missing, forged or expired cookie redirects to the start
page. Sessions are deliberately separate from admin sessions: a candidate is a
temporary exam participant, not a user.

### What the browser receives

The server maps the stored paper into a candidate-safe shape and names every
field explicitly rather than spreading the database row. **`correct` and
`explanation` are never sent** — not in the payload, not in the rendered HTML.
Each question carries only its id, position, section and section name, question
text, code block, the options in display order, lesson text and group, marks,
and whether it is free-text.

### Rendering

One question at a time, from the persisted snapshot — the question bank is never
read. Options appear in the order stored in `shuffledOptionOrder`, and each
keeps its **original key**, so selecting the first displayed option records `c`
if C is displayed first. Nothing is shuffled at render time, so navigating away
and back, or refreshing, shows the same order.

Code blocks render in a monospace block preserving whitespace and scrolling
horizontally when needed. Nothing is treated as markup.

Section 7 shows its lesson in a distinct panel above the question; all three
questions of a group show the same lesson. Section 8 renders a textarea instead
of options, noting there is no right or wrong answer.

### Navigation and question states

Previous/Next move one question and are disabled at the ends. The 55-button grid
jumps anywhere. Each button is **answered** (filled), **visited but unanswered**
(outlined), or **not visited** (greyed), with the current question additionally
ring-highlighted — states differ in weight and border as well as colour, and
each button carries an accessible label naming its state. A legend explains
them. Navigation is entirely client-side and writes nothing to the database.

### Timer

The deadline is always `attempt.startedAt + durationMinutes`, computed on the
server. The browser is told the deadline and the server's clock, and counts down
from the *difference* between them — so changing the machine's clock shifts both
sides equally and buys no extra time. The page re-syncs with the server every 30
seconds, and a refresh recomputes from the original `startedAt` rather than
restarting.

When the deadline passes, the server refuses answer writes, the inputs are
disabled and a banner explains that time is up. Answers already saved are kept.

### Auto-save

There is no Save button. Choosing an option saves immediately; free text saves
after a ~600ms pause in typing, and anything still pending is flushed if the
page is closed. The header shows *Saving… / Saved / Not saved*, and never claims
a save that did not happen.

Each question carries a request sequence number, so a slow save of an earlier
choice landing after a newer one cannot overwrite it or misreport the state.
`Answer.attemptQuestionId` is unique, so repeated saves upsert one row.

Every save re-derives the attempt from the session cookie, confirms the question
belongs to *that* attempt, confirms the attempt is still in progress and the
timer has not expired, and decides from the stored section whether the question
takes an option or prose — no client flag is trusted. `isCorrect` and
`marksAwarded` are never written here; scoring owns them.

### Resume

Refresh, navigating away and back, or reopening the browser all return the same
attempt, the same paper, the same option order and the saved answers, with the
timer continuing from the original start. If the exam-session cookie is gone,
the candidate re-enters through `/exam/start` with their mobile and lands back
on the same attempt — no second attempt, no second paper.

Two tabs on one session share the same attempt and write to the same answer
rows.

### Submission

Submit opens a confirmation showing how many questions are answered and which
numbers are not — counted from the **stored** answers, never from browser state,
and only after any pending save has been flushed, so it cannot overstate what
was saved. If a save failed, the dialog says so instead of showing a count.
*Go back* returns to the exam and finalizes nothing.

An attempt ends exactly once. The write is a conditional update guarded on
`status = in_progress`, so a repeated click, a retry, or a manual submit racing
the auto-submit all find the row already settled and return the state that won,
leaving its `submittedAt` untouched. A terminal attempt never reverts.

Which terminal state gets written is the **server's** decision, from its own
clock: submitting before the deadline records `submitted`, and a manual submit
that arrives after it records `auto_submitted`, because the exam had already
ended. The browser cannot force one or the other.

### Auto-submit

When the countdown reaches zero the page asks the server to finalize. The server
finalizes only if its own clock agrees the deadline has passed — a browser
claiming zero proves nothing — and the page keeps asking every couple of seconds
until it does, since the client can reach zero a moment early.

**A closed browser cannot make that request.** What protects the exam is not the
client call but the server: once `startedAt + duration` has passed, answer
writes are refused and the attempt is treated as expired everywhere, so an
abandoned attempt cannot gain time or accept late answers. It simply stays
`in_progress` until something touches it. Finalizing those without a browser
would need a scheduled job, which this deployment does not yet have — worth
adding before a real sitting if abandoned attempts must self-close.

### After submission

The completion screen states the exam was submitted (or that time expired) and
shows **no score, marks, answers or explanations**. Refreshing keeps it: the
page checks the stored status, so a finalized attempt never reopens the exam.
Returning to `/exam/start` with the same mobile is refused, as before.

### Not yet built

Scoring, results, and CSV export are later phases. Nothing here computes
`isCorrect`, `marksAwarded` or a total.

## Scoring

Scoring lives in `lib/exam/scoring.ts` and runs entirely on the server. Nothing
about it is reachable from the candidate browser: no action returns a score, and
`correct` never leaves the database for a candidate response.

### When it runs

`finalizeAttempt` calls it immediately after the attempt reaches a terminal
state, so a manually submitted and an automatically submitted attempt are scored
identically. Only `submitted` and `auto_submitted` attempts can be scored; an
`in_progress` attempt is rejected, because it is still accepting answers.

Scoring is deliberately *not* part of finalization's atomic write. The attempt is
already terminal by the time scoring starts, and a scoring failure is logged and
swallowed rather than rolled back — reverting would hand a submitted candidate
their exam back. A failure leaves the attempt finalized with `scored_at` still
null, which is exactly what a later `scoreAttempt()` call picks up and finishes.

### Rules

- **Snapshot-based.** Every value comes from the `AttemptQuestion` row: `correct`,
  `marks`, `section` and `scored`. The live `Question` row is never read. Editing,
  re-marking, re-sectioning or deactivating a question in the bank cannot change a
  result that has already been produced.
- **No negative marking.** A wrong answer scores 0, never less.
- **Unanswered** questions score 0 with `is_correct = false`, and keep
  `selected_option = null` so an admin view can still tell them apart from a
  wrong answer.
- **Invalid answers** — anything outside `a`–`d` — are treated as unanswered and
  score 0. The enum blocks such values at the column too.
- **Section 8 is never scored.** Its free text stays in `text_answer` untouched,
  `is_correct` is `null` (not `false` — the candidate did not get it "wrong"),
  `marks_awarded` is 0, and the section total is always 0.
- **Section 7** is 6 questions across 2 lesson groups at 2.5 marks each, for a
  maximum of 15.

### Persistence

`attempts` carries `total_score`, `section_1_score` … `section_8_score` and
`scored_at`, all `Decimal(5,2)`. Per-question results go to `answers.is_correct`
and `answers.marks_awarded`. Scoring writes only those columns — a candidate's
`selected_option` and `text_answer` are never modified.

Marks are summed as integer hundredths and converted to a fixed 2-decimal string
at the edges, so a section of 1.5-mark questions totals exactly `12.00` rather
than `11.999999999999998`.

### Idempotency and concurrency

Each run recomputes the entire score from the stored paper and answers; nothing
is accumulated, so re-running is a no-op rather than a doubling. Rows are written
with a single set-based `INSERT ... ON CONFLICT` covering the whole paper, which
also keeps the transaction short enough that several callers scoring the same
attempt at once cannot time it out. Four concurrent runs produce one consistent
total and no duplicate answer rows.

### Failure handling

A paper that does not describe a valid exam — wrong question count, a section
short of questions, a section scoring above its maximum, an unknown section, or a
total outside 0–70 — is refused. Nothing is written and the problems are logged.
The result is never clamped into range, because an impossible score is a data
problem for an admin, not a number to round.

A `CHECK` constraint on `attempts` independently rejects any stored total outside
0–70.

### Not in this phase

There is no admin result UI and no candidate-facing result of any kind. Phase 12
provides only the scoring backend and its stored data.

## CSV export

Two admin-only exports, both generated straight into the HTTP response. Nothing
is written to disk, uploaded to storage, or served from a public URL, and no CSV
content or candidate detail is ever logged.

### Summary export — `/admin/attempts/export`

Reached from the **Export CSV** button on `/admin/attempts`. One row per attempt,
honouring the filters currently applied — `q`, `status`, `scoring`, `candidate`,
`sort` — parsed by the same `parseAttemptFilters` the page itself uses, so an
unrecognised value falls back to its default rather than reaching the database.
Page size is deliberately ignored: the export covers the whole filtered set, not
the page being viewed.

28 columns:

```
attempt_id, candidate_name, candidate_email, candidate_mobile,
entered_name, entered_email, status, started_at, submitted_at, scored_at,
total_score, max_score,
section_1_score, section_1_max, … section_8_score, section_8_max
```

Maxima are 10 / 6 / 10 / 12 / 9 / 8 / 15 / 0, total 70.00.

### Detailed export — `/admin/attempts/[id]/export`

Reached from **Export result CSV** on the individual result page, which appears
only for a finalized, scored attempt. One row per question, 29 columns, covering
the snapshot question and options, the displayed option order, candidate and
correct answers, result, marks, explanation, and lesson group/text.

The route refuses an in-progress attempt (409) as well as hiding the button:
those rows carry the correct answers and explanations, and handing them over
during a supervised sitting would leak the answer key. A scoring-pending attempt
is refused for the simpler reason that there is no result yet.

### Scores

Always the persisted Phase 12 columns — never recomputed, and never calculated in
the browser. Every score cell is formatted to exactly two decimals from the
Decimal's own string, so `1.5` exports as `1.50` and no floating-point artefact
can appear.

A score column is **blank** unless the attempt is both finalized and scored:

| Attempt state | Score columns |
|---|---|
| `in_progress` | blank (also `submitted_at`, `scored_at`) |
| finalized, `scored_at` null | blank (`submitted_at` still populated) |
| finalized and scored | persisted values |

Blank rather than `0.00`, which would read as "scored zero". Exporting never
triggers scoring.

### Historical integrity

The detailed export reads only the `AttemptQuestion` snapshot — question text,
code block, options, `correct`, explanation, marks, section, lesson text, lesson
group, `scored`, and the option permutation. **The live `Question` table is never
queried.** A test rewrites every field of every source question, deactivates them,
and asserts both exports come back byte-identical.

### Escaping and encoding

Rows are serialized by papaparse — the same library the question-bank import uses
— so commas, double quotes, newlines, carriage returns, tabs and Unicode are
escaped by a real CSV writer rather than by string concatenation. Every CSV is
prefixed with a UTF-8 BOM so Excel renders Gujarati, accented Latin and CJK text
correctly. Multiline code blocks and Section 8 free text round-trip exactly,
verified by parsing the output with a CSV parser rather than by string matching.

### Formula-injection protection

Excel and Sheets execute a cell whose text begins with `=`, `+`, `-`, `@`, or a
leading tab/carriage return. Any exported value starting with one of those is
prefixed with a single quote, which spreadsheets consume as "treat as text".

The stored data is untouched — only the exported representation changes — and
ordinary text, including text with an interior `=`, is left exactly as it is. A
genuinely negative number is quoted too: there is no way to distinguish `-5` from
`-1+1` without parsing, and a visible quote is a far smaller cost than executing
a formula from a candidate-supplied name or free-text answer.

### Access and privacy

Both routes call `requireAdmin()` before any query; an unauthenticated request
gets a 307 to `/admin/login` with no CSV body, and a forged session cookie is
rejected. Filenames carry a date and, for the detailed export, the attempt id —
never a candidate name, email or mobile, since filenames end up in download
histories. Responses are `Cache-Control: no-store`.

### Known limitations

- The export builds the whole CSV in memory and sends it in one response. Fine at
  hiring-cohort scale; a very large dataset would want streaming.
- There is no combined "all attempts, all questions" export — the detailed export
  is per attempt.
- A legitimately negative-looking value is quote-prefixed, as described above.

## Admin individual result

`/admin/attempts/[id]` — the full review of one attempt, behind `requireAdmin()`.
Review-only: there is no edit, override, rescore, reopen or delete control.

### Data source

Everything historical comes from the `AttemptQuestion` snapshot taken when the
paper was drawn: question text, code block, options, correct answer, explanation,
marks, section, lesson text and lesson group, plus the stored option permutation.
**The live `Question` table is never read.** Rewriting or deactivating a question
in the bank afterwards leaves an existing result byte-identical, which is asserted
by a test that rewrites every field and re-renders.

Scores come from the columns Phase 12 persisted on `Attempt`. The page never calls
the scoring engine and never recomputes a total.

`topic` is not part of the snapshot, so it is not shown — reading it from the live
question would break historical integrity for the sake of one label.

### Page states

| Attempt state | What is shown |
|---|---|
| `in_progress` | Candidate and attempt metadata, "In Progress". **No score, no correct answers, no explanations, no question review.** |
| finalized, `scored_at` null | "Scoring Pending". No score, no review. Nothing is scored by opening the page. |
| finalized and scored | Full result: total, section breakdown, all 55 questions. |

The in-progress case returns before any snapshot row is loaded, so the answer key
cannot reach the page while a supervised exam is still running.

### Layout

Back to attempts (preserving the filter you arrived with) · Candidate summary ·
Attempt summary · Score · Section breakdown · Question review.

An entered name or email that differs from the synchronized registration is
highlighted; matching values are not repeated.

### Question review

Grouped by section, ordered by `displayOrder`. Each question shows its number,
state, marks awarded over maximum, text, code block, options, candidate answer,
correct answer with its option text, and explanation ("No explanation provided."
when the snapshot has none).

**Option order** is reconstructed from `shuffledOptionOrder`, so the admin sees the
paper exactly as the candidate did. The letter shown is the original snapshot key,
not the display position, and the correct option is identified from the snapshot
`correct` regardless of where the shuffle placed it.

**States** are distinguished rather than collapsed:

- **Correct** — full snapshot marks
- **Wrong** — 0 marks, candidate's choice shown
- **Unanswered** — 0 marks, never labelled wrong
- **Unscored** — section 8 only

A question with no `Answer` row at all reads as Unanswered with 0 marks. Viewing
does not create the missing row.

### Section 7

Grouped by `lessonGroup`, with the snapshot lesson text shown once above the three
questions drawn with it. Groups never interleave and question order within a group
is preserved. Maximum 15.00 across 2 groups × 3 questions × 2.5 marks.

### Section 8

Free-text answers are displayed exactly as stored — never trimmed, normalized or
rewritten. No correct answer, no correctness and no right/wrong state is shown,
because the section is unscored by design. Marks are always 0.00 / 0.00 and the
section total is always 0.00.

### Read-only and performance

The page issues three reads — the attempt with its candidate, the exam settings,
and the snapshot rows with their answers joined — regardless of paper size, so
there is no per-question query. It contains no write call of any kind; a test
asserts the attempt row, every answer, the paper and the question bank are all
unchanged after repeated viewing.

### Known limitations

- `topic` cannot be reviewed historically, as above.
- The page is desktop-first and not tuned for narrow screens.
- There is no export; a long paper is one scrolling page.

## Admin candidates and attempts

Two read-only admin views, both behind `requireAdmin()`. An unauthenticated
request is redirected to `/admin/login` and no data is rendered.

### `/admin/candidates`

Registrations synchronized from the Google Form, read from the `candidates`
table — nothing here queries Google. Columns: name, email, mobile, registered,
updated, and the number of attempts.

- **Search** by name, email or mobile (`?q=`), case-insensitive, server-side.
- **Pagination** (`?page=`, `?pageSize=` from 25 / 50 / 100), default 25.
- Attempt counts come from a `_count` aggregate in the same query, so the page
  costs two statements regardless of how many candidates it shows.
- **View attempts** links to the attempts page filtered to that candidate.

Mobile numbers are deliberately not unique. Two candidates sharing one are shown
as two rows and are never merged.

### `/admin/attempts`

Columns: candidate name, email, mobile, status, started, submitted, score, and a
result link. Where the name typed on the start screen differs from the registered
name, both are shown so a mismatch is visible.

- **Search** by candidate name, email or mobile (`?q=`).
- **Status filter** (`?status=`): in_progress, submitted, auto_submitted. The
  stored enum is never changed — only its label ("In Progress", "Submitted",
  "Auto Submitted").
- **Scoring filter** (`?scoring=`): `scored`, or `pending` for an attempt that is
  finalized but has no `scored_at` yet. In-progress attempts are not "pending" and
  are excluded from that filter.
- **Sort** (`?sort=`): newest (default), oldest, submitted newest/oldest, score
  high-to-low, score low-to-high. Sort keys are resolved through a fixed
  allowlist with `Object.hasOwn`, so no query value ever reaches `orderBy` —
  including prototype keys such as `__proto__`.
- **Candidate filter** (`?candidate=`) is resolved against the database before
  use; an id that matches nothing filters to zero rows rather than being trusted
  or silently ignored.
- **Pagination** as above. Ordering breaks ties on `id`, so paging is stable when
  attempts share a timestamp or score.

Every query parameter is parsed defensively: unknown status, scoring, sort and
page-size values fall back to the default, and a page number that is negative,
zero, fractional or non-numeric becomes page 1. Filters live in the URL, so an
admin view is shareable and bookmarkable.

### Score visibility

Scores appear only in the authenticated admin interface, and only from the
columns scoring persisted — nothing is recalculated for a listing.

| Attempt state | Shown |
|---|---|
| `in_progress` | "Not finalized" |
| finalized, `scored_at` null | "Scoring pending" |
| finalized and scored | `52.50 / 70.00` |

An in-progress attempt never shows a number that could be mistaken for a final
result. Candidate-facing code is unchanged and still carries no score, no
`correct` and no `explanation`; a regression test asserts this.

### Read-only

Phase 13 adds no way to change exam data. The pages issue only reads, the query
modules contain no write call, and the only form on either page is the GET filter
form. An admin cannot edit answers, submit for a candidate, change a status,
alter the timer or adjust a score from these views.

### `/admin/attempts/[id]`

A deliberate placeholder so "View result" has a real target and the attempt id is
validated. It shows candidate, status and start time only — no score, no section
breakdown, no question review. Phase 14 builds the real result page.

### Indexes

No migration was needed. Sorting and filtering use existing indexes on
`attempts.started_at`, `submitted_at`, `scored_at`, `status`,
`(candidate_id, status)` and on `candidates.email` / `mobile`.

Case-insensitive `contains` search does not use those btree indexes and scans.
At a hiring cohort's scale that is fine; if the candidate table grows into the
hundreds of thousands, a trigram index would be the fix. No index was added
speculatively.

## Paper generation

Each attempt gets its own randomly drawn paper of 55 questions worth 70 marks.
It is drawn once, when the candidate starts, and **never redrawn** — not on
refresh, not on resume, not after the question bank or the difficulty mix
changes. The stored `attempt_questions` rows are the paper.

### Selection

Only questions with `status = ready` and `isActive = true` are eligible. Draft
and deactivated questions are never drawn.

Sections always appear in blueprint order, occupying fixed positions:

```
1–10  §1    11–16 §2    17–26 §3    27–34 §4
35–40 §5    41–44 §6    45–50 §7    51–55 §8
```

`displayOrder` is persisted explicitly as a gapless 1–55; nothing depends on
insertion order.

### Difficulty

The target mix is an admin setting (default 40/40/20, see Exam settings). Per
section it is converted to whole numbers by **largest remainder**: floor each
share, then give the leftovers to the largest fractional parts. This always sums
to the section's exact count, where naive rounding would not — 40/40/20 of 4
questions is 1.6/1.6/0.8, which rounds to 2/2/1 and overshoots. A 10-question
section becomes 4/4/2; a 6-question section becomes 3/2/1.

If the bank is short on a difficulty, the allocation clamps to what exists and
redistributes the shortfall to difficulties with spare questions, so the section
still reaches its exact count with the smallest deviation available. If there
are not enough eligible questions overall, **generation fails** — it never
shrinks a section, reuses a question, or reaches for ineligible ones.

### Section 7

Drawn as whole lessons, not individual questions. Groups with fewer than three
eligible questions are excluded entirely. Every complete group's difficulty
profile is scored against the target, the closest pair is chosen (at random
among equally close pairs), and each group's three questions stay together and
in order. Fewer than two complete groups fails generation.

### Options

Each question stores a random permutation in `shuffledOptionOrder`, e.g.
`["c","a","d","b"]` — the order to display the options in. **`correct` keeps
the original option key**; it is never rewritten to a shuffled position. So a
question whose answer is C stores `correct = "c"` regardless of where C appears.
Every permutation is validated to hold a, b, c and d exactly once.

### Snapshot

Copied to `attempt_questions` at draw time: question text, code block, all four
options, correct key, explanation, lesson text, lesson group, and marks. A
historical paper renders entirely from these, so editing or deactivating a
question never changes an exam someone already sat.

### Concurrency and failure

Generation runs in one transaction: a failure part way through leaves no partial
paper. Two simultaneous requests cannot produce two papers — the unique
constraints on `(attempt_id, display_order)` and `(attempt_id, question_id)`
reject the loser, which then returns the winner's paper instead of an error.

Failures carry an internal code (`SECTION_INSUFFICIENT_QUESTIONS`,
`SECTION_7_INSUFFICIENT_LESSON_GROUPS`, `PAPER_INVARIANT_FAILED`, …) for the
server log. Candidates only ever see a generic message.

### Testing

`ensureExamPaper(attemptId)` and `getExamPaper(attemptId)` are the entry points;
`allocateDifficultyCounts` and `validateGeneratedPaper` are pure and testable on
their own, and `shuffle` accepts an injected random source so tests can be
deterministic while production uses `crypto.randomInt`.

## Candidate start

Candidates begin at `/exam/start` by entering their full name, email and mobile
number. All three are required and all three are re-validated on the server.

### Eligibility

**The mobile number is the eligibility key.** It is normalized and looked up in
the `candidates` table — the records synchronized from the Google Form. Name and
email are never used to find the candidate, and Google Sheets is never queried
at exam time; PostgreSQL is the source of truth.

An unrecognised number gets: *"Please enter the same mobile number you used in
the application form."* A malformed number gets the same message, so the
response never reveals whether a number exists. There is no endpoint that
returns candidates or accepts a mobile lookup.

Normalization is the Phase 3 helper, unchanged and shared rather than copied, so
`98765 00011`, `98765-00011`, `+91 9876500011`, `919876500011`, `09876500011`
and `(98765) 00011` all resolve to the same candidate.

### Exam open/closed

Reading the settings when the page renders is not enough — an admin can close
the exam while a candidate sits on the form. The open flag is therefore checked
again immediately before the attempt is written, and the page is
`force-dynamic` so a prerender can never keep offering a closed exam.

### Attempts

| Existing state | Result |
| --- | --- |
| No attempt | New attempt created, `in_progress` |
| `in_progress` attempt | **Resumed** — same attempt, `startedAt` untouched |
| `submitted` / `auto_submitted` | Blocked: *"You have already completed this exam."* |

`startedAt` and `status` come from schema defaults, so the browser cannot supply
either. Resuming deliberately leaves `startedAt` alone, since the timer will
later be computed from it — a candidate whose PC restarts does not get extra
time.

Two simultaneous starts cannot create two active attempts: the partial unique
index `attempts_one_in_progress_per_candidate` rejects the loser, and that
request resumes the winner's attempt rather than returning an error.

**No exam paper is generated here.** No `AttemptQuestion` rows are written;
that is a later phase.

### Name and email

The typed name and email are recorded on the attempt (`entered_name`,
`entered_email`), **not** written back to the candidate record. The Google Form
submission is the authoritative application data, so overwriting it with
whatever someone types at a test terminal would corrupt it. Keeping both lets an
admin spot a candidate who entered details that differ from their application.

### Not yet built

Paper generation, the exam interface, the timer, auto-save, answer restoration,
submission and scoring are all later phases. A successful start currently
confirms the attempt exists and says the exam screen is not available yet.

No attempt identifier is sent to the browser, and no candidate session or token
exists yet. There is nothing to protect until the exam interface is built, and
inventing a session now would mean guessing at what that phase needs.

## Exam settings

Admins configure the exam at `/admin/settings`. Both viewing and saving require
a signed-in admin and are checked on the server.

### Editable

| Setting | Default | Rules |
| --- | --- | --- |
| Exam name | `CloudUS Online Exam` | Required, trimmed, ≤120 characters |
| Duration | `75` minutes | Whole number, 1–1440 |
| Exam status | **Closed** | `open` or `closed` only |
| Difficulty mix | 40 / 40 / 20 | Whole percentages that must total 100 |

**The exam ships closed.** A fresh deployment must never admit candidates before
an admin deliberately opens it, so `false` is the database default, the seeded
value, and what the migration inserts.

### Deliberately fixed

Section names, question counts, marks per question and scored flags are **not**
admin-editable. They live in `lib/exam-settings/exam-blueprint.ts` and are shown
read-only on the settings page.

This is a deliberate decision. The paper is 55 questions worth 70 marks by
specification, and scoring and paper generation are built on those numbers. An
admin who set section 4 to 9 questions would not have configured a different
exam, they would have broken this one — and since the only value that could pass
validation is the specified one, an editable field would be a control with
exactly one legal setting. If the specification itself changes, the blueprint is
the single place to change it.

The blueprint also records that section 7 is drawn as 2 lesson groups of 3
questions, which paper generation will consume in a later phase.

### Reading settings from server code

```ts
import { getExamSettings, isExamOpen } from "@/lib/exam-settings";
```

Later phases should go through these rather than querying the table directly.
Reads are intentionally **not cached**: the open/closed flag gates candidate
access, and a stale `true` after an admin closes the exam would let candidates
in. It is a single primary-key lookup.

### Seeding

`npm run db:seed` creates the settings row **only if it is missing**. It never
overwrites an existing configuration, so re-running a seed in production cannot
reset an exam an administrator has already set up — or silently reopen it.

The row is also inserted by the migration (`ON CONFLICT DO NOTHING`), so a
migrated database always has valid settings.

### Singleton guarantee

There is exactly one configuration row, enforced in PostgreSQL rather than by
convention: the primary key is pinned by a check constraint
(`exam_settings_singleton_check`), so inserting a second row fails. A second
check constraint rejects a duration outside 1–1440 even if something bypassed
the application.

## Question bank management

Admins browse and edit the question bank at `/admin/questions`. Every page and
action requires a signed-in admin session and is checked on the server; hiding
a button is never the protection.

### List, search and filters

The list is paginated in the database (25 per page by default, with 50 and 100
available) and shows ID, section, topic, question, lesson group, difficulty,
marks, scored, status and active state.

Search matches question **ID**, **question text** or **topic**,
case-insensitively. Filters cover section, difficulty, status, active/inactive
and scored/unscored, and combine with search and pagination.

All of it lives in the URL — `/admin/questions?search=array&section=3&page=2` —
so a filtered view can be refreshed, bookmarked or shared. Unrecognised query
values (`page=abc`, `section=999`) fall back to the default rather than
erroring.

### Editing

`/admin/questions/[id]` shows the full record and allows editing every field
except the ID. **The question ID is permanent** — historical attempts and CSV
re-imports both key off it, so it is shown read-only and the server never writes
it.

Validation runs on the server and rejects the whole save if anything fails —
nothing is partially written. The rules are the same domain rules the CSV
importer applies (`lib/question-bank/question-rules.ts`): marks must fit
`Decimal(4,2)`, section 7 questions need their lesson text and group, section 8
must be unscored, and marks must agree with `scored`.

### Status vs active

These are separate concepts and both are preserved:

- `status` (`draft` / `review` / `ready`) tracks how far a question has been
  through preparation.
- `isActive` controls whether it is eligible for future exam selection.

**Deactivating never deletes.** The row, its data and every historical reference
stay exactly where they are; only the flag changes, and it can be reversed. A
confirmation step explains this before the change is applied. Phase 5 provides
no question-deletion operation at all.

### Historical safety

Editing or deactivating a question does **not** touch historical attempts. Each
drawn paper stores its own snapshot, so a submitted attempt still shows the
wording, options, correct answer and marks the candidate actually saw.

## Question bank import

Admins upload the question bank as a CSV at `/admin/questions/import`. The file
is parsed and validated, a preview is shown, and **nothing is written until the
admin confirms**.

> **The production question-bank file has not been provided yet.** The column
> list below is the *current* contract, taken from the requirements document,
> and is expected to be revised once the real spreadsheet arrives. When that
> happens, `lib/question-bank/csv-contract.ts` is the single file to update —
> column names, required/optional status, accepted enum and boolean spellings,
> numeric limits, and the cross-field rules all live there.

### Current columns

```
id, section, topic, difficulty, question, code_block,
option_a, option_b, option_c, option_d, correct, explanation,
lesson_text, lesson_group, scored, marks,
ai_verified, trainer_verified, status
```

All 19 must be present. A missing column or an unrecognised extra column is a
validation error — headers are matched exactly, so `Question` or `question_text`
will not be accepted in place of `question`.

`code_block`, `explanation`, `lesson_text` and `lesson_group` may be blank and
are stored as `NULL`. Every other column is required.

### Validation

Validation runs over the whole file before any write. If anything fails, the
import is refused in full and **no rows are written** — invalid rows are never
skipped silently.

- **Enums** — `difficulty` (easy/medium/hard), `correct` (a/b/c/d), `status`
  (draft/review/ready) and `section` (1–8) are matched case-insensitively
  against the allowed values. Unknown values are rejected, never defaulted.
- **Booleans** — `scored`, `ai_verified` and `trainer_verified` accept
  `true`/`false`, `1`/`0`, `yes`/`no`. Anything else is an error.
- **Marks** — a non-negative decimal with at most 2 decimal places and a maximum
  of 99.99, matching the `Decimal(4,2)` column. Out-of-range values are rejected
  rather than rounded.
- **Duplicate ids** — two rows sharing an `id` are rejected, naming both rows.
- **Cross-field** — section 7 questions must carry `lesson_text` and
  `lesson_group`, since papers draw whole lessons; section 8 must be unscored;
  unscored questions must have 0 marks and scored questions more than 0.

Errors are reported per row as `Row 14: correct — invalid value "E"`.

### Import behavior

`id` is the stable identifier from the CSV and is never regenerated. A row whose
id is new creates a question; an existing id updates it in place. The whole
batch runs inside one transaction, so a failure part way through rolls back and
leaves the bank untouched. Re-importing the same file is safe: it updates rather
than duplicating.

Updating a question **does not touch historical attempts**. Each drawn paper
carries its own snapshot of the question, so a submitted attempt still shows the
wording, options, correct answer and marks the candidate actually saw.

### Current limitations

- CSV only. No Excel or Google Sheets import.
- Whole-file validation: one bad row blocks the entire import by design.
- The preview table shows the first 200 rows; all rows are still imported.
- Uploads are limited to 5 MB.

## Candidate synchronization

Candidates apply through a Google Form. Their record must already exist in
CloudUS before they sit the exam, because the exam is later matched to their
application by mobile number. A Google Apps Script attached to the response
sheet posts each response to this endpoint.

**The CloudUS side of this integration is implemented. The Google Form, Google
Sheet, and Apps Script are external systems and have not been configured yet.**

### Endpoint

```http
POST /api/integrations/candidates
Authorization: Bearer <GOOGLE_APPS_SCRIPT_SECRET>
Content-Type: application/json
```

```json
{
  "google_form_response_id": "12345",
  "name": "John Doe",
  "email": "john@example.com",
  "mobile": "9876543210"
}
```

All four fields are required.

### Responses

| Status | Body | Meaning |
| --- | --- | --- |
| 201 | `{"success":true,"candidate_id":"…","created":true}` | Candidate created |
| 200 | `{"success":true,"candidate_id":"…","created":false}` | Existing candidate updated |
| 400 | `{"success":false,"errors":["…"]}` | Invalid JSON or failed validation |
| 401 | `{"success":false,"error":"Unauthorized."}` | Missing or wrong bearer secret |
| 500 | `{"success":false,"error":"…"}` | Secret not configured, or a database failure |

### Idempotency

`google_form_response_id` is the idempotency key and is unique in the database.
Re-sending the same response id updates that candidate instead of creating a
second one, so Apps Script may safely retry. The candidate id, the response id,
and any existing exam attempts are never changed by a re-sync. Simultaneous
requests for the same response id are also safe: the unique constraint rejects
the loser and the request is retried as an update.

### Normalization

- **name** — surrounding whitespace trimmed.
- **email** — trimmed and lowercased. Emails are deliberately not unique;
  several application records may share one.
- **mobile** — spaces, hyphens, brackets and dots removed, and an optional
  `+91`, `91` or leading `0` prefix dropped. The result must be a 10-digit
  Indian mobile number starting 6–9, otherwise the request is rejected rather
  than guessed at. Mobile is always stored as a string, never a number.

### Testing locally

```bash
curl -X POST http://localhost:3000/api/integrations/candidates \
  -H "Authorization: Bearer $GOOGLE_APPS_SCRIPT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"google_form_response_id":"test-1","name":"Test User","email":"test@example.com","mobile":"9876543210"}'
```

### Apps Script sketch

```javascript
function syncToCloudUS(response) {
  UrlFetchApp.fetch("https://<your-host>/api/integrations/candidates", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + PropertiesService.getScriptProperties().getProperty("CLOUDUS_SECRET") },
    payload: JSON.stringify(response),
    muteHttpExceptions: true,
  });
}
```

Keep the secret in Apps Script's Script Properties, never in the script body.

## Scripts

```bash
npm run dev          # start the development server
npm run build        # production build
npm run lint         # ESLint
npm run type-check   # TypeScript, no emit
npm run db:seed      # create/update the admin account from the environment
```

## Project structure

```
app/          routes, layout, error and loading boundaries
app/admin/    admin login and protected admin area
lib/auth/     password hashing, sessions, route guard
lib/db/       Prisma client singleton
prisma/       Prisma schema, migrations, admin seed
public/       static assets
```

## Security notes

- Admin login has **no rate limiting**. Brute-force protection is a deliberate
  gap for now; add it before the app is reachable from the public internet.
- The candidate sync endpoint has **no rate limiting** either. It is protected
  by a server-to-server bearer secret and compares it in constant time, but if
  it becomes publicly reachable it should be rate limited and ideally
  IP-restricted to Google's Apps Script ranges.
- `GOOGLE_APPS_SCRIPT_SECRET` must be a long random value in production. If it
  is unset the sync endpoint refuses every request rather than accepting
  unauthenticated writes.
- `.env` is git-ignored and must stay that way. `.env.example` holds placeholder
  names only — never real values.
- Rotate `ADMIN_PASSWORD` and the database credentials if they have ever been
  shared, then re-run the seed.

## Planned

Later phases will add the admin panel and authentication, the question bank with CSV
import, exam settings, randomized paper generation, the candidate exam experience with a
server-side timer and auto-save, resume after interruption, automatic submission and
scoring, results and CSV export, the Google Form candidate sync, and deployment through
AWS Amplify.
