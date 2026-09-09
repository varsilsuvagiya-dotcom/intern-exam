# CloudUS Admin Panel Design Plan

**Status:** Planning only. No application code, CSS, schema, dependency or route was changed to produce this document.
**Scope:** Admin Panel only. The candidate-facing exam UI is explicitly out of scope (see §37).
**Date:** 2026-09-09
**Basis:** Repository inspection at Phase 15 completion + `exam-app-requirements.md`.

---

## 1. Design Goals

CloudUS is an internal hiring instrument. Three or four supervisors run a room of candidates; one or two admins prepare the question bank, watch attempts, and read results to make shortlisting decisions. The admin panel is a **working tool used under time pressure on office desktops**, not a product being sold.

That drives five goals:

1. **Trustworthy at a glance.** A score decides whether a person gets hired. The UI must never make a score ambiguous, never imply a number exists when it does not, and never let "unanswered" read as "wrong".
2. **Scannable density.** The Attempts and Question Bank tables are the pages admins live in. Optimize for reading many rows quickly, not for whitespace — while remaining fully usable on a phone (§20).
3. **One visual language.** Today every page re-declares its own `FIELD` and `CELL` class strings. The redesign's core job is a single system so pages stop drifting.
4. **Honest states.** Loading, empty, error and not-found are designed, not accidents.
5. **Zero invention.** The requirements deliberately exclude analytics; the design must not smuggle it back in as "dashboard cards".

### Explicit non-goals

- Not a marketing surface. No hero sections, gradients, illustrations, or animated numbers.
- Not a general SaaS dashboard. No charts, trends, or KPI tiles that the data cannot support.
- Not a consumer mobile app in styling or personality — but it **is** fully responsive. The original "office PCs only" constraint has been lifted by project decision: every page must work on phone, tablet, laptop and desktop, with no functionality dropped at any width (see §20).

---

## 2. Current UI Audit

### 2.1 What exists

Actual admin routes found in `app/`:

| Route | File | Type |
|---|---|---|
| `/admin` | `app/admin/page.tsx` | Dashboard (link hub) |
| `/admin/login` | `app/admin/login/page.tsx` + `login-form.tsx` | Auth |
| `/admin/questions` | `app/admin/questions/page.tsx` | List + filters |
| `/admin/questions/import` | `app/admin/questions/import/page.tsx` + `import-form.tsx` | Wizard |
| `/admin/questions/[id]` | `app/admin/questions/[id]/page.tsx` + `question-editor.tsx` + `not-found.tsx` | Editor |
| `/admin/candidates` | `app/admin/candidates/page.tsx` | List + search |
| `/admin/attempts` | `app/admin/attempts/page.tsx` | List + filters + export |
| `/admin/attempts/[id]` | `app/admin/attempts/[id]/page.tsx` | Individual result |
| `/admin/settings` | `app/admin/settings/page.tsx` + `settings-form.tsx` | Settings |
| `/admin/attempts/export` | `route.ts` | CSV (no UI) |
| `/admin/attempts/[id]/export` | `route.ts` | CSV (no UI) |

### 2.2 Structural findings

- **There is no `components/` directory.** Every page inlines its own markup.
- **There is no `app/admin/layout.tsx`.** No shell, no persistent navigation. `/admin` is the only hub, and every page links back to it with a bare `Admin home` text link.
- **There are no `loading.tsx` or `error.tsx` files anywhere under `app/admin`.** Only `app/loading.tsx`, `app/error.tsx`, `app/not-found.tsx` at the root, plus `app/admin/questions/[id]/not-found.tsx`.
- **`globals.css` is the untouched Next.js starter**: two variables (`--background`, `--foreground`), a `prefers-color-scheme` dark block, Geist fonts. No design tokens exist.
- **No icon library, no UI primitive library** (`lucide`, `radix`, `clsx`, `cva`, `tailwind-merge` — none installed).

### 2.3 Specific problems, page by page

**Global / shell**

1. *No persistent navigation.* Reaching Candidates from Settings requires going through `/admin`. Every page pays a two-click tax on every lateral move.
2. *Class-string duplication.* `FIELD` is re-declared in `login-form.tsx`, `settings-form.tsx`, `question-editor.tsx`, `attempts/page.tsx`, `candidates/page.tsx`; `CELL` in `questions/page.tsx`, `settings/page.tsx`, `import-form.tsx`, `candidates/page.tsx`, `attempts/page.tsx`. They have already drifted (`px-2 py-1.5` vs `px-3 py-2`).
3. *Colors are ad-hoc opacity stacks.* `black/5`, `black/10`, `black/15`, `black/30`, `black/40`, `black/50`, `black/60`, `black/70` appear across files with no semantic meaning. `black/50` vs `black/60` for the same "muted label" role is decided per-file.
4. *Dark mode is half-built.* Every component carries `dark:` variants, but no one has designed the dark palette — it is mechanical inversion inherited from the starter. It doubles the surface area of every future change for a mode nobody asked for.
5. *Primary buttons are `bg-black`.* This reads as unstyled default rather than a brand.

**Login**

6. Page is a bare `max-w-sm` column on an empty white field. No card, no visual anchor, no product identity. It does not communicate "this is a real system" at the moment of first contact.
7. Error text is a bare red line with no icon or container — easy to miss.

**Dashboard (`/admin`)**

8. It is a centered row of five bordered links plus a logout button. It conveys **nothing** about system state — an admin cannot tell whether the exam is open, whether the bank has enough questions, or whether anything is awaiting attention.
9. Logout sits inside the main content column as a peer of the navigation links, giving a destructive-ish action the same weight as navigation.

**Question Bank**

10. *Eleven columns of near-identical weight.* ID, Sec, Topic, Question, Lesson, Difficulty, Marks, Scored, Status, Active, and the action link all render at `text-sm` in the same color. The eye has no entry point.
11. *Status is doubled and unclear.* `status` (draft/review/ready) and `isActive` are separate columns rendering plain lowercase text; only inactive rows get a dim treatment. Two different state axes look like one.
12. *Question text truncates with `max-w-sm truncate`* and exposes the full text only via the native `title` tooltip — slow, unstyled, and invisible on keyboard focus.
13. *The filter row is seven controls in a raw grid* with no visual container separating it from the results.

**Question Import**

14. The workflow (upload → preview → confirm → result) is real and correct, but every stage renders as the same undifferentiated bordered `CARD`. There is no sense of progress through a multi-step flow.
15. *The file input is the browser default* (`file:` pseudo-element styling only). No drop zone, no stated accepted format, no size guidance.
16. Errors render as a flat `<ul>` of `row N — field — message`. With many errors this becomes an unreadable wall.

**Question Editor**

17. *Everything is one flat `space-y-4` stack.* Basic info, question, options, explanation, Section 7 lesson fields, scoring and verification flags all sit at the same level with no grouping.
18. *Section 7 fields (`lessonText`, `lessonGroup`) are always visible* even for sections that cannot use them — implying they apply everywhere.
19. *The read-only ID field uses `opacity-60`*, which reads as "disabled, might be enabled later" rather than "immutable by design".
20. The activate/deactivate control lives in a separate bordered block below the form with its own buttons — correct separation, but visually identical to the form, so the destructive-ish action does not read as different in kind.

**Candidates**

21. Name, email and mobile all render at identical weight, so candidate identity has no anchor.
22. `registeredAt` and `updatedAt` are shown as raw `2026-09-01 10:00` slices, side by side, with no indication of which matters.
23. *Duplicate mobiles are invisible.* The requirements call this out as "the only real weak point" and ask for the admin list to flag mismatches; the current list gives no signal at all.

**Attempts**

24. *Score has no visual priority.* `52.50 / 70.00` renders in the same `text-sm` as the mobile number. This is the single most decision-relevant value on the page.
25. *Status is plain text* ("In Progress", "Submitted", "Auto Submitted") in the same weight as everything else. "Scoring pending" and "Not finalized" appear in the score column as muted text — three different state concepts (attempt status, scoring status, score value) occupying two columns with no consistent encoding.
26. Timestamps are raw ISO-ish slices; comparing "started" and "submitted" to judge time taken is manual arithmetic.
27. The export button was appended below the filter form as a bare `<a>` in a paragraph — functional, visually unplaced.

**Individual Result**

28. This page is the closest to right: real card sections, a large total, colored option rows, correct lesson grouping. Its problems are refinement, not structure.
29. *Section 7 is not distinguished* despite the requirements naming it "our key hiring signal". It renders exactly like Sections 1–6.
30. *55 question cards in one flat scroll* with no section navigation and no way to jump or filter to just the wrong answers.
31. The state badge colors (`bg-green-600/10`, `bg-red-600/10`, `bg-amber-500/10`) are the only real color in the admin panel and were chosen locally — they should become the system's status palette rather than page-local values.

**Settings**

32. *The editable form and the fixed blueprint table look identical* — both are plain sections with the same table/field styling. The blueprint is enforced in code (`exam-blueprint.ts`) and can never be edited, but the page does not make that categorical difference visible beyond one sentence of prose.
33. The open/closed toggle is a `<select>` with two options, giving the single most consequential setting in the product no more weight than a text field.

### 2.4 What to preserve

- The **server-rendered, URL-driven filter model** (`?q=&status=&scoring=&sort=&page=`). It is shareable, refreshable and already hardened. Do not replace with client state.
- The **GET filter form** pattern. It works without JS and lands on page 1.
- The **result page's information architecture**: candidate → attempt → score → breakdown → review.
- The **snapshot-based rendering** and the `not-finalized` / `pending` / `scored` distinction in `AttemptScoring`. The design must express these three states, never collapse them.
- All existing **server-side validation, allowlists and `requireAdmin()` calls**. Design changes must not touch these.

---

## 3. CloudUS Visual Direction

### Brand personality

**Quiet, technical, institutional.** CloudUS decides whether someone is hired. The interface should feel like a well-maintained internal system of record — closer to a clinical or financial back-office tool than to a startup dashboard.

Chosen adjectives, and why:

- **Precise** — the product's core output is a decimal score out of 70. Typography and alignment should make numbers easy to compare.
- **Calm** — supervisors use this while a room of candidates is mid-exam. The UI must not compete for attention. Color is reserved for state, never decoration.
- **Sturdy** — borders and structure over shadows and float. Tables that look like records, not like cards pretending to be records.

Explicitly *not*: playful, dense-with-personality, animated, or "delightful".

### Visual philosophy

1. **Clarity over decoration.** If an element does not help an admin read state or take action, it does not ship.
2. **Color carries meaning only.** The interface is achromatic except for one brand accent and the status palette. When something is green, it means something.
3. **Hierarchy through weight and size, not boxes.** Prefer typographic hierarchy to nesting more cards.
4. **Density is a feature.** Admins scan many rows. Compact rows with clear rhythm beat airy rows requiring scrolling.
5. **States are designed.** Loading, empty and error are first-class specifications.
6. **Motion is functional.** Transitions confirm interaction; nothing animates for its own sake.
7. **Never imply data that is not there.** A missing score renders as an explicit state label, never `0.00` and never a blank cell.

---

## 4. Design Principles

Concrete rules the implementation must follow:

- **P1.** Every color, size, radius and spacing value comes from a token (§35). No arbitrary Tailwind values in page files.
- **P2.** One table style, one form field style, one button hierarchy across all nine admin pages.
- **P3.** Status is always badge + text label. Never color alone (accessibility), never bare lowercase enum values.
- **P4.** A score is displayed only when `scoredAt` is set. Otherwise the slot shows the state.
- **P5.** Any value that can be truncated must be inspectable — never a `title` attribute alone.
- **P6.** Read-only-by-design fields look categorically different from disabled fields.
- **P7.** No page introduces a component that only it uses, unless it is genuinely page-specific (§23).
- **P8.** Section 7 receives explicit visual emphasis on the result page (requirements §Screen C).

---

## 5. Typography System

Single family: **Geist Sans** (already loaded in `app/layout.tsx`, self-hosted via `next/font` — no new dependency). **Geist Mono** for code blocks, IDs and tabular numbers (also already loaded).

Fallbacks: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`.

| Token | Size / Line height | Weight | Usage |
|---|---|---|---|
| `display` | 24px / 32px | 600 | Page title only (`Attempts`, `Question bank`) |
| `title` | 20px / 28px | 600 | Result total heading, login card title |
| `heading` | 16px / 24px | 600 | Section headings within a page (`Exam structure`, `Question review`) |
| `subheading` | 14px / 20px | 600 | Card headings (`Candidate`, `Attempt`, `Score`) |
| `body` | 14px / 20px | 400 | Default text, table cells, form values |
| `body-strong` | 14px / 20px | 500 | Emphasized cell (candidate name), active nav |
| `secondary` | 13px / 18px | 400 | Page description, supporting cell text |
| `label` | 13px / 16px | 500 | Form labels, table headers |
| `helper` | 12px / 16px | 400 | Field help text, "entered: …" annotations |
| `badge` | 12px / 16px | 500 | Status badges |
| `mono` | 13px / 20px | 400 | Question IDs, attempt IDs, code blocks |
| `score-lg` | 32px / 36px | 600, tabular | Result page total score |
| `score-sm` | 14px / 20px | 600, tabular | Attempts table score cell |

Rules:

- Only **three weights**: 400, 500, 600. No 700+, no italics.
- **Never below 12px.**
- All numeric columns use `font-variant-numeric: tabular-nums` so decimals align vertically.
- Page title is the only `display` on a page. One `<h1>` per page.

---

## 6. Color System

### Mode decision: **light mode only.**

The current code carries `dark:` variants everywhere, inherited from the Next.js starter. Recommendation: **remove dark mode from the admin panel.**

Rationale: it was never designed (it is mechanical inversion), it doubles the review surface of every page, the requirements never ask for it, and the usage context is a fixed office desktop under constant lighting. The status colors in particular need different values in dark mode to stay accessible, and nobody has specified them. Shipping a half-considered dark mode is worse than shipping none.

*If the user wants dark mode, it should be its own phase with its own palette — not carried along implicitly.* Flagged in §19 as a decision needing approval.

### Palette

Neutral ramp (slate-leaning grey — slightly cool, reads as institutional rather than warm):

| Token | Value | Purpose | Contrast |
|---|---|---|---|
| `bg.page` | `#F7F8FA` | App background behind cards | — |
| `bg.surface` | `#FFFFFF` | Cards, table surface, sidebar | — |
| `bg.raised` | `#FFFFFF` + `shadow.sm` | Modals, dropdowns | — |
| `bg.subtle` | `#F1F3F6` | Table header, hover rows, code blocks | — |
| `bg.inset` | `#EDEFF3` | Disabled inputs, read-only fields | — |
| `border.default` | `#E3E6EB` | Card borders, table row dividers | — |
| `border.strong` | `#CDD2DA` | Input borders, table outer border | 3:1 vs surface ✓ |
| `border.focus` | `#1F5FBF` | Focus ring | 3:1 ✓ |
| `text.primary` | `#14181F` | Headings, table primary text | 16.1:1 on surface ✓ |
| `text.secondary` | `#4A5261` | Supporting text, labels | 8.3:1 ✓ |
| `text.muted` | `#6B7383` | Helper text, timestamps, placeholders | 5.2:1 ✓ (AA normal text) |
| `text.disabled` | `#9AA1AE` | Disabled control text | 2.9:1 — decorative only, never sole carrier |
| `text.inverse` | `#FFFFFF` | On primary/destructive fills | ✓ |

Brand accent — a deep, desaturated blue. Institutional, unmistakably not "default black", and distinct from every status color:

| Token | Value | Purpose |
|---|---|---|
| `primary.base` | `#1F5FBF` | Primary buttons, active nav, links | 5.4:1 on white ✓ |
| `primary.hover` | `#1A4FA0` | Hover |
| `primary.active` | `#163F81` | Pressed |
| `primary.subtle` | `#EDF3FC` | Active nav background, selected row |
| `primary.border` | `#C3D6F2` | Border on subtle surfaces |

Status palette. Each has a `fg` (text/icon, AA on its own `bg`) and a `bg` (badge fill):

| Token | fg | bg | Meaning in CloudUS |
|---|---|---|---|
| `success` | `#166534` | `#E8F5EC` | Correct answer, Ready, import succeeded, Exam Open |
| `warning` | `#8A5300` | `#FDF3E2` | Unanswered, Scoring Pending, import warnings, destructive confirm |
| `danger` | `#A81E1E` | `#FDECEC` | Wrong answer, validation error, failed action |
| `info` | `#1A4FA0` | `#EDF3FC` | In Progress, informational notes |
| `neutral` | `#4A5261` | `#F1F3F6` | Unscored (Section 8), Inactive, Draft, Closed |

Notes:

- **Exam Closed uses `neutral`, not `danger`.** Closed is the safe default state, not an error.
- **Section 8 "Unscored" uses `neutral`**, never green/red — it must not imply correctness (requirements: attitude answers carry no score).
- Every status badge pairs color with a **text label**, satisfying "do not rely on color alone".

---

## 7. Spacing System

4px base scale: `0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.

| Token | Value | Applied to |
|---|---|---|
| `space.1` | 4px | Icon-to-label gap, badge padding-y |
| `space.2` | 8px | Label-to-input, inline button gaps |
| `space.3` | 12px | Table cell padding-x, badge padding-x |
| `space.4` | 16px | Card padding (compact), form field vertical rhythm |
| `space.5` | 20px | Card padding (default) |
| `space.6` | 24px | Page padding-x, gap between filter controls |
| `space.8` | 32px | Gap between page sections |
| `space.10` | 40px | Page padding-y (top of content area) |
| `space.12` | 48px | Gap between major result-page blocks |

Rules:

- **Page content:** `padding: space.10 space.6`, `max-width: 1280px` for tables, `720px` for single-column forms (Settings, Login card), `960px` for the result page.
- **Table cells:** `padding: space.3` horizontally, `10px` vertically for the default density.
- **Form fields:** `space.4` between fields, `space.2` between label and control, `space.1` between control and helper/error text.
- **Cards:** `space.5` padding; `space.4` when nested (e.g. a question card inside a section).
- **Never use a value outside the scale.** No `py-1.5`, no `mt-7`.

---

## 8. Border / Radius / Shadow System

**Radius** — restrained. This is a records system, not a consumer app.

| Token | Value | Applied to |
|---|---|---|
| `radius.sm` | 4px | Badges, checkboxes, small chips |
| `radius.md` | 6px | Inputs, selects, buttons, textareas |
| `radius.lg` | 8px | Cards, table container, modals |
| `radius.full` | 9999px | Avatar/initial circle only (if used) |

Nothing exceeds 8px except pills. No `rounded-2xl`, no `rounded-3xl`.

**Borders**

- Default 1px `border.default`.
- Inputs use `border.strong` so controls read as interactive against cards.
- Tables: outer 1px `border.default` + `radius.lg` with `overflow: hidden`; internal row dividers 1px `border.default`; **no vertical column rules**.

**Shadow** — used sparingly; structure comes from borders.

| Token | Value | Applied to |
|---|---|---|
| `shadow.none` | none | Cards, tables (default) |
| `shadow.sm` | `0 1px 2px rgba(20,24,31,0.06)` | Sticky table header, dropdowns |
| `shadow.md` | `0 4px 12px rgba(20,24,31,0.10)` | Popovers |
| `shadow.lg` | `0 12px 32px rgba(20,24,31,0.16)` | Modal dialog |

**Cards do not get shadows.** Border + background separation is enough and keeps the page flat and calm.

**Dividers:** 1px `border.default`. Used between table rows and between form field groups. Never doubled with card borders.

---

## 9. Admin Application Shell

**This is the highest-value change in the entire plan** and the reason the shell must be built first: it eliminates the two-click lateral navigation tax and gives every page one frame.

Requires a **new `app/admin/layout.tsx`** (documented as a needed addition; not implemented in this phase). It must call `requireAdmin()` or rely on per-page calls — *decision needed, see §19.* The layout also mounts the `ToastProvider` once (§16), so every admin page can raise a toast without each page owning its own portal.

### Layout

```
┌────────────┬──────────────────────────────────────────────┐
│            │  Header  (56px)                              │
│  Sidebar   ├──────────────────────────────────────────────┤
│  240px     │                                              │
│            │  Page header (title / description / actions)  │
│            │                                              │
│            │  Page content (max-width 1280px)             │
│            │                                              │
└────────────┴──────────────────────────────────────────────┘
```

### Sidebar

- **Width:** 240px fixed, `bg.surface`, right border `border.default`, full height, does not scroll with content.
- **Branding:** top block, 56px tall to align with header. "CloudUS" in `subheading` + "Admin" in `helper` `text.muted`. No logo asset exists in `public/` (only Next.js starter SVGs) — *use a wordmark; flag logo as a future asset need.*
- **Navigation** (reflecting actual routes):

  ```
  Overview        → /admin
  ─────────────────────────
  QUESTION BANK
    Questions     → /admin/questions
    Import        → /admin/questions/import
  ─────────────────────────
  RESULTS
    Candidates    → /admin/candidates
    Attempts      → /admin/attempts
  ─────────────────────────
  Settings        → /admin/settings
  ```

  Group labels in `helper`, uppercase, `text.muted`, `letter-spacing: 0.04em`.

- **Item:** 36px tall, `space.3` horizontal padding, `radius.md`, `body` weight 400.
- **Active:** `primary.subtle` background, `primary.base` text, weight 500, plus a 2px `primary.base` left bar. Active is determined by pathname prefix — `/admin/questions/[id]` keeps *Questions* active; `/admin/attempts/[id]` keeps *Attempts* active.
- **Hover:** `bg.subtle`.
- **Focus:** 2px `border.focus` ring, offset 2px.
- No disabled nav items — every route is always reachable.
- **Logout** pinned to the sidebar footer, separated by a divider, styled as a tertiary button with the admin's email above it in `helper`/`text.muted`. This removes it from the dashboard content column (audit problem 9).

### Header

- **Height:** 56px, `bg.surface`, bottom border `border.default`.
- Contains **breadcrumbs** (left) and nothing else by default. The admin identity lives in the sidebar footer, so the header stays quiet.
- Sticky on scroll; the sidebar is already fixed.

### Main content

- `bg.page` background so cards and tables read as surfaces.
- Padding `space.10 space.6`.
- Max width **1280px** for table pages, **960px** for the result page, **720px** for Settings. Left-aligned within the content area (not centered) so tables start at a predictable x-position.

### Breadcrumbs

Only where there is a real parent-child relationship — that is, **only on detail pages**:

- `/admin/questions/[id]` → `Questions / SEC1-Q003`
- `/admin/attempts/[id]` → `Attempts / Result`
- `/admin/questions/import` → `Questions / Import`

Top-level pages (`/admin`, `/admin/questions`, `/admin/candidates`, `/admin/attempts`, `/admin/settings`) get **no breadcrumb** — the sidebar already shows position. Do not add them everywhere.

### Responsive shell

See §20.

---

## 10. Navigation

- **Primary navigation:** the sidebar. Always visible ≥1024px.
- **Contextual return:** breadcrumbs on detail pages. The result page's existing `?back=` query parameter (which preserves the attempts filter) must be preserved and used by the breadcrumb's *Attempts* link — this is existing functionality worth keeping.
- **No tabs anywhere.** No page currently has parallel sibling views that justify them.
- **No command palette, no global search.** Search is per-page and scoped; a global search would need a backend that does not exist.
- **Import** stays a sidebar item under Question Bank *and* remains reachable as a primary action on the Questions page — two paths to the same route is correct here because import is a primary workflow.

---

## 11. Page Header System

One pattern, reused on all nine pages:

```
[Breadcrumb — detail pages only]
Page title                                    [Secondary] [Primary]
Short description sentence.
────────────────────────────────────────────────────────────────  (divider)
```

- **Title:** `display`, `text.primary`, single `<h1>`.
- **Description:** `secondary`, `text.muted`, one sentence, optional. Explains what the page is *for*, not what it contains.
- **Actions:** right-aligned, vertically centered against the title. Maximum **one primary** action per page.
- **Divider:** 1px `border.default`, `space.6` below the description, `space.8` above content.

Per-page application:

| Page | Description | Primary action | Secondary |
|---|---|---|---|
| Overview | "System status and recent activity." | — | — |
| Questions | "The question pool papers are drawn from." | Import CSV | — |
| Import | "Upload a CSV to add or update questions." | — | Back to questions |
| Question editor | "Editing does not change papers already sat." | Save changes | — |
| Candidates | "Registrations synchronized from the Google Form." | — | — |
| Attempts | "Exam attempts and their scoring status." | Export CSV | — |
| Result | "Reviewed from the paper snapshot taken at exam time." | Export result CSV | — |
| Settings | "Exam configuration. The paper structure is fixed." | Save settings | — |
| Login | (no page header — see §24) | — | — |

Note: Questions currently has *both* "Import CSV" and "Admin home" as text links; "Admin home" disappears once the sidebar exists.

---

## 12. Button System

| Variant | Fill | Text | Border | Use |
|---|---|---|---|---|
| **Primary** | `primary.base` | `text.inverse` | none | The single most important action on a page: Save, Confirm import, Sign in |
| **Secondary** | `bg.surface` | `text.primary` | `border.strong` | Export CSV, Back, Cancel, Apply filters |
| **Tertiary / ghost** | transparent | `text.secondary` | none | Reset filters, Logout, low-emphasis inline actions |
| **Destructive** | `bg.surface` | `danger.fg` | `danger.fg` @ 40% | Deactivate question. **Outlined, not filled** — it is reversible, so it should not shout |
| **Icon button** | transparent | `text.secondary` | none | Table row actions where a label does not fit; **requires `aria-label` + tooltip** |
| **Link** | — | `primary.base`, underline on hover | — | In-table navigation ("Open", "View result") |

Sizes: `sm` 32px (table rows, filter bar), `md` 36px (default, page header actions), `lg` 40px (login submit only).

States:

- **Hover:** primary → `primary.hover`; secondary/tertiary → `bg.subtle`.
- **Active:** primary → `primary.active`; others → `bg.inset`.
- **Focus:** 2px `border.focus` ring, 2px offset, on all variants. Never remove outlines.
- **Disabled:** `bg.inset` fill, `text.disabled`, `cursor: not-allowed`, no hover change.
- **Loading:** spinner replaces the leading icon slot; **label changes to the progressive form** ("Saving…", "Importing…", "Signing in…") and the button stays disabled. This already happens in `login-form.tsx` and `settings-form.tsx` — formalize it.

Rule: **at most one Primary per page region.** The Attempts page's Export is Secondary, not Primary — exporting is not the page's main job.

---

## 13. Form System

Applies chiefly to **Question Editor**, **Settings** and **Login**.

**Field anatomy**

```
Label *                       ← label token, text.primary; * in danger.fg
[ control                  ]  ← 36px tall, radius.md, border.strong
Helper text.                  ← helper token, text.muted
```

On error, helper is replaced by the error message in `danger.fg`, and the control border becomes `danger.fg`.

**Controls**

- **Input / Select / Textarea:** `bg.surface`, 1px `border.strong`, `radius.md`, `space.3` padding-x, `body` text. Focus: `border.focus` + 2px ring. Textareas resize vertically only.
- **Read-only by design** (Question ID): `bg.inset` background, `border.default`, `text.secondary`, **no focus ring**, plus a lock icon and helper text "The ID comes from the CSV and cannot be changed." — categorically different from disabled (audit problem 19).
- **Disabled:** `bg.inset`, `text.disabled`.
- **Checkbox** (`scored`, `aiVerified`, `trainerVerified`): 16px, `radius.sm`, `primary.base` when checked, label right, whole row clickable.
- **Toggle** — reserve for the Settings exam open/closed control only (§32).

**Grouping**

Long forms use **fieldset sections** with a `subheading` heading and a `secondary` description, separated by dividers. This directly fixes audit problem 17.

**Validation**

- Server-side validation already returns field-keyed errors (`errorFor(field)` in both forms). Keep exactly that contract.
- Errors appear **inline under the field** *and* as a summary alert at the top of the form when more than two fields fail.
- Error text must be associated via `aria-describedby`; the field gets `aria-invalid`.

**Widths**

Field width should signal expected content: exam name and topic full width; duration and percentages ~120px; section/difficulty/status selects ~180px; option A–D two-column; question text and lesson text full-width textareas.

---

## 14. Table System

The Question Bank, Candidates and Attempts pages are tables; the design lives or dies here.

**Container:** `bg.surface`, 1px `border.default`, `radius.lg`, `overflow: hidden`. No shadow.

**Header row:** `bg.subtle`, `label` token, `text.secondary`, 40px tall, bottom border `border.default`. Sticky under the app header on long lists.

**Body row:** 48px default, `space.3` horizontal cell padding, bottom border `border.default` (last row none). Hover `bg.subtle`. No zebra striping — borders are enough and striping fights status colors.

**Column hierarchy** — the fix for audit problems 10, 21, 24:

- **Identity column** (candidate name, question ID): `body-strong`, `text.primary`. Secondary detail may sit beneath in `helper`/`text.muted` (e.g. `entered: <name>` on Attempts — existing functionality).
- **Supporting columns** (email, mobile, topic): `body`, `text.secondary`.
- **Metadata columns** (timestamps): `secondary`, `text.muted`.
- **Status columns:** badges (§15).
- **Numeric columns** (score, marks, counts): right-aligned, tabular numerals.
- **Action column:** right-aligned, fixed width, link or icon button.

**Alignment:** text left, numbers right, badges left, actions right.

**Long text** (question text — audit problem 12): clamp to **one line with ellipsis** and make the full value inspectable — the row links to the editor anyway, so the primary answer is "open the record". Additionally show full text in a **hover/focus popover** (not a native `title`), triggered by keyboard focus too. Never truncate an ID, a score, or a status.

**Pagination:** below the table, outside the container. Left: "Showing 1–25 of 132". Right: Previous / page indicator / Next. Preserve the existing `?page=` URL model exactly. Disabled controls render as `text.disabled` text, not as buttons (matching current behavior).

**Density:** one density only. Do not build a density switcher — it is configuration nobody asked for.

**Responsive:** see §20.

---

## 15. Status System

Every status in CloudUS, using only values that actually exist in the codebase.

**Badge style:** `radius.sm`, `space.1` / `space.3` padding, `badge` token, status `bg` fill + `fg` text. No border. **Sentence case** ("In progress", not "IN PROGRESS" or "in_progress").

### Question status (`QuestionStatus` enum)

| Value | Badge | Label |
|---|---|---|
| `ready` | `success` | Ready |
| `review` | `warning` | In review |
| `draft` | `neutral` | Draft |

### Question active flag (`isActive`)

A **separate axis** — fixing audit problem 11. Do not merge it into the status badge. Render inactive rows with a small `neutral` "Inactive" badge in a dedicated column and dim the row's identity text; active rows show nothing (absence is the norm).

### Question difficulty (`Difficulty` enum)

Difficulty is **not a status** — it is a property. Use a neutral outlined chip (`border.default`, `text.secondary`), not a colored badge, so it does not compete with real status. Labels: Easy / Medium / Hard.

### Attempt status (`AttemptStatus` enum)

| Value | Badge | Label |
|---|---|---|
| `in_progress` | `info` | In progress |
| `submitted` | `success` | Submitted |
| `auto_submitted` | `warning` | Auto submitted |

`auto_submitted` is `warning` because it means the candidate ran out of time — a fact worth noticing, not an error.

### Scoring state (derived, from `AttemptScoring`)

This is a **second axis** and must not be conflated with attempt status:

| Kind | Presentation in the score column |
|---|---|
| `scored` | `52.50 / 70.00` — `score-sm`, `text.primary`, tabular |
| `pending` | `warning` badge "Scoring pending" |
| `not-finalized` | `text.muted` em-dash with `helper` "Not finalized" |

Never `0.00` for the last two. This is design principle P4 and the single most important correctness rule on the Attempts page.

### Exam status (`isOpen`)

| Value | Badge | Label |
|---|---|---|
| `true` | `success` | Open |
| `false` | `neutral` | Closed |

### Question review result (result page / `ReviewState`)

| Value | Badge | Label |
|---|---|---|
| `correct` | `success` | Correct |
| `wrong` | `danger` | Wrong |
| `unanswered` | `warning` | Unanswered |
| `unscored` | `neutral` | Unscored |

`unanswered` is deliberately distinct from `wrong` — both score zero but they are not the same event.

### Import outcome

| State | Presentation |
|---|---|
| Valid rows | `success` count |
| Rows with errors | `danger` count + error list |
| Import complete | `success` alert with per-section/per-difficulty summary |

**Do not introduce** any status name not in this table. There is no "Archived", "Published", "Flagged" or "Reviewed" in CloudUS.

---

## 16. Feedback System

Four mechanisms, each with a defined trigger:

| Mechanism | When | Where |
|---|---|---|
| **Inline field error** | Field-level validation failure | Under the field |
| **Alert (inline banner)** | Blocking or persistent conditions; anything the admin must act on | Top of the form / top of page content |
| **Toast** | Transient confirmation of a completed action | Bottom-right overlay |
| **Page-level state** | Loading, empty, error, not-found | Replaces content region |

### Toast vs Alert — the division of labor

Both exist; using them interchangeably is what makes feedback systems feel sloppy. The rule:

- **Toast = "that worked, carry on."** Transient, dismissible, non-blocking. Used when the action succeeded and the admin does not need to do anything else. It must never be the *only* place important information appears.
- **Alert = "read this before continuing."** Persistent, in the content flow. Used for validation failures, blocking errors, and ambient conditions (exam closed, scoring pending).

| Event | Mechanism |
|---|---|
| Question saved | **Toast** — success |
| Settings updated | **Toast** — success |
| Question deactivated / reactivated | **Toast** — success |
| Signed out | **Toast** on the login page — info |
| Import completed | **Alert** (the per-section summary is data to read, not a transient note) + toast optional |
| Field validation failed | **Inline field error** + form-level alert if >2 fields |
| Save failed (server/network) | **Alert** in the form — the admin must retry, so it must not vanish |
| Sign-in failed | **Alert** in the login card |
| Exam is closed | **Alert** on Overview and Settings — ambient state, never a toast |
| Attempt finalized but unscored | **Alert** on the result page |
| Copied attempt ID | **Toast** — info, short |

**Hard rule:** an error the admin must act on is **never** toast-only. A toast may accompany an alert, but must not replace one.

### Toast anatomy and behavior

- **Position:** fixed bottom-right, `space.6` from both edges. Below `md` it becomes bottom-center, full-width minus `space.4`, so it does not sit under a thumb or crowd a narrow viewport.
- **Size:** min 280px, max 400px (full-width on mobile), `radius.md`, `bg.surface`, 1px `border.default`, **`shadow.lg`** — the one place in the admin panel where a real shadow is correct, because a toast genuinely floats above the page.
- **Anatomy:** status-colored icon (16px) · message in `body` · optional one-line detail in `helper` · dismiss × as an icon button.
- **Left accent bar:** 3px in the status color. This carries the semantic weight without tinting the whole surface, keeping toasts visually distinct from inline alerts (which *are* tinted).
- **Duration:** success 4s · info 4s · warning 6s · error **never auto-dismisses** (though per the hard rule above, errors should rarely be toasts at all).
- **Stacking:** newest at the bottom, maximum 3 visible; older ones collapse out. Identical consecutive messages increment a count rather than stacking duplicates.
- **Hover / focus pauses the dismiss timer** and resumes on leave — otherwise a toast can vanish mid-read.
- **Dismissal:** click ×, or Escape while focused.

### Toast accessibility

This is where toast systems usually fail, so it is specified rather than assumed:

- The toast container is a persistent live region present in the DOM from page load — `aria-live="polite"` for success/info, `aria-live="assertive"` + `role="alert"` for warning/error. Creating the region at the same moment as the toast means screen readers miss the announcement.
- Toasts **do not steal focus.** An admin mid-typing is not interrupted.
- The dismiss button is keyboard-reachable and carries `aria-label="Dismiss notification"`.
- Auto-dismiss timings respect `prefers-reduced-motion` for the *animation*, not the timing; and any toast carrying information not available elsewhere on the page must not auto-dismiss at all.
- Toast text is never the sole carrier of a result — the page state behind it already reflects the change (the Server Action re-rendered it).

### Implementation note

Every current admin mutation is a Server Action driven by `useActionState`, which re-renders the page with a result object. Toasts should be **derived from that existing result state**, not from a parallel imperative `toast()` API sprinkled through components. Concretely: a small client `ToastProvider` in the admin layout, plus a hook that watches an action's returned status and enqueues a toast on transition. This keeps the server as the source of truth and avoids a toast firing without the underlying mutation having succeeded.

**No new dependency is required** — this is a provider, a context, a timer and a portal, well under 150 lines. Do not add `sonner`, `react-hot-toast` or similar for this; they bring animation systems and APIs far beyond what CloudUS needs, and the accessibility rules above still have to be verified by hand either way.

**Alert anatomy:** `radius.md`, status `bg` fill, 1px status `fg` @ 30% border, status-colored icon, `body` message, optional `helper` detail list. Dismissible only for success; errors persist until resolved.

| Variant | CloudUS examples |
|---|---|
| `success` | "Question saved." · "Settings updated." · "Import complete — 55 questions added." |
| `danger` | "Could not save the question." · "3 rows could not be imported." · "Sign-in failed." |
| `warning` | "The exam is currently closed. Candidates cannot start." · "This attempt is finalized but has not been scored yet." |
| `info` | "Editing this question does not change papers already sat." |

The **exam-closed warning** deserves special placement: it is the most consequential piece of ambient state in the product. It belongs on the Overview page and on Settings, not as a global banner on every page (that would train admins to ignore it).

---

## 17. Loading / Empty / Error States

Currently **absent under `app/admin/`** (audit finding). All of these require new `loading.tsx` / `error.tsx` files — documented here, implemented later.

### Loading

- **Page load:** a `loading.tsx` per table route rendering a **skeleton** — page header (real, static) + table container with 8 shimmer rows matching the real column widths. Not a centered spinner: skeletons preserve layout and feel faster.
- **Form submission:** button enters loading state; form fields disabled; no overlay.
- **Export:** the export link is a plain GET download; the browser shows its own progress. Add a brief "Preparing export…" only if a future implementation makes it async — currently not needed.

### Empty

Pattern: centered within the table container, `space.10` vertical padding — icon (`text.muted`), `subheading` title, one `secondary` explanatory line, and a primary action **only when one genuinely helps**.

| Context | Title | Body | Action |
|---|---|---|---|
| No questions at all | "No questions yet" | "Import a CSV to build the question bank." | Import CSV |
| No questions match filters | "No questions match these filters" | "Try widening the section, difficulty or status filters." | Reset filters |
| No candidates | "No candidates yet" | "Candidates appear here once the Google Form sync runs." | — |
| No candidate search results | "No candidates match your search" | "Check the spelling of the name, email or mobile." | Reset |
| No attempts | "No attempts yet" | "Attempts appear here once candidates begin the exam." | — |
| No attempts match filters | "No attempts match your filters" | "Try clearing the status or scoring filter." | Reset filters |

The distinction between "nothing exists" and "nothing matches" is already implemented in the current pages — preserve it.

### Error

- **Page error** (`error.tsx`): centered block, `danger` icon, "Something went wrong", one `secondary` line — **never the raw database error** — and a "Try again" button wired to `reset()`. Server-side logs keep the detail.
- **Action failure:** inline `danger` alert in the form.
- **Authorization failure:** already handled by `requireAdmin()` redirecting to `/admin/login`. No design needed beyond the login page's own state.

### Not found

- **Question not found** (`app/admin/questions/[id]/not-found.tsx` exists): "Question not found", "It may have been removed, or the ID may be wrong.", link back to Questions.
- **Attempt not found:** same pattern; needs a new `not-found.tsx` under `app/admin/attempts/[id]/`.

*Known caveat carried from earlier phases: `notFound()` returns HTTP 200 in Next.js 16. That is a status-code issue, not a design issue; noted so nobody "fixes" it visually.*

---

## 18. Modal / Dialog System

**Use a modal only when the action is destructive or irreversible and the user needs to stop and read.**

| Action | Treatment | Why |
|---|---|---|
| Deactivate question | **Inline confirmation** (already implemented: reveals confirm/cancel buttons in place) | Reversible; the current inline pattern is good — keep it, restyle it |
| Confirm CSV import | **Inline, on the preview step** (already implemented) | The preview *is* the confirmation context; a modal would hide the data being confirmed |
| Save settings | Direct submit + success alert | Reversible |
| Change exam open/closed | **Inline warning + explicit confirm** when switching to Open | Opening the exam admits candidates — high consequence, but a modal covering the settings context is worse than an inline confirm |
| Logout | Direct action | Trivially reversible |

**Net result: CloudUS needs no modal system today.** Every confirmation has a better inline home. Building a dialog primitive now would be an abstraction with zero users (violates P7).

*If a future phase adds a genuinely destructive action (delete attempt, purge candidates), a modal spec should be written then, with focus trap, Escape-to-close, initial focus on the safe action, and `role="alertdialog"`.*

---

## 19. Accessibility

Requirements for implementation, not aspirations:

**Structure**

- One `<h1>` per page (the page title). Section headings step down in order; never skip levels.
- The shell uses `<nav aria-label="Main">`, `<main>`, and the sidebar footer inside the nav landmark.
- Tables use real `<table>/<thead>/<th scope="col">/<tbody>` — already the case; preserve it.

**Keyboard**

- Every interactive element reachable by Tab in visual order.
- **Visible focus ring on everything** — 2px `border.focus`, 2px offset. Never `outline: none` without a replacement.
- The inline deactivate confirmation must move focus to the confirm button when revealed, and return focus to the trigger on cancel.
- Table row actions are real links/buttons, never `onClick` on a `<tr>`.

**Forms**

- Every control has a `<label for>` or is wrapped by its label (current code does both — standardize on `for`/`id`).
- Errors: `aria-invalid="true"` + `aria-describedby` pointing at the error node.
- The form-level alert uses `role="alert"` (already used in `login-form.tsx` — keep).
- Required fields marked with both `*` and `required`, with a legend explaining `*`.

**Status**

- **Never color alone.** Every badge carries a text label. This is why the status system specifies labels alongside colors.
- Score cells that show a state instead of a number use real text ("Scoring pending"), not a dash alone.
- Live updates (save results) announced via `role="status"` (already used in `question-editor.tsx`).

**Contrast**

- All text tokens meet WCAG AA on their intended backgrounds (values chosen in §6 with ratios noted).
- `text.disabled` fails AA by design and may **never** be the sole carrier of information.

**Screen reader specifics**

- Icon-only buttons require `aria-label`.
- The truncated-question popover must be reachable on focus, not hover only.
- Decorative icons get `aria-hidden="true"`.

---

## 20. Responsive Strategy

**Every device is a supported target — phone, tablet, laptop and desktop alike.**

The original requirements said "no mobile-responsive design (office PCs only)". **That constraint has been lifted by explicit project decision.** The admin panel must be fully usable on a phone, not merely unbroken. An admin should be able to check attempt status, look up a candidate, read a result and change the exam's open/closed state from a phone, with no functionality hidden or removed at any width.

Desktop remains the *density* target — that is where the dense tables are optimised — but small screens get a genuinely designed layout rather than a degraded one.

### Breakpoints

| Token | Width | Device | Layout |
|---|---|---|---|
| `xs` | <480px | Phone, portrait | Single column. Top bar + drawer nav. Tables become stacked record cards. Content padding `space.4`. Full-width controls. |
| `sm` | 480–767px | Phone landscape, small tablet | As `xs`, but two-up filter controls and side-by-side definition pairs where they fit. |
| `md` | 768–1023px | Tablet | Sidebar becomes a 56px icon rail (tooltip on hover/focus) or a drawer, depending on the page. Tables keep real columns with a reduced column set. Filter bar wraps to two rows. |
| `lg` | 1024–1439px | Laptop | **Full layout.** Sidebar 240px, all table columns visible. |
| `xl` | ≥1440px | Desktop | As `lg`; content max-width caps line length so the layout does not sprawl. |

### Navigation across widths

- **≥1024px** — persistent 240px sidebar.
- **768–1023px** — 56px icon rail; labels appear in a tooltip and on focus. Rail can be expanded by a toggle, remembered per session via `localStorage`.
- **<768px** — sidebar leaves the flow entirely. A 56px top bar holds a menu button, the current page title, and nothing else. The menu opens a **drawer** over a scrim: full nav list, admin email and logout at the bottom. Drawer closes on selection, on scrim tap, and on Escape; focus is trapped while open and returns to the menu button on close.

### Tables — the real work

This replaces the earlier "tables never reflow" rule.

- **≥1024px** — full column set as specified per page (§26, §29, §30).
- **768–1023px** — the *same table*, with low-priority columns dropped rather than squeezed. Each table declares a column priority order; nothing dropped here is unique information (it remains on the record's detail page):
  - **Attempts:** drop Mobile and Submitted. Keep Candidate, Status, Started, Score, action.
  - **Questions:** drop Topic and Marks. Keep ID, Section, Question, Difficulty, Status, Active, action.
  - **Candidates:** drop Registered. Keep Candidate, Mobile, Attempts, action.
- **<768px** — each row renders as a **stacked record card**: identity line in `body-strong`, supporting fields as label/value pairs beneath, status badge and score aligned to the top-right, and the row action as a full-width button or a trailing chevron on the whole card. This is a genuine mobile layout, not a horizontally scrolled table.
  - The **score** keeps its prominence: `score-sm`, right-aligned, top of the card, with the same three-state rule (§15) — a scored value, a "Scoring pending" badge, or "Not finalized". It must never collapse to `0.00` on any width.
  - Cards keep the table's semantics for assistive tech: the card list is still a `<table>` with `display: block` styling applied at that width, **or** a `<ul>` of `<li>` records with each field labelled. Whichever is chosen, headers must remain programmatically associated — do not ship unlabelled floating values.

**Exception — Import preview and the fixed Exam structure table** stay as horizontally scrolling tables at every width. Both are dense reference grids being *checked against* a source file rather than browsed, so column alignment matters more than card readability. Their containers get `overflow-x: auto` with a visible scroll affordance.

### Other surfaces

- **Filter bars** — wrap to multiple rows on tablet; below `sm` they collapse behind a "Filters" disclosure button showing a count of active filters, with the controls stacking full-width when opened. Applied filters remain visible as removable chips above the results at every width, so nothing is hidden without a trace.
- **Page header** — actions drop below the title on `md` and become full-width buttons below `sm`.
- **Forms** — all multi-column grids (Settings' 2- and 3-column rows, the editor's option A–D pair) go single-column below `md`. Controls become full-width; the editor's sticky save bar stays pinned to the bottom of the viewport on small screens.
- **Result page** — already single column. Below `md`: the section-score table becomes a two-column list (section name / `achieved / max`), the section jump strip becomes horizontally scrollable chips, and each question card stacks its option list full-width. Section 7 lesson panels keep their grouping and left-border association at every width.
- **Login** — card goes full-width minus `space.4` below 480px, vertically centred.

### Touch and input

- Minimum touch target **44×44px** for every interactive element below `md`; table row actions and nav items are sized accordingly.
- Adequate spacing between adjacent tap targets — no 4px gaps between a link and a button on touch widths.
- No hover-only affordances. The truncated-question popover (§14) must open on tap as well as hover and focus; anything reachable only by hover is a defect on touch devices.
- Inputs use appropriate `inputMode`/`type` so mobile keyboards match the field (numeric for duration and percentages, email for the login field — the latter already correct).

### Hard rules

- **The page body never scrolls horizontally at any width.** Only explicitly-scrollable containers (import preview, blueprint table) may.
- **No functionality is removed at any breakpoint.** Filtering, sorting, pagination, export, editing and every state remain reachable on a phone.
- **No separate mobile routes or components-per-breakpoint.** One component tree, responsive styles.
- Every page must be checked at **375px, 768px, 1024px and 1440px** before approval (§40).

---

## 21. Motion Strategy

Minimal and functional.

| Element | Transition |
|---|---|
| Button / link hover | `background-color`, `border-color` 120ms ease-out |
| Table row hover | `background-color` 100ms ease-out |
| Focus ring | none (instant — delayed focus feels broken) |
| Inline confirmation reveal | height/opacity 150ms ease-out |
| Skeleton shimmer | 1.5s linear loop |
| Sidebar rail collapse | `width` 180ms ease-out |
| Mobile nav drawer | `transform` 180ms ease-out + scrim fade |
| Toast enter | slide 8px up + fade in, 180ms ease-out |
| Toast exit | fade out + 120ms; height collapse when stacked |

Rules:

- **Nothing above 200ms.**
- No page transitions, no entrance animations, no number count-ups, no parallax, no hover lift on cards.
- Respect `prefers-reduced-motion: reduce` — disable shimmer (use a static `bg.subtle` block), the toast slide (fade only, or appear instantly) and all non-essential transitions. **Reduced motion changes how a toast appears, never how long it stays** — shortening its life would cost information.

---

## 22. Iconography

**Current state: no icon library is installed.** Confirmed against `package.json` — no `lucide-react`, `@heroicons`, `react-icons`, `@radix-ui/react-icons`, or `phosphor`. `public/` contains only Next.js starter SVGs (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`), none of which are used by the admin panel.

**Recommendation (future, requires approval — not installed in this phase):** `lucide-react`. Rationale: 1.5px consistent stroke, tree-shakeable per-icon imports, MIT, no runtime, matches the restrained visual direction. Roughly 20 icons are needed:

`LayoutDashboard, FileQuestion, Upload, Users, ClipboardList, Settings, LogOut, Search, Filter, ChevronLeft, ChevronRight, ChevronDown, Check, X, AlertTriangle, AlertCircle, Info, Download, Lock, ExternalLink, Loader2`

**Alternative if no dependency is acceptable:** hand-author only the ~8 icons the sidebar and alerts truly need as inline SVG components. More work, zero dependency. *Decision flagged in §19.*

**Icon principles**

- 16px in buttons/badges/table cells; 20px in sidebar nav; 24px in empty states.
- `currentColor` fill/stroke always — icons inherit their context's color.
- Icons **support** labels; they never replace them except in the collapsed sidebar rail and table action buttons, both of which require `aria-label` + tooltip.
- No icons purely for decoration. No icons inside every table cell.

---

## 23. Reusable Component Architecture

No `components/` directory exists. Proposed structure (**not created in this phase**):

```
components/
  ui/            ← primitives, no CloudUS knowledge
  layout/        ← the admin shell
  admin/         ← CloudUS-aware, reused across admin pages
```

### `components/ui/` — primitives

| Component | Purpose | Reused by |
|---|---|---|
| `Button` | Variants/sizes/loading per §12 | Every page |
| `Input`, `Select`, `Textarea`, `Checkbox` | Styled controls | Login, Settings, Editor, all filter bars |
| `Field` | Label + control + helper/error + a11y wiring | Settings, Editor, Login |
| `Badge` | Status pill, `variant` = success/warning/danger/info/neutral | Questions, Attempts, Result, Settings |
| `Alert` | Inline banner per §16 | Import, Editor, Settings, Login, Result |
| `Toast` + `ToastProvider` | Transient success/info confirmation per §16; live region, stacking, timer pause, portal | Editor (save, deactivate), Settings (save), Login (signed out), Result (copy ID) |
| `Table` (+ `THead`, `TRow`, `TCell`) | Table shell per §14 | Questions, Candidates, Attempts, Import preview, Settings blueprint |
| `Pagination` | Prev / position / Next | Questions, Candidates, Attempts |
| `EmptyState` | Icon + title + body + optional action | All list pages |
| `Skeleton` | Shimmer block | All `loading.tsx` |
| `Card` | Bordered surface + optional heading | Result page, Overview, Import steps |

### `components/layout/`

| Component | Purpose |
|---|---|
| `AdminShell` | Sidebar + header + content frame (used by `app/admin/layout.tsx`) |
| `Sidebar` + `SidebarNavItem` | Navigation with active-path logic |
| `PageHeader` | Title + description + actions + divider per §11 |
| `Breadcrumbs` | Detail pages only |

### `components/admin/` — CloudUS-aware

| Component | Purpose | Why reusable |
|---|---|---|
| `AttemptStatusBadge` | Maps `AttemptStatus` → badge + label | Attempts table, Result page |
| `QuestionStatusBadge` | Maps `QuestionStatus` + `isActive` | Questions table, Editor |
| `ScoreCell` | Renders the three-state score per §15 | Attempts table (and Result summary) |
| `SectionScoreTable` | 8 sections + total, achieved/max | Result page (and Overview, if the blueprint summary is shown) |
| `FilterBar` | GET form wrapper with consistent layout + Apply/Reset | Questions, Candidates, Attempts |

### Deliberately *not* abstracted

- **`QuestionReviewCard`** — used only on the result page. Keep it colocated as `app/admin/attempts/[id]/question-review-card.tsx`.
- **`ImportStepper`** — used only by import.
- **Modal / Dialog** — no current consumer (§18).
- **DataTable generic** — the three tables have genuinely different columns and cell semantics; a config-driven mega-table would be harder to read than three explicit tables sharing `Table` primitives.

---

## 24. Admin Login Design

**Purpose:** authenticate the one or two admin accounts. **Goal:** sign in in under five seconds; on failure, understand why.

**Layout:** full-viewport `bg.page`, centered card, no sidebar/header (the shell must not wrap `/admin/login`). Card: 400px, `bg.surface`, 1px `border.default`, `radius.lg`, `space.8` padding, vertically centered with a slight upward bias (~45% from top).

**Content:** "CloudUS" wordmark (`title`) + "Admin" (`secondary`, `text.muted`) → `space.6` → "Sign in" (`heading`) → email field → password field → primary full-width `lg` button.

**States**

- *Default:* focus starts in the email field.
- *Loading:* button disabled, label "Signing in…" (already implemented).
- *Error:* `danger` Alert above the submit button — "Email or password is incorrect." Deliberately generic, so the form never reveals whether an email exists. Fields keep their values (email only; password clears).
- *Already signed in:* redirects to `/admin` (already implemented).

**Responsive:** card goes full-width minus `space.4` below 480px.

**Accessibility:** labels wired with `for`/`id`, `autoComplete="username"` / `"current-password"` (already correct), error `role="alert"` (already correct), submit reachable via Enter.

**Do NOT add:** registration, forgot-password, social login, "remember me", password-strength meters, or a rate-limit countdown. None exist in the backend.

---

## 25. Dashboard (Overview) Design

**Purpose:** answer "is the system in a state where an exam can run, and what happened recently?" **Goal:** orient in under ten seconds, then move on.

The requirements have **no dashboard screen** (Screens A–D are Question bank, Candidates/attempts, Individual result, Settings) and explicitly exclude question analytics. So the Overview must stay a genuinely useful landing page, not an invented analytics surface.

**Proposed content, in order:**

1. **Exam status strip.** The single most important ambient fact. A card showing exam **Open/Closed** badge, exam name, duration, and difficulty mix, with a "Manage settings" link. All values already available from `getExamSettings()`.

2. **Readiness summary.** Whether the bank can actually produce a paper: total active+ready questions, and a per-section count against the blueprint requirement (e.g. "Section 4 — 8 needed, 26 available"). This is *operationally* essential (paper generation fails without it) and is not "analytics".
   → **Requires a new backend query** (a grouped count of ready/active questions by section). **Future / needs implementation** — document, do not build now.

3. **Recent attempts.** The five most recent attempts, reusing the Attempts row presentation (candidate, status, score state), with "View all attempts". `listAttempts` already supports this via existing filters/sort.

4. **Quick actions.** Two secondary buttons: Import CSV, Export attempts. No more.

**Explicitly NOT on the dashboard:** pass rates, score distributions, average scores, section difficulty analysis, time-series charts, per-question statistics. The requirements rule these out, and inventing them would misrepresent the product.

**Empty system state:** if there are no questions and no attempts, show a single "Get started" card pointing at Import CSV rather than four empty widgets.

**Layout:** exam status full-width; readiness + quick actions in a two-column row; recent attempts full-width beneath.

---

## 26. Question Bank Design

**Purpose:** find and maintain the pool papers are drawn from. **Goal:** locate a question by ID/text/topic, or survey a section's coverage, then open it.

**Structure:** Page header (primary: Import CSV) → filter bar → table → pagination.

**Filter bar:** a bordered `bg.surface` container (fixing audit problem 13) holding Search, Section, Difficulty, Status, Active, Scored, Per-page, then Apply + Reset. Search is widest; selects are uniform width. All existing parameters preserved exactly.

**Table columns** (reduced from eleven to nine, with clear hierarchy):

| Column | Treatment |
|---|---|
| ID | `mono`, `body-strong` — the primary identifier |
| Section | Neutral chip "S4" |
| Question | `body`, single-line clamp + focusable popover for full text |
| Topic | `secondary`, `text.muted` |
| Difficulty | Neutral outlined chip |
| Marks | Right-aligned, tabular |
| Status | `QuestionStatusBadge` |
| Active | "Inactive" `neutral` badge, or empty |
| — | "Open" link, right-aligned |

**Lesson** and **Scored** move off the default table: Lesson group is only meaningful for Section 7 (show it as a small annotation under the ID when present), and Scored is fully determined by section (8 = unscored), so a dedicated column repeats information. *This removes two columns without losing information — the editor shows both.*

**Inactive rows:** identity text at `text.muted`; the row is not hidden and not struck through.

**Empty states:** per §17, distinguishing "no questions" from "no matches".

**Do NOT add:** bulk selection/bulk actions, inline editing, drag-reordering, per-question statistics, or a preview modal. None are supported.

---

## 27. Question Import Design

**Purpose:** add/update questions from CSV. **Goal:** understand exactly what will change *before* committing.

**Make the existing four stages legible as a flow** (fixing audit problem 14) with a lightweight step indicator: **Upload → Review → Import → Done**. Not a wizard framework — a header strip showing current position.

**Step 1 — Upload.** A dashed-border drop zone (`border.strong` dashed, `radius.lg`, `bg.subtle` on drag-over) with an upload icon, "Choose a CSV file or drag it here", and helper text naming the accepted extension and the required columns (the CSV contract already exists in `lib/question-bank/csv-contract.ts`). Selected state: file name, size, and a "Remove" tertiary button. Primary: "Validate file".
*Note: drag-and-drop is an enhancement over the current plain file input; if it complicates the Server Action flow, ship the styled file button alone — it is not essential.*

**Step 2 — Review.** Two summary tiles: valid rows (`success`) and rows with errors (`danger`). Then:
- **Errors first**, grouped by row in a bordered `danger`-tinted list: "Row 12 · difficulty — must be easy, medium or hard". Grouping by row instead of a flat list fixes audit problem 16. Cap the visible list (the current code already caps and says how many more exist) with the count of remaining errors.
- **Preview table** of valid rows, scrollable with a sticky header (already implemented), using the standard table style.
- Primary "Import N questions"; secondary "Choose a different file".

**Step 3 — Importing.** Primary button in loading state, preview dimmed and non-interactive.

**Step 4 — Done.** `success` Alert plus the existing summary (added/updated counts, per-section and per-difficulty breakdown — this is required by the requirements). Actions: "View question bank" (primary), "Import another file" (secondary).

**Failure:** `danger` Alert stating nothing was imported (the import is transactional), with the reason and a retry path.

**Do NOT add:** column mapping UI, partial/row-level import selection, template download (unless a template file actually exists), or import history — none exist.

---

## 28. Question Editor Design

**Purpose:** correct or retire a single question. **Goal:** find the field, change it, save with confidence — while understanding that historical attempts are unaffected.

**Layout:** single column, max-width 720px, grouped fieldsets (fixing audit problem 17):

1. **Identity** — ID (read-only style per §13, with the lock treatment), Section, Topic, Difficulty, Status.
2. **Question** — question text (textarea), code block (mono textarea, monospace, helper "Optional. Shown as a code block to the candidate.").
3. **Options** — A/B/C/D in a two-column grid, then Correct answer (select) and Marks. The correct-answer select should show the option letter *and* a truncated preview of that option's text.
4. **Explanation** — textarea, helper noting it is shown only in admin result review, never to candidates.
5. **Section 7 — Learn-and-Apply** — lesson text + lesson group. **Only rendered when Section is 7** (fixing audit problem 18); when hidden, values are preserved untouched. If a non-7 question somehow carries lesson data, show the group with a `warning` note rather than silently hiding it.
6. **Scoring** — Scored checkbox + Marks; helper explains Section 8 is never scored.
7. **Verification** — AI verified / Trainer verified checkboxes, grouped with a short explanatory line.

**Persistent context banner** (`info` Alert, top of page): "Editing a question does not change papers candidates have already sat." This is true (snapshots), important, and currently only implicit.

**Save:** sticky footer bar at the bottom of the form containing the primary "Save changes" and a status region for the success/error alert, so the action is reachable without scrolling to the end of a long form.

**Activate / deactivate:** a visually distinct block below the form — `warning`-tinted card, `subheading` "Deactivate question", one line explaining that deactivated questions are excluded from future papers but remain in historical attempts, then the destructive outlined button and the existing inline confirmation. The distinct tint fixes audit problem 20.

**Do NOT add:** delete, duplicate, version history, preview-as-candidate, or bulk edit. None exist.

---

## 29. Candidates Design

**Purpose:** find a registered candidate and reach their attempts. **Goal:** identify a person quickly despite self-entry typos.

**Structure:** page header (no primary action — this page is read-only) → filter bar (Search + Per-page) → table → pagination.

**Columns:**

| Column | Treatment |
|---|---|
| Candidate | Name `body-strong`; email beneath in `helper`/`text.muted` — a single identity cell (fixes audit problem 21) |
| Mobile | `mono`, `body` |
| Registered | `secondary`, `text.muted` |
| Attempts | Right-aligned count; `0` in `text.muted` so "never sat" is visible at a glance |
| — | "View attempts" link |

**`updatedAt` is dropped from the default table** (audit problem 22): it is rarely decision-relevant and competes with `registeredAt`. It remains available in the CSV export and the database.

**Duplicate mobile signal** (audit problem 23 — requirements call this "the only real weak point"): when two candidate rows share a mobile number, show a small `warning` "Duplicate mobile" badge on both. **Requires a new backend query** (a grouped count of candidates by mobile for the current page). **Future / needs implementation** — specified here, not built.

**Empty states:** "No candidates yet" (with the Google Form explanation) vs "No candidates match your search".

**Do NOT add:** create/edit/delete candidate, merge duplicates, or email actions. Candidates are owned by the Google Form sync; the requirements say mismatches are corrected manually and there is no email sending.

---

## 30. Attempts Design

The highest-traffic admin page and the one where correctness matters most.

**Purpose:** monitor sittings and reach results. **Goal:** see who has finished, who is mid-exam, what has been scored, and open a result — plus export.

**Structure:** page header (secondary: Export CSV) → filter bar → table → pagination.

**Filter bar:** Search, Status, Scoring, Sort, Per-page, Apply, Reset — all existing parameters preserved. When a candidate filter is active, show a **removable filter chip** above the table: "Candidate: Priya Shah ✕" (replacing the current sentence-and-link banner) with the hidden field preserved so other filter changes don't drop it. The unknown-candidate case keeps its explicit message.

**Columns:**

| Column | Treatment |
|---|---|
| Candidate | Name `body-strong`; email `helper`/`text.muted` beneath; the existing "entered: …" mismatch annotation shown in `warning.fg` when present |
| Mobile | `mono` |
| Status | `AttemptStatusBadge` |
| Started | `secondary`, `text.muted` |
| Submitted | `secondary`, `text.muted`; em-dash when null |
| Score | **`ScoreCell`** — right-aligned, `score-sm` weight 600 for scored; "Scoring pending" `warning` badge; "Not finalized" muted text |
| — | "View result" link; em-dash for in-progress (existing behavior) |

This makes the score the visually heaviest cell in its row without letting it dominate candidate identity (fixing audit problem 24), and gives the three scoring states distinct, non-misleading encodings (audit problem 25).

**Time taken** — the requirements ask for it, and `Attempt.durationSeconds` exists in the schema but is **never written or read** anywhere in the codebase (verified). It could be derived as `submittedAt − startedAt` for finalized attempts. **Future / not currently supported** — listed as a decision in §19; do not compute it during the design track.

**Sort:** the six existing keys stay in the Sort select. Making column headers clickable is *optional* and would need care to keep the allowlist intact — recommend keeping the select for now.

**Empty states:** "No attempts yet" vs "No attempts match your filters".

**Do NOT add:** editing answers, submitting on a candidate's behalf, changing status, rescoring, extending timers, or deleting attempts. Phase 13 established this page as read-only monitoring and that must hold.

---

## 31. Individual Result Design

**Purpose:** judge one candidate. **Goal:** read the total, understand the section profile — especially Section 7 — and audit individual answers.

This page has the strongest existing structure; the plan refines rather than restructures.

**Layout:** single column, max-width 960px.

### Header

Breadcrumb (`Attempts / Result`, preserving `?back=`), page title, secondary "Export result CSV" (only when scored — existing behavior).

### Candidate summary card

Name (`title`), email and mobile beneath. **Mismatch handling:** when `enteredName`/`enteredEmail` differ from the registration, show them in a `warning`-tinted inline row labelled "Entered at start" — currently correct behavior, needs clearer visual treatment.

### Attempt summary card

Status badge, Started, Submitted, Scored, Duration setting, and Attempt ID in `mono` with a "copy" icon button (useful for support). Presented as a definition grid, two columns.

### Score block

The visual anchor. Large `score-lg` total with `/ 70.00` in `title` `text.muted`, on a `bg.subtle` panel.

### Section breakdown

All 8 sections as a compact table: section number + name, achieved, max, and a thin proportion bar (`primary.subtle` track, `primary.base` fill). The bar is a **readability aid on an exact number, not a chart** — it stays if it helps scanning and should be dropped if it ever reads as decoration.

**Section 7 gets explicit emphasis** (requirements: "our key hiring signal", audit problem 29): its row carries a `primary.subtle` background and a small "Key hiring signal" annotation. Section 8 shows `0.00 / 0.00` with a `neutral` "Not scored" chip.

### Question review

Fixes audit problem 30 by adding orientation without adding features:

- A **sticky section rail** (or, more simply, a section jump strip under the "Question review" heading) listing Sections 1–8 with each one's score, anchoring to that section. Pure in-page navigation, no new data.
- Section heading shows section number, name, and score.
- **Question card:** number + section chip + result badge + marks (right, tabular) on one line; question text; code block in `mono` on `bg.subtle`; options in **stored shuffled order** with the correct option `success`-tinted, the candidate's wrong choice `danger`-tinted, and both labelled in words ("Correct answer", "Candidate answer") — never color alone; then candidate answer / correct answer / explanation in a definition grid. All from the snapshot.

**Section 7 review:** the lesson renders **once** per lesson group in a distinct `primary.subtle` panel headed "Lesson group 1", with its three questions nested beneath and visually tied by a left border running down the group. This preserves the existing correct grouping while making the association explicit.

**Section 8 review:** no options, no correct answer, no correctness. Just the question, the candidate's text answer in a `bg.subtle` block preserving whitespace exactly, and a `neutral` "Not scored" badge. "Not answered" in `text.muted` when empty.

**In-progress and scoring-pending states:** keep the current behavior exactly — metadata only, plus a `warning`/`info` Alert explaining why there is no review. **Never render the answer key for an in-progress attempt.** This is a security property established in Phase 14, not a visual choice.

**Do NOT add:** overriding scores, editing answers, adding notes/comments, candidate comparison, printing-optimized layout (unless requested), or a share link.

---

## 32. Settings Design

**Purpose:** configure the exam and control whether it is open. **Goal:** change a value safely and understand what is *not* changeable.

**Layout:** single column, max-width 720px, two clearly different regions (fixing audit problem 32).

### Region 1 — Editable settings (a form card)

- **Exam name** — text.
- **Duration** — number with a "minutes" suffix, helper "Applies to attempts started after the change. Attempts already running keep their original deadline." (true — timing is computed from `startedAt` + current duration; *verify this wording against `computeTiming` before shipping the copy*).
- **Difficulty mix** — three percentage fields in a row with a live total indicator that turns `danger` when ≠ 100, plus helper "Papers already generated are not affected."
- Primary "Save settings" + inline success/error alert.

### Region 2 — Exam availability (its own card)

The open/closed control deserves separation from routine fields (audit problem 33). A **toggle** with a large status badge showing the current state, and helper text spelling out the consequence: *Open* — "Eligible candidates can start the exam."; *Closed* — "Candidates cannot start. Attempts already in progress continue."
Switching **to Open** requires an inline confirm ("Open the exam?") because it admits candidates; switching to Closed applies directly (the safe direction).

### Region 3 — Fixed exam structure (read-only, visually distinct)

`bg.inset` panel, no card affordance, headed "Exam structure (fixed)" with a lock icon, and the sentence already present: the shape of the paper is fixed by the specification and enforced in code. The existing 8-row table (section, questions, marks each, total, scored) plus totals **55 questions / 70 marks**. Muted styling throughout so it can never be mistaken for a form.

**Requirements note:** Screen D lists "how many questions to draw per section" and "marks per section" as editable. The implementation deliberately made these fixed domain rules in `exam-blueprint.ts` (a decision approved in Phase 6). The design must therefore present them as **fixed**, and the section explains why. *Flagged in §19 so the divergence stays a conscious, approved choice.*

---

## 33. CSV Export UX

Two exports exist; both are plain authenticated GET downloads.

**Summary export (Attempts page):** a secondary "Export CSV" button in the page header carrying the current filters (already implemented). Helper text beside it — "Exports every attempt matching the current filters" — so nobody assumes it exports only the visible page. On click the browser downloads directly; no loading state is needed because the response is immediate. If the filtered set is empty, the button stays enabled (a header-only CSV is valid and expected).

**Detailed export (Result page):** secondary "Export result CSV" in the page header, **rendered only for scored attempts** (already implemented). For in-progress and scoring-pending attempts the button is **absent, not disabled** — a disabled button invites hovering to find out why, and the surrounding state card already explains the situation.

**Do NOT add:** column pickers, format options (XLSX/PDF), scheduled or emailed exports, export history, or a progress modal. None exist, and the requirements exclude email.

---

## 34. Page Implementation Order

Ordered by dependency, then by value. Each step is one approval unit.

| # | Step | Why here |
|---|---|---|
| **1** | **Design foundation + Admin shell** | Tokens in `globals.css` (or a Tailwind theme) plus `app/admin/layout.tsx`, sidebar, header, mobile drawer, `PageHeader`, the `ToastProvider` (mounted once in the layout), and the `ui/` primitives every later page consumes. Nothing else can be consistent until this exists. Also the single highest UX win (persistent navigation). |
| **2** | **Admin Login** | Small, isolated, outside the shell, exercises Field/Button/Alert on a low-risk page. A safe first real validation of the system. |
| **3** | **Attempts** | Moved *up* from the suggested order. It is the highest-traffic page, it exercises Table + Badge + ScoreCell + FilterBar + Pagination + EmptyState all at once, and it is where the correctness rules (three scoring states) matter most. Proving the table system here de-risks Questions and Candidates. |
| **4** | **Question Bank** | Second table page; reuses everything from step 3 and adds the difficulty/status chips. |
| **5** | **Candidates** | Simplest table; should be nearly free after steps 3–4. |
| **6** | **Individual Result** | Largest single page. Benefits from badges and cards settled in earlier steps. |
| **7** | **Question Editor** | Deepest form work; needs the Field/fieldset system proven on Login and Settings-adjacent work. |
| **8** | **Question Import** | Most bespoke flow (stepper, drop zone, error grouping). Deliberately late so the system is stable first. |
| **9** | **Settings** | Small but needs the toggle + read-only panel treatments; low traffic, so late is fine. |
| **10** | **Overview / Dashboard** | **Last**, deliberately. It reuses presentation from Attempts and Settings, and the readiness widget depends on a backend query that does not exist yet — building it last avoids blocking the track on a new query. |
| **11** | **Global states** | `loading.tsx` / `error.tsx` / `not-found.tsx` per admin route, once every page's real layout is known so skeletons can match it. |
| **12** | **Consistency pass** | Cross-page audit against §40, removing any drift introduced along the way. |

**Deviation from the suggested order and why:** Attempts is promoted above Question Bank (highest traffic + hardest correctness rules, so the table system is proven where it matters most), and Dashboard is demoted to last (it depends on other pages' patterns and on a not-yet-existing query, so building it early would either block the track or invent placeholder data).

---

## 35. Design Tokens

Proposed structure. **Not implemented.** Would live as CSS custom properties in `globals.css` under Tailwind v4's `@theme`, which the project already uses.

```
color.bg.page / surface / raised / subtle / inset
color.border.default / strong / focus
color.text.primary / secondary / muted / disabled / inverse
color.primary.base / hover / active / subtle / border
color.status.success.fg|bg
color.status.warning.fg|bg
color.status.danger.fg|bg
color.status.info.fg|bg
color.status.neutral.fg|bg

space.1 … space.12                    (4 8 12 16 20 24 32 40 48 64)

radius.sm / md / lg / full            (4 6 8 9999)

shadow.none / sm / md / lg

font.family.sans / mono
font.size.display / title / heading / subheading / body / secondary
          / label / helper / badge / mono / score-lg / score-sm
font.weight.regular / medium / semibold        (400 / 500 / 600)
font.leading.tight / normal / relaxed

layout.sidebar.width          240px
layout.sidebar.rail           56px
layout.header.height          56px
layout.content.max.table      1280px
layout.content.max.page       960px
layout.content.max.form       720px
layout.row.height             48px

breakpoint.xs / sm / md / lg / xl   0 / 480 / 768 / 1024 / 1440
                                   (matches §20; note sm=480, not
                                    Tailwind's default 640 — override it)
layout.touch.target.min            44px   (below md)
layout.drawer.width                280px  (mobile nav drawer)
layout.topbar.height               56px   (below md, replaces sidebar)

motion.fast / base            120ms / 180ms
motion.ease                   cubic-bezier(0.2, 0, 0, 1)
```

Rule: **page files reference tokens only.** A raw hex or an off-scale spacing value in a page file is a review failure (§40).

---

## 36. What Must NOT Be Added

Functionality that does not exist and must not be implied by design:

- Question analytics, difficulty statistics, pass rates, score distributions, averages, or any chart of exam outcomes (**explicitly out of scope in the requirements**).
- Candidate accounts, passwords, or a candidate-facing result page (**out of scope**).
- Email sending, notifications, or alerts to candidates (**out of scope**).
- Webcam, screen recording, tab-switch detection, or proctoring (**out of scope**).
- Bulk question actions, question deletion, duplication, or version history.
- Attempt editing, answer overrides, manual rescoring, status changes, timer extension, or attempt deletion.
- Candidate creation/editing/merging.
- Global search, command palette, saved views, or user preferences.
- Multi-admin roles, permissions, or an audit log.
- XLSX/PDF export, scheduled exports, or export history.
- Onboarding tours, tooltips-as-help-system, or empty-state illustrations.
- Any "recently viewed", "favorites", or personalization feature.

Visual patterns to avoid:

- Decorative statistic cards that exist to fill space.
- Gradients, glassmorphism, heavy shadows, or card hover-lift.
- More than one primary button per page region.
- Multiple table styles or multiple button styles across pages.
- Icon-only actions without accessible labels.
- Animated counters or progress bars implying live activity.

---

## 37. User Side Boundary

**The candidate-facing side is entirely out of scope for this design track.** Untouched routes and files:

- `app/exam/page.tsx`, `app/exam/loading.tsx`
- `app/exam/start/page.tsx`
- `app/exam/exam-shell.tsx`, `question-display.tsx`, `question-grid.tsx`, `exam-timer-display.tsx`, `submit-dialog.tsx`, `completion-screen.tsx`, `use-autosave.ts`, `actions.ts`
- `app/page.tsx` (public landing), `app/layout.tsx`
- `lib/exam/**` (candidate DTO, timer, autosave, finalization, scoring)

Shared surfaces to treat carefully: `app/globals.css` and `app/layout.tsx` are shared by both sides. Introducing admin tokens there must be **additive** — adding custom properties, not changing the existing `--background`/`--foreground` behavior the candidate UI relies on. If the token work would visibly change the candidate pages, it must instead be scoped under an admin-only wrapper class. *Flagged in §19.*

Nothing in this plan alters candidate behavior, the exam interface, the timer, autosave, submission, or scoring. The candidate design phase will be started only on explicit instruction.

---

## 38. Functionality Preservation Checklist

Every redesigned page must still do all of this. Verify per page before approval:

**Auth**
- [ ] `requireAdmin()` runs before any data access on every admin page and export route
- [ ] Unauthenticated access redirects to `/admin/login` with no data in the response
- [ ] Login sets the session; logout clears it
- [ ] Already-authenticated users hitting `/admin/login` redirect to `/admin`

**Question Bank**
- [ ] Search by ID / question / topic
- [ ] Filters: section, difficulty, status, active, scored, page size
- [ ] Pagination with URL parameters
- [ ] "Open" navigates to the editor

**Question Editor**
- [ ] All fields load and save; ID stays immutable
- [ ] Field-level validation errors render
- [ ] Activate / deactivate with inline confirmation
- [ ] Editing does not affect historical attempt snapshots

**Import**
- [ ] Upload → validate → preview → confirm → summary
- [ ] Row-level validation errors listed with row numbers
- [ ] Transactional import (all-or-nothing)
- [ ] Post-import summary with per-section and per-difficulty counts

**Candidates**
- [ ] Search by name / email / mobile (case-insensitive)
- [ ] Attempt count per candidate
- [ ] "View attempts" links to the filtered attempts page
- [ ] Pagination

**Attempts**
- [ ] Search, status filter, scoring filter, candidate filter, sort allowlist, pagination
- [ ] Unknown candidate id yields zero rows (never the whole table)
- [ ] Three scoring states rendered distinctly; no `0.00` for unscored
- [ ] "View result" only for finalized attempts
- [ ] Export CSV carries the current filters

**Result**
- [ ] Candidate + attempt summary, entered-detail mismatch flagged
- [ ] Total and all 8 section scores from persisted columns
- [ ] All 55 questions in `displayOrder`, options in stored shuffled order
- [ ] Correct/wrong/unanswered/unscored distinguished
- [ ] Section 7 lesson shown once per group with its 3 questions
- [ ] Section 8 text preserved exactly, no correctness shown
- [ ] In-progress exposes no answer key; scoring-pending shows no score
- [ ] Export result CSV only for scored attempts
- [ ] `?back=` filter preservation still works

**Settings**
- [ ] Exam name, duration, open/closed, difficulty mix all editable and validated
- [ ] Difficulty mix must total 100
- [ ] Fixed blueprint displayed read-only
- [ ] Exam remains CLOSED unless deliberately changed

**Cross-cutting**
- [ ] No page performs a write during a read
- [ ] No candidate-facing file imports admin modules
- [ ] Lint, type-check, build pass
- [ ] Existing Phase 1–15 tests still pass

---

## 39. Per-Page Approval Workflow

```
DESIGN SPEC (this document, section for the page)
        ↓
IMPLEMENT ONE PAGE  ← one page only, no unrelated refactors
        ↓
RUN TESTS  (existing suites + the page's functionality checklist)
        ↓
LINT / TYPE-CHECK / BUILD
        ↓
VISUAL REVIEW  (render the page; check 1440 / 1024 / 768 / 375px)
        ↓
USER APPROVAL  ← explicit; never assumed
        ↓
NEXT PAGE
```

Rules for every implementation request:

1. **One page per request.** Never redesign two pages in one pass.
2. **No backend, schema, route, or business-logic changes.** If a design needs new data, stop and report it as a blocked item.
3. **No new dependencies** without explicit approval (this includes the icon library).
4. **Reuse the design system.** A new one-off component needs a stated reason.
5. **Inspect the rendered page**, not only the source.
6. **Verify every state** — default, loading, empty, error, and any page-specific state.
6a. **Verify every width** — 1440 / 1024 / 768 / 375px. A page is not done until the phone layout works, not merely fits.
7. **Fix drift before moving on.** Inconsistency compounds.
8. **Report honestly**: what was implemented, what was skipped, what broke.
9. **Wait for explicit approval** before the next page. Never auto-continue.

---

## 40. Final Design QA Checklist

Run after each page implementation.

**Visual**
- [ ] Clear primary/secondary/muted text hierarchy in every block
- [ ] Content aligns to a consistent left edge; numbers right-aligned and tabular
- [ ] All spacing from the scale; no arbitrary values
- [ ] Only the three approved font weights; no size outside the type scale
- [ ] Color only from tokens; status color always paired with a text label
- [ ] One primary action per page region
- [ ] Table style, button style and field style identical to other pages
- [ ] Density comparable to the rest of the panel

**UX**
- [ ] The page's main action is obvious within three seconds
- [ ] Every action gives feedback (loading, then success or error)
- [ ] Toast vs Alert used per §16 — no error the admin must act on is toast-only
- [ ] Toasts announce via a live region that exists before the toast does; focus is never stolen
- [ ] Toast timer pauses on hover/focus; errors do not auto-dismiss
- [ ] Errors say what happened and what to do; no raw database text
- [ ] Destructive/consequential actions require confirmation
- [ ] Filters and pagination remain URL-driven and shareable
- [ ] Truncated content is inspectable by keyboard as well as mouse

**Responsive** — check all four widths, every page
- [ ] **1440px:** no excessive line lengths, content capped, layout does not sprawl
- [ ] **1024px:** full layout intact, sidebar 240px, all table columns present
- [ ] **768px:** sidebar rail or drawer, filters wrapped, reduced column set — nothing squeezed
- [ ] **375px:** drawer nav, tables render as stacked record cards, filters behind a disclosure with active-filter chips still visible
- [ ] Body never scrolls horizontally at any width (only import preview / blueprint containers may)
- [ ] No functionality removed at any breakpoint — filter, sort, paginate, export, edit all reachable on a phone
- [ ] Score keeps its three-state rule on every width; never `0.00` for unscored
- [ ] Touch targets ≥44×44px below `md`, with adequate spacing between adjacent targets
- [ ] No hover-only affordance — everything reachable by tap and by keyboard
- [ ] Mobile keyboard matches the field (`inputMode` / `type` correct)

**Accessibility**
- [ ] Full keyboard traversal in visual order; visible focus everywhere
- [ ] One `<h1>`, headings in order, landmarks present
- [ ] Every control labelled; errors associated via `aria-describedby`
- [ ] Status never conveyed by color alone
- [ ] Text contrast ≥ 4.5:1 (≥ 3:1 for large text and UI borders)
- [ ] Icon-only controls carry `aria-label`
- [ ] `prefers-reduced-motion` respected

**Engineering**
- [ ] No functionality removed (checked against §38)
- [ ] No new dependency added without approval
- [ ] No component abstracted for a single use
- [ ] No duplicated class-string constants reintroduced
- [ ] No client-side authorization assumptions; `requireAdmin()` intact
- [ ] No writes on read paths
- [ ] Lint, type-check, build all pass
- [ ] Existing tests pass

---

## Appendix A — Backend work implied by this plan

None of this is implemented. Each item is optional and must be approved separately.

| Item | Needed for | Status |
|---|---|---|
| Grouped count of ready+active questions by section | Dashboard readiness widget | **Future / not currently supported** |
| Grouped count of candidates sharing a mobile | Candidates duplicate-mobile badge (requirements' stated weak point) | **Future / not currently supported** |
| Time taken (`submittedAt − startedAt`, or populating the unused `durationSeconds` column) | Attempts "Time taken" column named in the requirements | **Future / not currently supported** |
| `app/admin/layout.tsx` | The admin shell + `ToastProvider` mount | Required by step 1 of the implementation order |
| `ToastProvider` / `useToast` (hand-authored, no dependency) | §16 toast system — **approved by project decision** | Required by step 1 |
| `loading.tsx` / `error.tsx` / `not-found.tsx` under admin routes | §17 states | Required by step 11 |
| Icon library (`lucide-react`) or hand-authored SVGs | §22 | Needs approval |

## Appendix B — Requirements divergences to keep visible

| Requirement | Implementation | Design response |
|---|---|---|
| "How many questions per section" and "marks per section" editable (Screen D) | Fixed in `exam-blueprint.ts` (Phase 6 decision) | Presented as a locked, read-only structure panel with an explanation |
| Attempts table column "Time taken" (Screen B) | Not computed anywhere | Column omitted; listed in Appendix A |
| "Filter by date" (Screen B) | Not implemented | Not designed; would need a new filter parameter |
| "Sortable by score" (Screen B) | Implemented (`score_desc` / `score_asc`) | Kept in the Sort select |
| "Section 7 score highlighted separately" (Screen C) | Rendered like any other section | **Addressed** — §31 gives Section 7 explicit emphasis |
| "No mobile-responsive design (office PCs only)" | Pages are desktop-only in practice | **Superseded by project decision.** Full responsive support is now required on every device; tables become stacked record cards below 768px and no functionality is dropped at any width (§20) |
