# ELOquence

Competative Wordle with an ELO ladder and information-theory-powered game review.

## Highlights

- **Three modes** — Daily (one shared puzzle per day, unrated, drives your streak), Competitive (unlimited rated games, the only mode that moves your ELO), Practice (unlimited unrated).
- **Hard mode** — Revealed greens/yellows must be reused in subsequent guesses.
- **Archive** — Browse and replay every past daily puzzle. Past dates are lazily seeded so the archive is always playable.
- **Review page** — NYT-WordleBot-style single-column analysis: per-guess Skill/Luck/Words-left/Info-gained, "Your guess vs My pick" with one-sentence verdicts, head-to-head metrics matrix, pattern groups, community card, and a floating Coach for AI deep dives.
- **Engine** — Shannon-entropy scoring, optimal-guess search over a NumPy pattern matrix, move classifications (Brilliant → Blunder), trap and constraint detection, luck factor.
- **ELO** — Chess-style rating with a 5-game placement phase (boosted K-factor), competitive-only, immutable across history deletes. Tiers: Novice → Veteran → Master → Grandmaster.
- **Ambient wave background** — Three blurred radial-gradient blobs behind the board that retint smoothly as you collect greens and yellows. Theme-aware, GPU-only, respects `prefers-reduced-motion`.

## Tech

- **Frontend** — Next.js 14 (App Router), TypeScript, Tailwind, Framer Motion.
- **Backend** — FastAPI + async SQLAlchemy on PostgreSQL, NumPy pattern matrix, Alembic migrations.
- **Deployment** — Docker Compose (`frontend`, `backend`, `db`).

## Quick start

```bash
cp .env.example .env
docker compose up --build
# → http://localhost:3000
```

Local development:

```bash
# frontend
cd frontend && npm install && npm run dev

# backend
cd backend && pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

## Layout

```
frontend/          Next.js 14 app — game, review, dashboard, leaderboard, archive, learn
backend/app/
  analysis/        Entropy engine, classifier, traps, constraints, patterns
  routers/         FastAPI endpoints (auth, games, daily, analysis, leaderboard, …)
  services/        ELO, game flow, profile, achievements, word stats
  models/          SQLAlchemy models
data/              Word lists (2,309 answers · ~5,500 competitive · 15k valid guesses)
```

## License

Proprietary. Thesis project at FER (University of Zagreb).
