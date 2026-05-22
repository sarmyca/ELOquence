# Deploy Guide — Vercel + Fly.io + Neon

Zero-cost path for a low-traffic project. Free tiers cover everything;
worst case you'll pay a few dollars/year for an optional custom domain.

## Stack at a glance

| Layer | Host | Free-tier limit | Cold start? |
|-------|------|-----------------|-------------|
| Frontend (Next.js) | Vercel Hobby | 100 GB egress | no |
| Backend (FastAPI) | Fly.io | 3× shared-cpu-1x 256 MB, auto-stop on idle | ~5-10s on first req after idle |
| PostgreSQL | Neon | 0.5 GB storage, 191 compute-h/mo | ~300 ms cold wake |
| LLM (AI coach) | Google Gemini | 1500 req/day on `gemini-2.5-flash` | n/a |

---

## Step 1 — Neon (database)

1. https://neon.tech → sign up (GitHub OAuth)
2. **Create project** → pick `EU (Frankfurt)` for lowest latency
3. From the project dashboard copy two connection strings:
   - **Pooled** — runtime (`?sslmode=require&pgbouncer=true`)
   - **Direct** — Alembic migrations (no pooler)
4. Map them into Fly secrets later as:
   - `DATABASE_URL`      = `postgresql+asyncpg://…?ssl=require` (replace `sslmode=require` with `ssl=require` for asyncpg)
   - `DATABASE_URL_SYNC` = `postgresql+psycopg2://…?sslmode=require`

> **Note on asyncpg + Neon**: drop `pgbouncer=true` from the pooled URL when
> using asyncpg — it doesn't support session-pooler-style transactions.
> Use the unpooled URL with `ssl=require` for the async runtime, and the
> pooler URL only if you switch to a sync driver later.

---

## Step 2 — Fly.io (backend)

```powershell
# 1. Install once
iwr https://fly.io/install.ps1 -useb | iex

# 2. Sign in
fly auth signup     # or `fly auth login` if you already have an account

# 3. Launch (creates the app, do not deploy yet)
cd backend
fly launch --copy-config --no-deploy
#   ↑ accept the existing fly.toml when prompted
#   ↑ app name: eloquence-api (or yours)
#   ↑ region: fra (Frankfurt)
#   ↑ Postgres: NO (we use Neon)
#   ↑ Redis: NO

# 4. Set every required secret
fly secrets set `
  JWT_SECRET="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')" `
  GOOGLE_CLIENT_ID="…from .env…" `
  GOOGLE_CLIENT_SECRET="…from .env…" `
  GEMINI_API_KEY="…from .env…" `
  VAPID_PUBLIC_KEY="…from .env…" `
  VAPID_PRIVATE_KEY="…from .env…" `
  VAPID_SUBJECT="mailto:you@example.com" `
  DATABASE_URL="postgresql+asyncpg://USER:PASS@HOST/NAME?ssl=require" `
  DATABASE_URL_SYNC="postgresql+psycopg2://USER:PASS@HOST/NAME?sslmode=require" `
  CORS_ORIGINS="https://YOUR-VERCEL-DOMAIN.vercel.app"

# 5. Deploy
fly deploy

# 6. Confirm
fly status
fly logs           # tail the live log
curl https://eloquence-api.fly.dev/health
```

The `release_command = "alembic upgrade head"` line in `fly.toml` runs every
migration before the new image starts taking traffic; if that fails the
old version keeps serving and the bad deploy is aborted.

---

## Step 3 — Vercel (frontend)

1. https://vercel.com → "Import Git Repository" → pick `sarmyca/ELOquence`
2. **Root Directory**: `frontend`
3. **Framework Preset**: Next.js (auto-detected)
4. Environment Variables (Project Settings → Environment Variables):
   - `NEXT_PUBLIC_API_URL` = `https://eloquence-api.fly.dev`
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` = same as Fly's `GOOGLE_CLIENT_ID`
   - `NEXT_PUBLIC_ENABLE_SW` = `1`
5. Deploy

After the first deploy, copy the resulting `https://<project>.vercel.app`
URL and **rerun `fly secrets set CORS_ORIGINS=…`** with that exact URL.
Then `fly deploy` once more so the backend picks up the new CORS allowlist.

---

## Step 4 — Google OAuth redirect URI

In Google Cloud Console → Credentials → your OAuth client, add the prod
redirect URI:

```
https://YOUR-VERCEL-DOMAIN.vercel.app/api/auth/callback/google
```

Leave the dev `http://localhost:3000/api/auth/callback/google` entry there
too so local development keeps working.

---

## Post-deploy smoke checklist

- [ ] `GET https://eloquence-api.fly.dev/health` → 200
- [ ] `GET https://YOUR.vercel.app/` renders (no 500)
- [ ] Sign in via Google — no `redirect_uri_mismatch`
- [ ] Email/password sign up + login works (Fly DB connection alive)
- [ ] Finish a daily game → review page shows AI move commentary
- [ ] Achievements unlock on a fresh account (DB writable)
- [ ] Browser DevTools → no CORS errors on any API call

---

## Costs to expect

For a uni project (≤50 testers over the eval period):

- Neon: **$0** (well under storage + compute caps)
- Fly.io: **$0** while auto-stop stays on
- Vercel: **$0** (Hobby allows commercial use ban; uni eval is fine)
- Gemini: **$0** (free tier; you set a $0 spend cap in the AI Studio console)
- Custom domain (optional): **$10-15/yr** at any registrar

If you want zero cold starts during the demo window, set
`min_machines_running = 1` in `fly.toml` and re-deploy. That keeps one
backend VM hot 24/7 for ~$1.94/mo.

---

## Rollback if something goes wrong

```powershell
# Backend
fly releases             # list past releases
fly deploy --image registry.fly.io/eloquence-api:deployment-XYZ

# Frontend
# In Vercel dashboard → Deployments → click an older successful build → Promote to Production
```

Neon has 7-day point-in-time-restore on the free plan — if a migration
ate something, you can branch from a snapshot before the bad release
and re-point Fly at the recovered branch's connection string.
