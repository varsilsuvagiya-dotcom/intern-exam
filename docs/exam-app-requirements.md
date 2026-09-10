# Cloudus Exam App — Requirement Plan

**What we are building:** a simple online exam app for hiring freshers. Candidates take the exam on office PCs while our team supervises in person. The app draws a different paper for each candidate, auto-saves their answers, and generates results automatically.

**Not building:** heavy anti-cheating, proctoring, webcam monitoring, or candidate accounts. Supervision is done by our staff in the room.

**Stack:** Next.js(Frontend) + Next js(backend) + PostgreSQL. Single developer, end-to-end.

---

## 1. The exam being delivered

Every candidate gets a randomly drawn paper with this fixed structure:

| Section | Topic | Questions | Marks each | Total |
|---|---|---|---|---|
| 1 | Logic & Patterns | 10 | 1 | 10 |
| 2 | Number Reasoning | 6 | 1 | 6 |
| 3 | Programming Fundamentals | 10 | 1 | 10 |
| 4 | Output Prediction | 8 | 1.5 | 12 |
| 5 | Debugging | 6 | 1.5 | 9 |
| 6 | Steps Problem Solving | 4 | 2 | 8 |
| 7 | Learn-and-Apply | 6 (2 lessons × 3) | 2.5 | 15 |
| 8 | Attitude (not scored) | 5 | 0 | 0 |
| | **Total** | **55 items** | | **70 marks** |

**Time:** 75 minutes, one overall timer.

---

## 2. Candidate side — screen by screen

### Screen 1 — Start
Candidate enters:
- Full name (required)
- Email (required)
- Mobile number (required)

Then a "Start Exam" button with a short instruction box:
- 55 questions, 75 minutes
- You can go back and change answers
- Exam submits automatically when time ends
- Do not close the browser

**Important:** the mobile number is how we match this result back to their application form entry. Add a note on screen: *"Please enter the same mobile number you used in the application form."*

### Screen 2 — Exam
Layout:
- **Top bar:** candidate name, section name, countdown timer, "Submit Exam" button
- **Left/main area:** one question at a time
- **Right side:** question grid (1–55) to jump to any question

Question grid colour coding:
- Grey = not visited
- Blue = answered
- White/outline = visited but not answered

Question display:
- Question text
- Code block (if present) in a monospace box with light background
- For Section 7: the lesson text appears above the question in a highlighted box, shown for all 3 questions of that lesson
- 4 options as clickable radio buttons
- Section 8 (attitude): a text box instead of options, clearly marked *"No right or wrong answer"*

Navigation: Previous / Next buttons, plus the grid to jump anywhere.

**Auto-save:** every answer saves to the server the moment it is selected. No "save" button.

### Screen 3 — Submit confirmation
Before submitting, show: *"You have answered X of 55. Unanswered: [list of numbers]. Submit anyway?"* → Confirm / Go back.

### Screen 4 — Done
Simple message: *"Your exam has been submitted successfully. Thank you. Our team will contact shortlisted candidates."*

**No score is shown to the candidate.**

### Auto-submit
When the timer hits zero, the exam submits automatically with whatever is answered.

### Crash recovery
If the browser closes or the PC restarts, the candidate opens the app again, enters the same mobile number, and resumes exactly where they left off — same questions, same saved answers, and the timer continues from real elapsed time (not reset).

---

## 3. Admin side — screen by screen

Simple email + password login. One or two admin accounts is enough.

### Screen A — Question bank
- Upload CSV
- Preview table before confirming import
- Show a summary after import: how many questions added, count per section, count per difficulty
- List view with filters (section, difficulty, status) and a simple search
- Ability to edit or deactivate a single question

### Screen B — Candidates / attempts list
A table of everyone who took the exam:

| Name | Mobile | Started | Submitted | Time taken | Total score | Status |

- Sortable by score
- Filter by date
- Export all to CSV

### Screen C — Individual result
For one candidate:
- Name, mobile, email, date, time taken
- **Total score out of 70**
- **Section-wise breakdown** — each section's score and max, shown as a small table
- **Section 7 score highlighted separately** (this is our key hiring signal)
- **Full question-by-question review:** every question they got, their answer, the correct answer, right/wrong marked clearly, and the explanation
- Their Section 8 attitude answers shown as plain text (no score)

### Screen D — Exam settings
Editable without code changes:
- Duration (default 75 minutes)
- How many questions to draw per section
- Marks per section
- Difficulty mix percentages
- Exam open/closed toggle

---

## 4. How the random draw works

When a candidate starts, the system builds their paper once and saves it. It does not re-draw on refresh.

For each section:
1. Filter the bank to that section, `status = ready`
2. Apply the difficulty mix — roughly 40% easy, 40% medium, 20% hard
3. Pick the required number randomly
4. Shuffle the order of the 4 options for each question

**Section 7 is special:** draw 2 complete lessons (using `lesson_group`), and include all 3 questions of each lesson. Keep them together and in order — do not shuffle Section 7 questions across lessons.

Section order on the paper stays fixed 1 → 8 so every candidate has the same experience.

---

## 5. How scoring works

Runs automatically the moment the exam is submitted.

- For each answered question, compare the candidate's choice to the `correct` column
- If correct, add that question's `marks`
- Wrong or unanswered = 0 (**no negative marking**)
- Skip Section 8 entirely — stored, never scored
- Save: total score, per-section scores, and every individual answer

---

## 6. CSV import format

Same 19 columns as the existing "Cloudus Exam Question Bank" sheet:

```
id, section, topic, difficulty, question, code_block,
option_a, option_b, option_c, option_d, correct, explanation,
lesson_text, lesson_group, scored, marks,
ai_verified, trainer_verified, status
```

Import rules:
- Only rows with `status = ready` are imported as active
- `id` must be unique — if it already exists, update that row instead of creating a duplicate
- Reject the file with a clear error message if columns are missing or `correct` is not a/b/c/d
- Show the preview before writing anything to the database

---

## 7. Simple data model

**questions** — all 19 CSV columns, plus `is_active`

**candidates** — id, name, email, mobile, created_at

**attempts** — id, candidate_id, started_at, submitted_at, duration_seconds, total_score, status (in_progress | submitted | auto_submitted)

**attempt_questions** — id, attempt_id, question_id, section, display_order, shuffled_option_order, marks

**answers** — id, attempt_id, attempt_question_id, selected_option (a/b/c/d), text_answer (for Section 8), is_correct, marks_awarded, answered_at

That's five tables. Nothing more is needed.

---

## 8. Build order

Suggested sequence so something usable exists early:

1. Database tables + admin login
2. CSV import with preview
3. Question list and edit screen
4. Candidate start screen + paper draw logic
5. Exam screen — questions, options, navigation grid, timer
6. Auto-save + resume
7. Submit + auto-submit on timeout
8. Auto-scoring
9. Admin results list + individual result view
10. CSV export of results
11. Exam settings screen

**Test before the real exam:** run a full mock attempt end-to-end (this doubles as your calibration pilot with the juniors), and open the app on 8–10 PCs at once to confirm it holds under real load.

---

## 9. Basic safeguards (light, since we supervise in person)

Only these — nothing elaborate:
- Exam opens in full screen
- Right-click and text selection disabled on the exam page
- Timer is calculated server-side, so refreshing the page cannot reset it
- One active attempt per mobile number — cannot start a fresh paper after submitting

Our 3–4 supervisors in the room handle everything else.

---

## 10. Deliberately NOT in scope

To keep the build small and fast:
- No candidate accounts or passwords
- No webcam, screen recording, or tab-switch detection
- No email sending from the app
- No candidate-facing result page
- No question analytics or difficulty statistics
- No mobile-responsive design (office PCs only — desktop layout is enough)

---

## One thing to watch

Because candidates type their own name and mobile, expect typos and duplicates. Two safeguards:
1. On the start screen, ask clearly for the **same mobile number used in the application form**
2. In the admin candidate list, flag any mobile number that does not match an entry in your application sheet, so you can correct it manually before shortlisting

This is the only real weak point of self-entry, and a supervisor glancing at the screen as each candidate starts will catch most of it.
