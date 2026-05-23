# ELOquence

> Competitive Wordle with a chess-engine-grade move analyzer, ELO ladder, and AI coach.

**Live:** https://el-oquence.vercel.app

ELOquence takes the puzzle you already know and wraps it in the parts chess.com has — a rating that swings on every game, a post-game review that scores each move against the information-theoretically optimal one, a Duolingo-style trainer for the strategy, and a Gemini-powered coach you can ask follow-up questions about your moves.

---

## What's in the box

### Three game modes
| Mode | Word pool | Rated? | Notes |
|------|-----------|--------|-------|
| **Daily** | 2,309 NYT-style answers | No | One shared puzzle a day, drives your streak |
| **Competitive** | 5,500+ word pool | Yes — only mode that moves ELO | First 5 games are placement (4× K-factor) |
| **Practice** | 2,309 standard answers | No | Unlimited, unrated, low pressure |

Plus a **Challenge** mode where you generate a code, share it with a friend, and compete on the same word. Both **standard** and **hard** mode are supported across all modes (revealed letters must be reused in hard mode).

### Post-game review
A multi-step, NYT-WordleBot-style breakdown of every move:

- **Skill** + **Luck** scored separately per move (0–100). Skill measures decision quality vs the optimal entropy choice; Luck measures how kind the board was.
- Each guess gets a classification (**brilliant / best / good / okay / forced / inaccuracy / mistake / blunder**) plus a Gemini-written 2-3 sentence explanation referencing actual numbers (efficiency %, bits lost, remaining candidates).
- **Your guess vs My pick** head-to-head: expected solutions after, actual solutions after, expected steps to solution.
- **Pattern groups** visualisation showing how your guess partitioned the candidate space vs how the optimal one would have.
- **Uniqueness analytic** — real DB-backed "1 in N" count of community members who played the same `(target, guess-sequence)` grid (SHA-256 fingerprint indexed on the games table).
- **ELO distribution** projection — what your rating change would look like across plausible accuracy outcomes.
- **Floating AI Coach** modal — Gemini chat with the full game state pre-loaded so it can answer "why was 4 a mistake" with citations.

### Learn page (Duolingo-style)
Eight modules, 20 lessons total, each broken into 3-6 mini-challenges. Nine challenge variants spread across modules so no mechanic repeats more than 2× per module:

- **TileTap** — tap the tile that goes a specific colour
- **TilePaint** — paint the full pattern given guess + target (trains duplicate-letter rules)
- **MultipleChoice** — pick the best opener / probe / commit move
- **GuessTheNext** — given a game state, choose guess 2
- **WordSurvivors** — constraint filter game (click words that pass)
- **SortIntoBuckets** — classify words into families (-ATCH / -OUND / -IGHT)
- **LetterPicker** — build a probe word on a custom keyboard
- **PoolShrink** — animated dot pool that shrinks per constraint (for the entropy lessons)
- **RevealCard** — narrative beats between challenges

Progression locks later modules until earlier ones are done; per-lesson card colour follows the Wordle convention (gray → yellow → green) based on completed challenge count.

### Achievements (38 across 7 categories)
- **Solving** — Hole in One, Bullseye, Quick Solve, Last Chance, Three Master
- **Accuracy** — Sharpshooter (90%+), Precision (95%+), Perfect Game (100%), Iron Accuracy (5 in a row ≥85%)
- **Streaks** — On Fire (7d), Dedicated (30d), Unstoppable (100d), Daily Devotee (30 dailies), Daily Marathon (100 dailies)
- **Rating** — Veteran, Master, Grandmaster, Upset, Calibrated, Hardword Hunter
- **Variety** — Regular, Centurion (100), Marathon (200), Legend (500), Triathlete, Complete Set, Trendsetter
- **Mastery** (gold) — Brilliant, Flawless, Clean Play, Hardcore, Iron Will, Challenge Master
- **Timing** (bronze) — Speedster (<60s), Blitz (<30s), Early Bird, Night Owl

Detected server-side on game completion, push-notified, surfaced as toasts plus the dedicated `/achievements` page with category filters and Wordle-coloured group progress.

### Admin shell
Separate admin sub-app at `/admin` for accounts with `is_admin=true`. Hard-guarded against player routes — admin sees no ELO, no player nav, just a dedicated shell:

- Overview with large stat cards + 30-day timeseries (games, users, quality)
- Users browser with role / order / search filters
- Per-user detail view with full game history
- Games browser across all users
- Audit log of every mutating admin action (action, target, payload JSONB, ip_address INET)
- System health panel

### Other niceties
- **Archive** — replay any past daily; lazily seeds words for dates that didn't have one
- **Real-time push notifications** via Web Push API + VAPID (challenge results, achievements unlocked, daily reminders, streak warnings)
- **PWA install** with offline shell (cache-first for static assets, network-first for HTML)
- **Service worker** with proper `pushsubscriptionchange` re-subscribe handling
- **AI cache** — Gemini responses keyed on position fingerprint, 30-day TTL, so identical positions across users share one upstream call

---

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | Next.js 14 App Router · TypeScript · Tailwind · Framer Motion | Server components for the static surface, client islands for the gamey bits |
| Backend | FastAPI · SQLAlchemy 2.0 async · Pydantic v2 | Async all the way, type-safe at both edges |
| DB | PostgreSQL 16 (Neon serverless in prod) | `pgcrypto` for the grid-fingerprint hashing |
| Migrations | Alembic | 17 versioned migrations, run as Fly `release_command` |
| LLM | Google Gemini 2.5 Flash via `google-genai` | Free tier covers the project end-to-end |
| Push | pywebpush + VAPID | No third-party push service dependency |
| Hosting | Vercel + Fly.io + Neon | Free tier across all three for a low-traffic project |
| Local dev | Docker Compose | One command and you have frontend + backend + Postgres |

---

## Local development

```bash
cp .env.example .env       # fill in JWT_SECRET, GOOGLE_CLIENT_ID/SECRET, GEMINI_API_KEY, VAPID_*
docker compose up --build
# → http://localhost:3000
```

The compose stack runs a local Postgres so the app boots without any cloud accounts. AI coach is optional — leave `GEMINI_API_KEY` empty and the LLM endpoints quietly return 503 (`MoveExplanation` falls back to its rule-based commentary).

### Running parts independently

```bash
# frontend (hot reload, gates the SW behind NEXT_PUBLIC_ENABLE_SW=1)
cd frontend && npm install && npm run dev

# backend (alembic + uvicorn separately)
cd backend && pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

---

## Repo layout

```
frontend/
  app/
    achievements/           38-achievement grid with category progress
    admin/                  Admin shell (overview / users / games / audit / health)
    archive/                Past dailies grid (replay any past date)
    auth/google/            OAuth callback handler
    challenge/[code]/       Shareable challenge games
    dashboard/              Profile, recent games, ELO chart
    faq/                    9 sections, accordion entries, searchable
    game/[id]/              The board itself + abandon-on-exit logic
    learn/                  Duolingo-style trainer (8 modules · 20 lessons)
      _components/
        challenges/         9 challenge variants + LessonRunner + ScrollArea
      _lessons/             Per-module lesson configs (data-only)
    leaderboard/            Global ELO ranking + tier filter
    play/                   Mode picker, daily-state badge, challenge create
    review/[id]/            Post-game analysis (5+ steps, AI per-move commentary)
    settings/               Push prefs, hard mode, theme, account deletion
  components/
    ScrollArea.tsx          Custom auto-hide thumb (Chromium can't animate native)
    Archive.tsx             Calendar grid, equidistant legend
    CoachChat.tsx           Floating Gemini coach with conversation history
    AchievementToast.tsx    Slide-in unlock notifications
    Navigation.tsx          Auth-gated top bar with role-based redirect
    admin/*                 Charts (TimeSeries, Donut, Histogram, StatCardLg)
  lib/
    api.ts                  Axios client + endpoint helpers
    push.ts                 Service worker subscribe/unsubscribe flow
    hooks/useAuth.tsx       JWT bearer + /auth/me caching
backend/app/
  analysis/                 Pattern matrix, entropy, classifier, traps, constraints
  routers/                  64 endpoints across 13 routers
  services/                 ELO update, game flow, profile, achievements,
                            word stats, AI coach, push fan-out, audit logging,
                            grid uniqueness, rate limit, word difficulty
  models/                   SQLAlchemy ORM
  cli/                      generate_vapid, seed_admin
backend/data/               Word lists: 2,309 standard answers · ~5,500 competitive
                            pool · 15k valid guesses
backend/alembic/versions/   17 migrations (latest: games.move_fingerprint backfill)
```

---

## Architecture notes worth knowing

- **Pattern matrix is precomputed**. On first backend boot we build a `(guesses × answers)` int8 matrix where each cell is the ternary-encoded feedback pattern. ~70 MB in memory, ~10s to load. After that the engine runs entirely against this matrix — no per-move re-derivation, no Python loops in the hot path.
- **`/api/games/{id}/guess` serialises with `SELECT ... FOR UPDATE`**. The original implementation had a race where firing 5–20 concurrent guesses against the same game could extract pattern information without consuming the guess budget. The row-level lock closes it.
- **Move fingerprint is SHA-256 of `UPPER(target) || "|" || comma-joined UPPER guesses`**. Persisted on game completion, indexed. The uniqueness analytic on the review page does a single `COUNT(*)` against this — no community comparison happens at request time.
- **AI tier-3 (chat) is uncached, tier-1 (move explanation) + tier-2 (game summary) are cached 30 days** keyed on position state + skill bucket. Identical positions across different users share one Gemini call.
- **Auth uses short-lived JWTs (24h)** stored in `localStorage`. Step-up auth on `DELETE /me` and `DELETE /me/games` requires password re-entry (or username confirm for Google-only accounts) so a stolen token can't nuke an account.

---

## License

Proprietary. Thesis project at FER (University of Zagreb).
