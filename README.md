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
| `GOOGLE_APPS_SCRIPT_SECRET` | Shared secret for the candidate sync integration |

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
