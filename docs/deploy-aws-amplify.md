# Deploying to AWS Amplify

CloudUS is a standard Next.js 16 SSR app (Prisma + Supabase Postgres,
cookie-session admin auth) — no static export, no special Amplify
adapter needed. Amplify's Next.js SSR compute handles it natively via
[amplify.yml](../amplify.yml) at the repo root.

## 1. Push to a Git provider
Amplify builds from GitHub/GitLab/Bitbucket/CodeCommit. Push this repo there
first if it isn't already (this repo currently has no git remote — set one
up, e.g. a private GitHub repo, before continuing).

## 2. Create the Amplify app
1. AWS Console → **Amplify** → **Create new app** → **Host web app**.
2. Connect the Git provider, authorize, pick the repo and branch (e.g. `main`).
3. Amplify auto-detects `amplify.yml` at the repo root — confirm it's used
   (Build settings step shows the same content as the file in this repo).
4. **App settings → General → Framework**: should auto-detect "Next.js - SSR".
   If it shows "Next.js - SSG", the build will fail to run server code —
   switch it manually under App settings → Build settings.

## 3. Environment variables
App settings → **Environment variables** → add each of these (copy exact
values from local `.env` — never commit `.env` itself):

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Pooled Supabase connection string, used at runtime |
| `DIRECT_URL` | Direct (non-pooled) connection, used for migrations |
| `SUPABASE_URL` | |
| `ADMIN_EMAIL` | Bootstrap admin login |
| `ADMIN_PASSWORD` | Bootstrap admin login — rotate from the local dev value before going live |
| `GOOGLE_APPS_SCRIPT_SECRET` | Shared secret with the Apps Script sync — see [google-form-sync.md](google-form-sync.md). Reuse the local value or generate a fresh one; must match what's pasted into Apps Script's Script Properties either way |

Do not reuse `ADMIN_PASSWORD` from local dev in production — set a new,
strong value here.

## 4. Run database migrations (manual, before first deploy)
Amplify's build container should never run `prisma migrate deploy`
automatically — a bad migration on every push is too dangerous. Run it by
hand from a local machine pointed at the production database instead:

```
DATABASE_URL="<prod DIRECT_URL>" npx prisma migrate deploy
```

Use `DIRECT_URL` here, not the pooled `DATABASE_URL` — migrations need a
direct connection. Re-run this manually any time a new migration is added,
before (or right after) deploying the code that depends on it.

## 5. Deploy
Trigger the first build (Amplify does this automatically after connecting
the repo, or click **Run build**). Watch the build log for:
- `npm ci` — install
- `npx prisma generate` — generates the Prisma client (also runs via
  `postinstall`, kept explicit here as a safety net)
- `npm run build` — Next.js production build

## 6. Post-deploy checks
1. Visit the Amplify-assigned domain (or your custom domain once attached)
   → `/admin/login` → sign in with `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
2. `/admin/settings` → confirm exam settings load and save.
3. Confirm the exam start flow works end-to-end with a test candidate.

## 7. Custom domain (optional)
App settings → **Domain management** → add domain → follow the DNS
verification steps Amplify gives you (CNAME/ALIAS records at your
registrar).

## 8. Still pending after this
- **Google Form sync** — needs the real domain pasted into the Apps Script
  (`Code.gs` line with `YOUR-DOMAIN`). See [google-form-sync.md](google-form-sync.md).
- **Auto-submit on deadline while browser is closed** — deliberately not
  built yet (client asked to confirm scope first). When ready, ask to have
  the `/api/cron/sweep-attempts` endpoint rebuilt and wired to an EventBridge
  Scheduler rule, since Amplify has no built-in cron for SSR apps.
