# ELOquence

Competitive Wordle with deep analytical game analysis. Track your skills through an ELO-based ranking system with information-theory-powered post-game insights.

## Features

### Game Modes
- **Competitive** — ELO-ranked matches against an expanded word pool (~5,500 words). Timer-tracked with time factor influencing ELO delta.
- **Practice** — Unrated games with a setup screen for custom word filters, DB-backed progression, and localStorage persistence.
- **Daily Challenge** — Shared daily target word for all players.

### ELO Rating System
- Skill-based ranking adapted from chess ELO, accounting for accuracy, word difficulty, solve time, and number of guesses.
- **Placement phase** — First 5 games use a boosted K-factor for rapid calibration.
- **Immutable ELO** — Deleting game history preserves your rating; players cannot manipulate their ELO.
- **Rating tiers** — Novice, Veteran, Master, Grandmaster with distinct color badges.

### Information-Theory Analysis Engine
Every completed game receives a full post-game breakdown:
- **Move classifications** — Brilliant, Best, Good, Okay, Inaccuracy, Mistake, Blunder, Miss, Forced (chess-inspired).
- **Shannon entropy** — Bits of information gained per guess vs. the optimal guess at each position.
- **Pattern distribution** — Interactive histogram showing all possible outcomes for each guess, with click-to-reveal word lists per bucket.
- **Letter heatmap** — Positional letter frequency across remaining candidates, filtered to relevant letters only.
- **Constraint tracking** — Detects when a player ignores known green/yellow/gray constraints.
- **Trap detection** — Identifies endgame traps (e.g., _IGHT trap: FIGHT, LIGHT, MIGHT, NIGHT, RIGHT, SIGHT, TIGHT, WIGHT).
- **Strategic patterns** — Higher-level pattern recognition (green chasing, elimination play, etc.).
- **Luck factor** — Measures how much actual information exceeded expected information per guess.
- **Top picks** — Shows the 15 best guesses ranked by entropy at each game state.

### Visual Effects
- **Guess wave effect** — WebGL radial ripple emanating from the board on guess submission, color-blended from the pattern result (green/yellow/gray).
- **Tile animations** — Flip-reveal with staggered timing per letter.

### Learn Page
Comprehensive educational content covering:
- How Wordle works (rules, patterns, tile colors)
- Information theory basics (entropy, bits, optimal play)
- ELO rating system (origin in chess, mathematical formula, adaptation for Wordle)
- Move classification system explained with examples
- How to read the review page (analysis walkthrough)

### Dashboard & Leaderboard
- **Dashboard** — ELO history chart, recent games with accuracy scores, placement badges, streaks.
- **Leaderboard** — Global ranking with rating tiers, sortable by ELO, games played, or accuracy.
- **Admin panel** — User management for administrators.

### Other
- Keyboard arrow-key navigation on the review page (Left/Right to cycle moves, 1-6 to jump).
- Responsive dark-themed UI inspired by Wordle's visual language.
- Share game results with a single click.

## Tech Stack

**Frontend:**

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + Framer Motion for animations
- WebGL shaders (guess wave effect)
- ELK.js for game-state graph layout

**Backend:**

- FastAPI + SQLAlchemy (async) + PostgreSQL
- Alembic for database migrations
- NumPy-backed pattern matrix for O(1) entropy lookups
- Dual word pools: standard (2,309) and competitive (~5,500)

**Deployment:**

- Docker Compose (frontend, backend, database)

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local frontend development)
- Python 3.11+ (for local backend development)

### Run with Docker Compose

```bash
# Copy environment template
cp .env.example .env

# Start all services
docker-compose up --build
```

The app will be available at `http://localhost:3000`.

### Local Development

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

**Backend:**

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload
```

## Project Structure

```
ELOquence/
├── frontend/                 # Next.js 14 app
│   ├── app/                  # App Router pages
│   │   ├── game/[id]/        # Game board
│   │   ├── review/[id]/      # Post-game analysis
│   │   ├── learn/            # Educational content
│   │   ├── dashboard/        # Player stats
│   │   ├── leaderboard/      # Global rankings
│   │   └── settings/         # Account settings
│   ├── components/           # Shared components
│   │   ├── PatternHistogram  # Interactive pattern distribution
│   │   ├── LetterHeatmap     # Positional letter frequencies
│   │   ├── GuessWaveEffect   # WebGL ripple shader
│   │   ├── GameOverModal     # End-of-game summary + ELO delta
│   │   └── CoachChat         # AI coaching chat
│   └── lib/                  # Types, API client, hooks
├── backend/
│   ├── app/
│   │   ├── analysis/         # Information-theory engine
│   │   │   ├── engine.py     # Pattern matrix, entropy, optimal guess
│   │   │   ├── classifier.py # Move classification logic
│   │   │   ├── constraints.py# Green/yellow/gray constraint tracking
│   │   │   ├── traps.py      # Endgame trap detection
│   │   │   └── patterns.py   # Strategic pattern recognition
│   │   ├── routers/          # API endpoints
│   │   ├── services/         # ELO calculation, game logic
│   │   ├── models/           # SQLAlchemy models
│   │   └── schemas/          # Pydantic request/response schemas
│   ├── data/                 # Word lists (answers, competitive, valid guesses)
│   └── scripts/              # Seed users, word selection utilities
└── docker-compose.yml
```

## Database

Migrations are managed with Alembic. After pulling changes:

```bash
cd backend
alembic upgrade head
```

## License

Proprietary. Created as a thesis project at FER (Faculty of Electrical Engineering and Computing, University of Zagreb).
