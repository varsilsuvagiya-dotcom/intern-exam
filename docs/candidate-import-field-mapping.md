# Candidate import field mapping

Maps the live candidate sheet's columns to `Candidate` (Prisma schema:
[prisma/schema.prisma](../prisma/schema.prisma)) for the Phase 13 CSV import.
Written during Phase 12 (schema-only); Phase 13 implements the importer
against this exact mapping.

Verified against the actual live sheet (`untill tow 101.xlsx`, sheet "Form
responses 1", 100 data rows, 27 columns) — headers and value samples below
are read from that file, not assumed from the brief.

## Canonical email

**Current instruction (overrides the finding below): the canonical column is
`"Email Address2"`.** This was explicitly confirmed during Phase 13 review as
a correction to the finding this section originally recorded, on the
understanding that the sheet in this repo may not be the current live
export. The importer ([lib/candidate-import/csv-contract.ts](../lib/candidate-import/csv-contract.ts))
requires a column named exactly `"Email Address2"` and will reject a file
that doesn't have one — it will not fall back to `"Email Address"` or
`"Email address"`.

**Original Phase 12 finding, kept for the record:** the sheet in this repo
(`untill tow 101.xlsx`) has two email columns whose real headers are
**identical except for capitalization**, and neither has a "2":

- Column B: `"Email address"` (lowercase "address") — ignored either way.
- Column E: `"Email Address"` (capital "Address", **no "2"**).

Re-verified byte-for-byte during the Phase 13 review that raised this
discrepancy; the file on disk is unchanged since Phase 12 and still reads
`"Email Address"`, not `"Email Address2"`. Whoever provides the next live
export must confirm its second email column is actually named
`"Email Address2"` — otherwise the import will correctly refuse the file
(see [docs/candidate-csv-import.md](candidate-csv-import.md) for the exact
rejection message) rather than guessing which column to use.

## Mapping table

| Spreadsheet Header (actual) | DB Field | Stored? | Type | Notes |
|---|---|---|---|---|
| Timestamp | `sourceTimestamp` | YES | `DateTime?` | Format seen: `"7/30/2026 17:53:40"` (M/D/YYYY H:mm:ss). Distinct from `createdAt` (when the DB row was written). |
| Email address | — | **NO** | — | Explicitly ignored; use "Email Address2" instead (see "Canonical email" above for the discrepancy with this repo's copy of the sheet). |
| Full Name | `name` | YES (existing) | `String` | Reuse existing field. Seen with trailing whitespace in some rows (e.g. `"Sujan kakadiya "`) — Phase 13 should trim. |
| Mobile Number (WhatsApp) | `mobile` | YES (existing) | `String` | Reuse existing field. Seen: clean 10-digit, an 8-digit value (`"99240901"`), and a spaced 11-digit value (`"92654 94030 "`). Existing `normalizeMobile()` in [lib/integrations/candidate-payload.ts](../lib/integrations/candidate-payload.ts) already strips formatting/prefixes and rejects anything that isn't a valid 10-digit Indian number — Phase 13 should reuse it and decide skip-vs-flag for rows it rejects (e.g. the 8-digit one). |
| Email Address2 | `email` | YES (existing) | `String` | **Canonical candidate email.** Reuse existing field. This repo's copy of the sheet currently has this column named "Email Address" (no "2") — see "Canonical email" above. |
| Current City | `currentCity` | YES | `String?` | |
| Are you willing to work full-time from our Surat office? | `willingFullTimeSurat` | YES | `String?` | Actual values seen: only `"Yes"` / `"No"` — clean enough to be `Boolean`, but kept as free text per the brief's instruction to not assume boolean-safety from the column title alone, and for consistency with the two agreement columns below, whose values are not boolean-shaped. |
| Date of Birth | `dateOfBirth` | YES | `DateTime? @db.Date` | Format seen: `"4/30/94"`, `"5/23/05"` (M/D/YY). Phase 13 must handle unparseable values by leaving this null rather than failing the row. |
| Highest Qualification | `highestQualification` | YES | `String?` | Seen: `"B.E. / B.Tech"`. |
| College / Institute Name | `collegeName` | YES | `String?` | |
| Year of Passing / Expected Passing | `yearOfPassing` | YES | `String?` | Confirmed text, not `Int` — real values include `"2026-27"`, `"May-2026"`, `"March 2026"` alongside plain years. |
| CGPA or Percentage | `cgpaOrPercentage` | YES | `String?` | Confirmed text, not numeric — real values include plain numbers with no unit (`"9"`, `"64"`) mixed with decimals (`"8.73"`); no way to reliably tell CGPA from percentage by value alone. |
| Which technologies have you worked with? | `technologies` | YES | `String? @db.Text` | Comma-separated free text, e.g. `"JavaScript, React / Next.js, Python, ..."`. |
| Have you built any project? | *(folded into `projectInfo`, see below)* | — | — | Values seen: `"Yes — college project"`, `"Yes — both"`, `"Yes — personal project"`, `"No"`. Not a separate DB column — see decision note below. |
| Describe your best project in your own words. | `projectInfo` | YES | `String? @db.Text` | |
| GitHub profile link | `githubUrl` | YES | `String?` | |
| LinkedIn profile link | `linkedinUrl` | YES | `String?` | |
| Any live project link | `liveProjectUrl` | YES | `String?` | |
| Tell us about one thing you learned on your own, outside college. How did you learn it? | `selfLearningInfo` | YES | `String? @db.Text` | |
| Which AI tools have you used? | `aiToolsInfo` | YES | `String? @db.Text` | Comma-separated free text, e.g. `"ChatGPT, Claude, Cursor, GitHub Copilot"`. |
| Why do you want to join this training program? | `reasonForJoining` | YES | `String? @db.Text` | |
| Paste a link to your resume (Google Drive / PDF link) | `resumeUrl` | YES | `String?` | Confirmed not a strict URL — real values include valid Drive links but also garbage (`"ryeye5ye5ye5y"`, `"Yes"`). Kept as plain `String`, no format validation at the DB level. |
| I have read and understood all the above terms, and I agree to them. | `termsAgreement` | YES | `String?` | Only value seen across all 100 rows: `"I agree"`. |
| I confirm that all information provided in this form is true and correct. | `informationConfirmation` | YES | `String?` | Only value seen: `"I confirm"`. |
| Where did you hear about this training program? | `hearAboutProgram` | YES | `String?` | |
| Column 24 | — | **NO** | — | Confirmed empty in all 100 rows. Explicitly ignored. |
| Column 25 | — | **NO** | — | Confirmed empty in all 100 rows. Explicitly ignored. |

### "Have you built any project?" — folding decision

The brief's field list (§4) does not name this column separately; it groups
"Project-related information" as one item. The real sheet has it as two
columns: a fixed-choice "Have you built any project?" and a free-text
"Describe your best project...". No separate DB column was added for the
fixed-choice one — needs a decision before Phase 13 (see "Needs approval"
below): fold its value into `projectInfo` as a prefix, or add a dedicated
`hasBuiltProject` column.

## Email: required / unique / normalization (documented, not yet enforced)

- `Candidate.email` is **not** database-unique today (index only) — confirmed
  by reading the schema and [lib/admin/candidates/actions.ts](../app/admin/candidates/actions.ts),
  which does an app-level `findFirst` conflict check instead of relying on a
  DB constraint, specifically because two real candidates can legitimately
  share a household mobile number and the Google Form sync has always allowed
  duplicates through.
- **Audited against the real 100-row sheet's column E** (named `"Email
  Address"` in this repo's copy, treated as the stand-in for whatever a real
  `"Email Address2"` column will contain):
  - Blank/null values: **0**.
  - Duplicate values (case/whitespace-insensitive): **0**.
  - Values with leading/trailing whitespace: **3**.
  - Values with uppercase characters: **3** (e.g. `"Kavanirali09@gmail.com"`).
  - Values that don't look like an email at all: **2** — row 5 contains
    `"Harsh"` (a name), row 78 contains a physical address
    (`"A-11 , shiv aavas Society kamrej "`). Both are handled by Phase 13's
    importer as bad-data rows (skip + report), not silently imported as an
    email.
- Phase 12 does **not** add a unique constraint on `email`. Even with zero
  duplicates in this snapshot, a hard constraint risks breaking a future
  import run on a differently-messy sheet; the constraint can be added later
  once Phase 13's import path enforces normalization up front.
- Intended behavior for Phase 13 (not implemented here):
  - Normalize by trimming whitespace and lower-casing before matching
    (`"TEST@EMAIL.COM"` and `"test@email.com"` are the same candidate).
  - Reject/flag rows whose "Email Address2" value fails a basic email-shape
    check (2 such rows exist in this repo's copy of the sheet) rather than
    importing garbage as an email.
  - Match/upsert candidates by normalized email during CSV import, the same
    way `google_form_response_id` is used today for the Apps Script sync.

## Candidate identification today (unchanged by Phase 12)

Exam start ([lib/exam/start-exam.ts](../lib/exam/start-exam.ts)) looks up the
candidate by **mobile**, not email — this is existing behavior and Phase 12
does not touch it. Email is the intended import-matching key for Phase 13;
the two are separate concerns.

## Eligibility (out of scope for the mapping above)

Selection/eligibility for a specific exam is **not** a `Candidate` field. It
is recorded in the new `CandidateExam` join table — see the Phase 12
implementation report for the schema and reasoning.
