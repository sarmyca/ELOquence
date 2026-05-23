# ELOquence

> Competitive Wordle with a chess-engine-grade move analyzer, ELO ladder, and AI coach.

**Live:** https://el-oquence.vercel.app

ELOquence wraps Wordle in the parts chess.com has — a rating that swings on every game, a post-game review that scores each move against the information-theoretically optimal one, a Duolingo-style trainer, and a Gemini-powered coach you can ask follow-up questions.

---

## Features

**Three modes** — Daily (one shared puzzle, drives the streak), Competitive (5,500-word pool, only mode that moves ELO, first 5 games are placement at 4× K-factor), Practice (unlimited, unrated). Plus shareable Challenge codes and Hard Mode across all of them.

**Post-game review** — Skill + Luck scored per move (0–100), each guess classified (brilliant → blunder) with a Gemini-written 2–3 sentence explanation. Pattern-groups visualisation, your-pick-vs-mine head-to-head, real DB-backed uniqueness analytic (SHA-256 grid fingerprint), ELO projection, and a floating coach modal with the full game state pre-loaded.

**Learn page** — 8 modules, 20 lessons, 9 challenge variants (tile painters, pattern matchers, candidate-pool shrinkers, etc.). Modules unlock progressively; per-lesson cards follow the Wordle colour scheme by completion.

**38 achievements** across 7 categories (solving, accuracy, streaks, rating, variety, mastery, timing). Server-detected, push-notified, with a dedicated `/achievements` page.

**Admin shell** at `/admin` — overview, users/games browsers, full audit log of every mutating admin action.

**Other** — archive (replay any past daily), Web Push notifications with VAPID, PWA install with offline shell, AI response cache keyed on position fingerprint.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 14 App Router · TypeScript · Tailwind · Framer Motion |
| Backend | FastAPI · SQLAlchemy 2.0 async · Pydantic v2 |
| DB | PostgreSQL 16 (Neon serverless in prod, `pgcrypto`) |
| Migrations | Alembic (17 versions, run as Fly `release_command`) |
| LLM | Google Gemini 2.5 Flash via `google-genai` |
| Push | pywebpush + VAPID |
| Hosting | Vercel + Fly.io + Neon (free tier across all three) |

---

## Local development

```bash
cp .env.example .env       # fill JWT_SECRET, GOOGLE_CLIENT_ID/SECRET, GEMINI_API_KEY, VAPID_*
docker compose up --build
# → http://localhost:3000
```

AI coach is optional — leave `GEMINI_API_KEY` empty and LLM endpoints return 503 (the review falls back to its rule-based commentary).

---

## Architecture notes worth knowing

- **Pattern matrix is precomputed.** On first boot the backend builds a `(guesses × answers)` int8 matrix where each cell is the ternary-encoded feedback pattern. ~70 MB in memory, ~10s to load — after that the engine runs entirely against this matrix.
- **`/games/{id}/guess` serialises with `SELECT … FOR UPDATE`** to close a race where concurrent guesses against the same game could extract pattern information without consuming the guess budget.
- **Move fingerprint** is SHA-256 of `UPPER(target) || "|" || comma-joined UPPER guesses`, persisted on completion. The uniqueness analytic is a single indexed `COUNT(*)`.
- **AI cache** — tier-1 (per-move) and tier-2 (game summary) cached 30 days keyed on position state + skill bucket. Identical positions across users share one Gemini call. Tier-3 (chat) is uncached.
- **Step-up auth** on account/game-history deletion requires password (or username confirm for Google-only accounts), so a stolen token can't nuke an account.

---

## License

Proprietary. Thesis project at FER (University of Zagreb).
