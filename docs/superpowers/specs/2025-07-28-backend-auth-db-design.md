# Gym Tracker Backend — Serverless Django + Auth + Database Design

## Architecture

Offline-first single-page React application backed by a serverless Django REST API.
Data persisted to Postgres via Neon.tech. JWT authentication via djangorestframework-simplejwt.
Deployed via Zappa to AWS Lambda.

## Project Structure

```
gym-tracker/
├── frontend/                    # existing React app (modified)
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts        # Axios/fetch wrapper with JWT injection
│   │   │   ├── auth.ts          # login, register, refresh, logout
│   │   │   ├── workouts.ts      # exercise, plan, session API calls
│   │   │   └── sync.ts          # offline queue + sync logic
│   │   ├── hooks/
│   │   │   ├── useAuth.ts       # auth state, login/logout, JWT refresh
│   │   │   └── useGymTracker.ts # MODIFIED: wraps API calls + sync
│   │   ├── context/
│   │   │   └── AuthContext.tsx   # auth state provider
│   │   ├── components/
│   │   │   └── AuthGuard.tsx    # redirects unauthenticated users
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx    # NEW
│   │   │   ├── RegisterPage.tsx # NEW
│   │   │   └── ...              # existing pages modified for backend
│   │   └── ...
│   ├── amplify.yml              # unchanged
│   └── package.json
├── backend/                     # NEW: Django project
│   ├── config/                  # Django settings, urls, wsgi
│   │   ├── __init__.py
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── accounts/                # user model + auth endpoints
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── urls.py
│   ├── workouts/                # workout data models + API
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── urls.py
│   ├── manage.py
│   ├── requirements.txt
│   └── startup.sh               # Zappa entrypoint
├── zappa_settings.json          # Zappa deployment config
└── README.md
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend Framework | Django 5 + Django REST Framework |
| Auth | djangorestframework-simplejwt (JWT) |
| Database | Postgres via Neon.tech (serverless, free tier) |
| Deployment | Zappa (Django → AWS Lambda + API Gateway) |
| File Storage | S3 (static files) |
| Frontend | React 19 + TypeScript (existing, modified) |
| Frontend Hosting | AWS Amplify (unchanged) |

## Data Model

### accounts.User
- `email` — EmailField, unique, login identifier
- `password` — hashed via Django's AbstractBaseUser
- `created_at` — DateTimeField, auto_now_add
- Using Django's `AbstractUser` or `AbstractBaseUser` + `BaseUserManager`

### workouts.Exercise
- `id` — UUIDField, primary key
- `user` — ForeignKey to User, null=True (null = preset, non-null = user-created)
- `name` — CharField
- `category` — CharField (choices: lower-body, chest, back, shoulders, arms, core, cardio, other)
- `tracking_type` — CharField (choices: weight-reps, reps, duration, distance-duration)
- `equipment` — CharField, blank=True
- `is_preset` — BooleanField, default=False
- `created_at` — DateTimeField, auto_now_add

### workouts.WorkoutDay
- `id` — UUIDField, primary key
- `user` — ForeignKey to User
- `name` — CharField
- `position` — IntegerField (order in rotation)
- `created_at` — DateTimeField, auto_now_add

### workouts.PlannedExercise
- `id` — UUIDField, primary key
- `workout_day` — ForeignKey to WorkoutDay, CASCADE
- `exercise` — ForeignKey to Exercise
- `position` — IntegerField (order within day)
- `target_sets` — IntegerField, default=3

### workouts.WorkoutSession
- `id` — UUIDField, primary key
- `user` — ForeignKey to User
- `workout_day` — ForeignKey to WorkoutDay, null=True
- `workout_name` — CharField (denormalized snapshot)
- `date` — DateField
- `started_at` — DateTimeField, null=True
- `completed_at` — DateTimeField, null=True
- `status` — CharField (choices: completed, skipped)

### workouts.CompletedExercise
- `id` — UUIDField, primary key
- `workout_session` — ForeignKey to WorkoutSession, CASCADE
- `exercise` — ForeignKey to Exercise
- `exercise_name` — CharField (denormalized snapshot)
- `tracking_type` — CharField

### workouts.CompletedSet
- `id` — UUIDField, primary key
- `completed_exercise` — ForeignKey to CompletedExercise, CASCADE
- `type` — CharField (tracking type snapshot)
- `weight` — DecimalField, null=True
- `weight_unit` — CharField, null=True
- `reps` — IntegerField, null=True
- `duration_seconds` — IntegerField, null=True
- `distance` — DecimalField, null=True
- `distance_unit` — CharField, null=True
- `started_at` — DateTimeField, null=True
- `completed_at` — DateTimeField, null=True
- `completed` — BooleanField, default=False

## Preset Exercises Seeding

A Django data migration creates the 35+ preset exercises (same as frontend `presetExercises.ts`).
These have `user=None` and `is_preset=True`.

## API Endpoints

```
POST   /api/auth/register/         — Create account (email, password)
POST   /api/auth/login/            — Get JWT tokens (access + refresh)
POST   /api/auth/refresh/          — Refresh access token
GET    /api/auth/me/               — Get current user info

GET    /api/workouts/exercises/    — List exercises (preset + user's customs)
POST   /api/workouts/exercises/    — Create custom exercise
PUT    /api/workouts/exercises/:id/
DELETE /api/workouts/exercises/:id/

GET    /api/workouts/plan/         — Get user's complete workout plan
PUT    /api/workouts/plan/         — Save entire workout plan (replace)

GET    /api/workouts/sessions/     — List workout history
POST   /api/workouts/sessions/     — Save a completed/skipped session
```

All endpoints require JWT auth (except register/login/refresh).
The plan endpoint returns the nested structure: WorkoutDays → PlannedExercises.

## Sync Strategy

### States
- **Online:** reads/writes go through API. On success, cache to localStorage.
- **Offline:** reads use localStorage cache. Writes queue to localStorage.
- **Reconnect:** replay queued mutations, then refresh cache from API.

### Queue format
```typescript
interface SyncQueueItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  endpoint: string;
  method: string;
  body: unknown;
  timestamp: string;
}
```

### Conflict resolution
- Last-write-wins for plan edits
- Workout sessions are append-only (no conflicts)

## Frontend Changes

### New files
- `src/api/client.ts` — axios instance with JWT interceptor, token refresh
- `src/api/auth.ts` — register, login, logout, getMe
- `src/api/workouts.ts` — exercises CRUD, plan GET/PUT, sessions POST/GET
- `src/api/sync.ts` — offline queue management, sync on reconnect
- `src/context/AuthContext.tsx` — React context for auth state
- `src/hooks/useAuth.ts` — hook wrapping AuthContext
- `src/pages/LoginPage.tsx` — email/password form
- `src/pages/RegisterPage.tsx` — email/password registration form
- `src/components/AuthGuard.tsx` — route guard, redirects to /login

### Modified files
- `src/types/gym.ts` — `ActiveExercise` drops `startedAt`, `completedAt`, `completed` (moved to per-set). Each set type gains `startedAt`, `completedAt`, `completed` (togglable).
- `src/components/ExerciseSetRow.tsx` — each set gets a "Start" button and a "Done" toggle (click to undo). All per-set timing and completion management moves here.
- `src/components/ExerciseCard.tsx` — removed "Start Exercise"/"Complete Exercise" buttons. Exercise status derived from set completion state (all sets done = exercise done).
- `src/hooks/useGymTracker.ts` — add API calls, offline fallback, sync. Remove `startExercise`, `completeExercise`; `updateSet` now includes toggling `completed`.
- `src/App.tsx` — add auth routes, wrap with AuthProvider
- `src/main.tsx` — if needed for providers
- Existing pages — read data from hook (transparently API or localStorage)

## Deployment

### Backend (Zappa + Lambda)
```bash
pip install zappa
zappa init
zappa deploy dev
```
Zappa handles API Gateway → Lambda mapping, static files to S3, environment variables.

### Database (Neon.tech)
1. Create free-tier Postgres instance at neon.tech
2. Set `DATABASE_URL` in Zappa environment variables
3. `python manage.py migrate` via Zappa manage command

### Frontend (Amplify — unchanged)
Amplify auto-deploys from the frontend/ directory on push.
Add `VITE_API_URL` environment variable pointing to the API Gateway URL.

## Implementation Order

1. Django project scaffold (backend/config, manage.py, requirements.txt)
2. accounts app — User model, register/login/refresh/me views
3. workouts app — all models, preset data migration
4. workouts API — exercise CRUD, plan GET/PUT, sessions POST/GET
5. Frontend API layer — client.ts, auth.ts, workouts.ts, sync.ts
6. Frontend auth — AuthContext, useAuth, LoginPage, RegisterPage, AuthGuard
7. Modify useGymTracker — API integration with offline fallback
8. Modify App.tsx — auth routes, providers
9. Deployment config — zappa_settings.json, environment variables
10. End-to-end testing
