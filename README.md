# ELOquence

Competitive Wordle with deep analytical game analysis. Track your typing skills through an ELO-based ranking system with AI-powered post-game insights.

## Features

- **Competitive Gameplay** — Play daily challenges or competitive ELO-ranked matches
- **ELO Rating System** — Skill-based ranking with placement phase (first 5 games) for rapid calibration
- **Practice Mode** — Unrated games with customizable word filters and DB-backed progression
- **AI Analysis Engine** — Post-game breakdown with move classification, efficiency metrics, and strategic insights
- **Real-time Statistics** — Track your performance, rating trajectory, and word mastery
- **User Authentication** — Secure JWT-based auth with persistent game history

## Tech Stack

**Frontend:**

- Next.js 14 (app router) + TypeScript
- Tailwind CSS + Framer Motion for animations
- React Flow for interactive visualizations

**Backend:**

- FastAPI + SQLAlchemy (async)
- PostgreSQL database
- Alembic for migrations
- Claude AI (via Anthropic SDK) for game analysis

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

## Database

Migrations are managed with Alembic. After pulling changes:

```bash
cd backend
alembic upgrade head
```

## License

Proprietary. Created as a thesis project at FER.
