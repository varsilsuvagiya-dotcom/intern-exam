# Candidate CSV import (Phase 13 backend, Phase 14 admin UI)

Imports the live candidate CSV into the existing `Candidate` table. Phase 13
built the backend (parsing, validation, matching, writes); Phase 14 added the
admin UI on top of it, reusing that server action as-is — no import logic
lives in the browser.

Field-by-field mapping and the real-sheet audit this import is built against
live in [docs/candidate-import-field-mapping.md](candidate-import-field-mapping.md);
read that first.

## Supported file format

CSV or XLSX (`.csv`, `.xlsx`). CSV is UTF-8, comma-delimited, RFC
4180-style quoting (quoted fields, commas and line breaks inside quoted
fields), read with Papa Parse. XLSX is read with the `xlsx` package, the
same one the Selected Candidates import and the question-bank importer
already use — only the first worksheet is read, matching those importers'
behavior. `.xls` (the legacy binary format) is not accepted, consistent with
the rest of the application.

Limits: 10 MB max file size, 20,000 max data rows (see `MAX_FILE_SIZE_BYTES`
/ `MAX_ROWS` in [lib/candidate-import/csv-contract.ts](../lib/candidate-import/csv-contract.ts)).
Unsupported extensions and empty files are rejected before any parsing happens.

## Required headers

Exact header text, matched two different ways:

- **Every column except the canonical email column** is matched by
  normalized header name (trimmed, lowercased, internal whitespace collapsed
  to `_`) — the same approach the existing question-bank importer uses, so
  harmless spreadsheet formatting differences (extra spaces, different case)
  don't break the match.
- **The canonical email column is matched by exact, case-sensitive text**
  (`"Email Address2"`), never through the normalizer. See
  `CANONICAL_EMAIL_HEADER` in
  [lib/candidate-import/csv-contract.ts](../lib/candidate-import/csv-contract.ts).

If the canonical email column, "Full Name", or any other non-ignored column
is missing, or an unrecognised column is present, the **whole file** is
rejected with a header-level error before any row is read — nothing is
imported partially because of a header problem.

## Ignored headers

Exactly three, matched by exact text:

- `Email address` (the older/wrong email column)
- `Column 24`
- `Column 25`

These may be present in the file and are simply skipped; they are never
required and never stored under any field.

## Canonical email header

The canonical column is `"Email Address2"`, per explicit business
confirmation (overriding an earlier Phase 12/13 finding — see below).

**Known discrepancy, not yet resolved:** the repo's own copy of the live
sheet (`untill tow 101.xlsx`, audited in Phase 12) does not have a "2" in
this header — its actual second email column reads `"Email Address"` (no
"2"), distinguished from the ignored `"Email address"` only by the
capitalization of "Address". Re-verified byte-for-byte before this change;
the file on disk is unchanged since Phase 12. Business review has confirmed
`"Email Address2"` is correct regardless, on the understanding that the
repo's copy of the sheet may not be the current live export. **If an
uploaded file's real header is `"Email Address2"`, the importer works
correctly. If a file is uploaded with the repo's current header
(`"Email Address"`, no "2"), the importer will reject it as missing the
canonical email column** — it will not silently fall back to matching
`"Email Address"` or `"Email address"`. See
[docs/candidate-import-field-mapping.md](candidate-import-field-mapping.md)
for the full audit trail.

## Field mapping reference

See the mapping table in
[docs/candidate-import-field-mapping.md](candidate-import-field-mapping.md).
One addition made while implementing the importer: the sheet's
`"Have you built any project?"` fixed-choice column (not separately named in
the original brief) is folded into `Candidate.projectInfo` as a
`"<choice>: <description>"` prefix rather than discarded, so its value is
still stored per the "every field must be stored" requirement without adding
a new database column in this phase.

## Validation rules

Every row is validated independently. A row fails, and is reported rather
than silently dropped, when:

- **Full Name** is blank or exceeds 200 characters.
- **Email** (canonical column) is blank, exceeds 320 characters, or doesn't
  match a basic email-shape pattern (`local@domain.tld`).
- **Mobile Number (WhatsApp)** is blank or fails `normalizeMobile()` (see
  below) after stripping spaces/hyphens/brackets/dots and an optional
  national prefix.
- **Timestamp** is blank or unparseable as a date.
- **Date of Birth**, when present, is unparseable as a date (blank is fine —
  it's optional).
- Any field's raw text exceeds 20,000 characters (a generous ceiling, not an
  expected length, to catch genuinely malformed data).

A header-level problem (missing/duplicate/unrecognised column) fails the
whole file. A row-level problem fails only that row — see "Partial success"
below.

## Mobile number handling

Stored as `String`, never parsed as a number (leading zeros, formatting, and
country-code digits would otherwise be lost). Normalization reuses the
existing `normalizeMobile()` from
[lib/integrations/candidate-payload.ts](../lib/integrations/candidate-payload.ts) —
the same function the Google Form sync and manual admin candidate entry
already use, so the import's idea of "valid mobile" cannot drift from
theirs.

**Bug fixed during Phase 13** (pre-existing, not introduced by this phase):
`normalizeMobile()` used to strip a leading `"91"` unconditionally as if it
were always a country-code prefix, which corrupted a genuine 10-digit number
that happens to start with 91 (e.g. `9157571942` → wrongly stripped to
`57571942`, 8 digits, rejected). Verified against the real 100-row live
sheet: 6 real candidates were wrongly failing import because of this before
the fix. The fix only strips a prefix when the raw value is *longer* than 10
digits after removing formatting — an already-valid 10-digit number is
accepted as-is. This also fixes the same bug in the Google Form sync and
manual candidate entry, since all three call the same function.

## Timestamp handling

The sheet's own `Timestamp` column is stored in `Candidate.sourceTimestamp`,
kept deliberately separate from `createdAt` (when the database row was
written, which may be long after the candidate actually submitted the form —
e.g. a bulk import run) and `updatedAt`. An unparseable timestamp fails the
row rather than falling back to the current server time or being silently
dropped.

## Matching strategy (create vs. update)

Inspected before implementing: the Google Form sync
([app/api/integrations/candidates/route.ts](../app/api/integrations/candidates/route.ts))
matches by `googleFormResponseId`; the admin "add/edit candidate" actions
([app/admin/candidates/actions.ts](../app/admin/candidates/actions.ts)) treat
a shared `email` *or* a shared `mobile` on a different row as a conflict to
flag, not a safe merge key on its own — because two real candidates can
legitimately share a household mobile number; exam start
([lib/exam/start-exam.ts](../lib/exam/start-exam.ts)) looks a candidate up by
mobile alone, and this import does not change that lookup.

Neither `email` nor `mobile` is database-unique on `Candidate` (confirmed —
index only, no `@unique`). This import therefore matches by application-level
lookup, in this priority:

1. **Existing candidate by normalized email** (case-insensitive, trimmed).
2. Else, **existing candidate by normalized mobile**.
3. Else, **create a new candidate**.

If email matches one existing candidate and mobile matches a *different*
existing candidate, that's a genuine identity conflict — see below — and the
row is not imported automatically. If email and mobile match more than one
existing candidate each (a pre-existing duplicate in the database), that's
also reported as a conflict rather than guessed at.

Implementation: [lib/candidate-import/match-candidate.ts](../lib/candidate-import/match-candidate.ts)
(pure decision logic, unit tested) wired up by
[lib/candidate-import/import-candidates.ts](../lib/candidate-import/import-candidates.ts)
(the actual database lookups/writes).

## Create/update behavior

- **New candidate:** all mapped fields from the row are written. Only
  `Candidate` is created — never `CandidateExam`, `Attempt`, or
  `ExamSession`.
- **Existing candidate (matched):** every field the row carries a real value
  for is updated. **A blank CSV cell never overwrites an existing database
  value** — the field is simply omitted from the update, so an incomplete
  live export can never erase data a previous, more complete import already
  stored. `name`, `email`, and `mobile` are always written on a matched row
  since those three columns are required and therefore never blank on a
  validated row.

## Conflict handling

Detected, not silently resolved. Example: row's email matches candidate #A,
row's mobile matches a different candidate #B — the row is marked failed with
an "identity conflict" error naming both, and **neither candidate is
touched**. Likewise a duplicate match (email or mobile hitting more than one
existing row) is reported rather than picking one arbitrarily.

## Partial success

Header problems fail the entire file (nothing is trustworthy past a bad
header). Row problems are independent: a 100-row file with 9 bad rows
imports the other 91 and reports the 9 individually — no row's failure rolls
back another row's success. Each candidate is written inside its own
database transaction (see `importRow` in import-candidates.ts), never one
transaction spanning the whole file, so a single candidate is also never left
half-written.

## Idempotency

Importing the identical file twice does not create duplicate candidates: the
second run matches every row to the candidate the first run created (by
email, falling back to mobile) and updates it instead. Verified against the
real 100-row live sheet: first import created 91 (9 then-failing on the
pre-fix mobile bug), second import created 0 and updated all 91;
after the mobile-normalization fix, a subsequent import created the
6 previously-blocked candidates and updated the rest, with only the 2
genuinely-invalid-email rows and 1 genuinely-invalid-mobile row still
failing.

## Error / result structure

```ts
{
  totalRows: number;   // rows in the file (successful + failed)
  created: number;
  updated: number;
  failed: number;      // includes both validation failures and conflicts
  conflicts: number;   // the subset of `failed` that were identity conflicts
  errors: {
    row: number;        // 1-based, header is row 1
    field: string;
    name?: string;      // the row's Full Name, if it had one
    email?: string;      // the row's raw email value, if it had one
    message: string;
  }[];
}
```

No raw database errors or connection details are ever returned — a database
failure on a row is logged server-side (name/message only, never the
connection string) and surfaced to the caller as a generic
"could not be saved" error for that row.

## Authorization

`requireAdmin()` — the same session-based admin check every other admin
server action in this codebase uses
([lib/auth/require-admin.ts](../lib/auth/require-admin.ts)). No second auth
mechanism was introduced. The import server action
([app/admin/candidates/import-actions.ts](../app/admin/candidates/import-actions.ts))
calls it before touching the uploaded file; an unauthenticated request is
redirected to `/admin/login` and never reaches the parser or the database.

## What this import does NOT do

- Does not create `CandidateExam` rows. Importing the live sheet means a
  candidate *exists*; it says nothing about which exam, if any, they're
  eligible for. Verified against the real database: `candidate_exams` stayed
  at 0 rows across two full real-sheet import runs.
- Does not touch `Attempt`, `ExamSession`, or `Answer` in any way. Verified:
  row counts for all three were identical before and after the real-sheet
  import runs.
- Does not change exam-start's mobile-based eligibility lookup
  (lib/exam/start-exam.ts) or any other existing exam-flow code.
- Does not add a database unique constraint on `email` (Phase 12 deliberately
  deferred that pending exactly this kind of real-data audit; the audit is
  now done — see the field-mapping doc — but adding the constraint is a
  schema change out of scope for this phase).
- Does not show `CandidateExam`/eligibility status anywhere in the admin UI's
  import result. "Selected", "Eligible" and similar belong to the future
  Selected Candidates workflow, not this import.

## Admin UI (Phase 14)

**Where:** `/admin/candidates`, an "Import CSV" button next to "Add
candidate" in the page toolbar
([app/admin/candidates/candidate-editor.tsx](../app/admin/candidates/candidate-editor.tsx)).
Opens `ImportCandidatesDialog`
([app/admin/candidates/import-dialog.tsx](../app/admin/candidates/import-dialog.tsx)),
a modal built on a small reusable `Dialog` primitive
([components/ui/dialog.tsx](../components/ui/dialog.tsx)) — the first true
modal in this codebase; every other admin disclosure (e.g. the candidate
add/edit form) is an inline panel, but an import's own multi-stage result
isn't tied to a specific table row the way those are.

**What it does, and doesn't, own:** the dialog uploads the selected file via
`FormData` to the existing `importCandidatesFromCsv` server action
([app/admin/candidates/import-actions.ts](../app/admin/candidates/import-actions.ts))
and renders whatever that action returns. It performs exactly two checks of
its own before submitting — file extension is `.csv` or `.xlsx`, and the
file isn't empty/oversized — both purely to save a doomed round trip; every real
validation (headers, email mapping, row rules, matching, conflicts) happens
server-side and is rendered here, never re-implemented. The dialog has no
email-handling code of its own: the canonical `"Email Address2"` /
`"Email address"` distinction is entirely backend logic, unchanged by this
phase (regression-tested at both layers — the mapping itself in
[lib/candidate-import/parse-candidates.test.ts](../lib/candidate-import/parse-candidates.test.ts),
and that the UI passes the file through unmodified in
[app/admin/candidates/import-dialog.test.tsx](../app/admin/candidates/import-dialog.test.tsx)).

**Supported file format:** CSV or XLSX, same as the backend — the file
input's `accept=".csv,.xlsx"` keeps a browser's native picker from offering
anything else, and a bypass (e.g. drag-and-drop) is still caught by an
explicit extension check with a clear message ("Please select a CSV or
Excel (.xlsx) file.").

**Validation display:**
- A header-level rejection (missing `"Email Address2"`, an unrecognised
  column, a duplicate column) renders as "File validation failed" with the
  backend's own message for each problem — never raw JSON, never a stack
  trace.
- Missing `"Email Address2"` specifically renders exactly what the backend
  reports: `Missing required column: "Email Address2" (the canonical
  candidate email).` The dialog does not add fallback wording suggesting
  `"Email address"` would work instead, because it wouldn't.

**Create/update, partial success, conflicts:** the result view reads the
backend's `{ totalRows, created, updated, failed, conflicts, errors }`
directly:
- All rows succeeded → a success banner ("Candidate import complete") plus
  the count grid.
- Some rows failed, at least one succeeded → a warning banner ("Import
  completed with some errors"), explicitly not worded as a failure, since
  valid rows already imported.
- Every row failed → a danger banner ("No candidates were imported").
- Errors whose `field` is `"identity"` (the backend's marker for a row that
  matched two different existing candidates — see
  [lib/candidate-import/import-candidates.ts](../lib/candidate-import/import-candidates.ts))
  render in their own "N identity conflict(s)" section with a note that
  nothing was merged, separate from the ordinary failed-rows table.

**Loading and double-submission:** while the action is pending, the Import
button shows a spinner with "Importing candidates…", the file input is
disabled, and the dialog cannot be closed (Escape, the backdrop, and the
close button are all disabled) — so an admin can't lose track of an import
mid-flight or fire a second one by double-clicking.

**Candidate list refresh:** the server action already calls
`revalidatePath("/admin/candidates")` on success (Phase 13); the dialog adds
nothing extra here — newly created/updated candidates appear in the table
behind the dialog without a page reload.

**Authorization:** unchanged from Phase 13 — `requireAdmin()` in the server
action is the actual boundary. The "Import CSV" button being visible only to
a signed-in admin is a UX nicety, not the security control.

## Example result

### A file with the correct `"Email Address2"` header

```json
{
  "totalRows": 100,
  "created": 6,
  "updated": 91,
  "failed": 3,
  "conflicts": 0,
  "errors": [
    {
      "row": 2,
      "field": "mobile_number_(whatsapp)",
      "name": "kishan godhani",
      "email": "kishan.godhani@cloudusinfotech.com",
      "message": "Invalid mobile number: \"99240901\"."
    },
    {
      "row": 5,
      "field": "email",
      "name": "Mule Harshada Mukeshbhai",
      "email": "Harsh",
      "message": "Invalid email format: \"Harsh\"."
    },
    {
      "row": 78,
      "field": "email",
      "name": "Bhoi Hetal Prabhakar Bhai",
      "email": "A-11 , shiv aavas Society kamrej",
      "message": "Invalid email format: \"A-11 , shiv aavas Society kamrej\"."
    }
  ]
}
```

This was the actual result of importing the repo's 100-row live sheet after
the `normalizeMobile()` fix, from when that sheet's canonical header still
matched what the importer expected at the time.

### The repo's current sheet, against today's `"Email Address2"` requirement

After the header requirement changed to `"Email Address2"` per explicit
business confirmation, re-running the importer against the same file
(unchanged on disk, header still reads `"Email Address"`, no "2") now
correctly refuses it rather than guessing:

```json
{
  "ok": false,
  "errors": [
    {
      "row": 1,
      "field": "email_address",
      "message": "Unrecognised column \"Email Address\". Every non-ignored column must be mapped — update the field mapping or remove this column."
    },
    {
      "row": 1,
      "field": "email",
      "message": "Missing required column: \"Email Address2\" (the canonical candidate email)."
    }
  ]
}
```

Nothing is written to the database on this outcome. Whoever uploads the next
live-sheet export must confirm its second email column is actually named
`"Email Address2"` before this import will accept it.
