# Gym Tracker

A full-stack workout tracking app with offline-first sync. React + TypeScript frontend, Django REST backend with JWT auth and Postgres.

## Features

- **Today** — Start workouts, log sets (weight/reps, duration, distance), per-set timing
- **Plan** — Customize your workout rotation: add/rename/reorder days and exercises
- **Exercises** — Browse 35+ preset exercises by category, create custom exercises
- **History** — Review past completed and skipped workouts
- **Auth** — Email/password registration and login (JWT)
- **Offline-first** — Works without internet; syncs when connection resumes

## Tech Stack

**Frontend:** React 19, TypeScript 6, Vite 8, react-router-dom 7, Vitest + React Testing Library, regular CSS with custom properties.

**Backend:** Django 5.1, Django REST Framework, django-rest-framework-simplejwt, django-cors-headers, Postgres (Neon.tech), Zappa (AWS Lambda).

## Getting Started

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 manage.py migrate
python3 manage.py runserver
```

Both servers must be running. The frontend expects the API at `http://localhost:8000`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend dev server |
| `npm run build` | Type-check and build for production |
| `npx vitest run` | Run frontend tests |
| `npx tsc --noEmit` | Type-check only |
| `python3 manage.py runserver` | Start backend dev server |
| `python3 manage.py migrate` | Apply database migrations |

## Project Structure

```
backend/             — Django API (accounts, workouts)
  accounts/          — User model + JWT auth endpoints
  workouts/          — Exercise/workout/session models + API
  config/            — Django settings, URLs
  manage.py
frontend/            — Git repo metadata (moved to root)
src/                 — React app source
  api/               — API client, auth, workouts, sync
  components/        — UI components (ExerciseCard, AuthGuard, etc.)
  context/           — AuthContext (React context for auth state)
  hooks/             — useGymTracker, useAuth
  pages/             — TodayPage, PlanPage, LoginPage, etc.
  styles/            — CSS files
  types/             — TypeScript types
  utils/             — Storage, date/time, validation helpers
```
