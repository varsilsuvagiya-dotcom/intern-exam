# CloudUS

CloudUS is an online examination system used to assess fresher candidates during hiring.
Candidates take the exam on supervised office machines; results are produced automatically
for the hiring team.

This repository currently contains **Phase 0** only: the project foundation.
No exam, admin, or candidate functionality has been implemented yet.

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

No business models are defined yet; they arrive in later phases.

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
