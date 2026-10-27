# ELOquence

Competitive Wordle with an ELO ladder, a post-game move analyzer, and an AI coach.

**Live:** https://el-oquence.vercel.app

## What it does

- **Modes:** Daily (shared puzzle and streak), Competitive (the only mode that changes ELO), Practice (unrated), plus challenge codes and Hard Mode.
- **Post-game review:** scores every guess for skill and luck against the information-theoretically optimal guess, labels it from brilliant to blunder, and explains it with Gemini.
- **Learn:** step-by-step lessons and interactive challenges that teach Wordle strategy.
- **Extras:** achievements, leaderboard, daily archive, Web Push notifications, PWA install, admin panel.

## Stack

| | |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind, Framer Motion (Vercel) |
| Backend | FastAPI, async SQLAlchemy 2.0, Pydantic v2 (Fly.io) |
| Database | PostgreSQL 16 + Alembic (Neon in prod) |
| AI | Google Gemini 2.5 Flash |

## Run locally

Create a `.env` file in the repo root:

```env
JWT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GEMINI_API_KEY=        # optional; without it the review uses rule-based commentary
```

Then:

```bash
docker compose up --build
```

Frontend runs on http://localhost:3000, API on http://localhost:8000.

## License

Proprietary. Bachelor's thesis project, FER, University of Zagreb.
