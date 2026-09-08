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
| `ADMIN_EMAIL` | Admin panel account, consumed from Phase 1 onward |
| `ADMIN_PASSWORD` | Admin panel password, consumed from Phase 1 onward |
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

## Scripts

```bash
npm run dev          # start the development server
npm run build        # production build
npm run lint         # ESLint
npm run type-check   # TypeScript, no emit
```

## Project structure

```
app/          routes, layout, error and loading boundaries
components/   shared React components
lib/db/       Prisma client singleton
prisma/       Prisma schema
public/       static assets
types/        shared TypeScript types
```

## Planned

Later phases will add the admin panel and authentication, the question bank with CSV
import, exam settings, randomized paper generation, the candidate exam experience with a
server-side timer and auto-save, resume after interruption, automatic submission and
scoring, results and CSV export, the Google Form candidate sync, and deployment through
AWS Amplify.
