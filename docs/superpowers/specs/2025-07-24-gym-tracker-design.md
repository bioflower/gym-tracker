# Gym Workout Tracker — Frontend MVP Design

## Architecture

Single-page React application with client-side routing (react-router-dom v7).
All state persisted to `localStorage` under key `gym-tracker-data-v1`.
No backend, no external state management, no authentication.

## Pages

| Route | Page | Purpose |
|-------|------|---------|
| `/` | TodayPage | Active workout display, exercise cards, finish/skip |
| `/plan` | PlanPage | Edit workout rotation (add/rename/reorder days and exercises) |
| `/exercises` | ExerciseLibraryPage | Browse preset + custom exercises, create custom exercises |
| `/history` | HistoryPage | Past completed/skipped workouts |
| `/settings` | SettingsPage | Reset demo data |

## Component Tree

```
App
├── Navigation (persistent bottom/top nav)
├── Routes
│   ├── TodayPage
│   │   ├── WorkoutHeader (name, date, progress)
│   │   ├── ExerciseCard[] (one per planned exercise)
│   │   │   └── ExerciseSetRow[] (sets with inputs)
│   │   └── WorkoutCompletionModal (confirmation dialog)
│   ├── PlanPage
│   │   └── WorkoutDayEditor[] (name, exercise list, add/remove/reorder)
│   ├── ExerciseLibraryPage
│   │   ├── ExerciseList (preset + custom exercises)
│   │   └── CustomExerciseForm (modal/dialog)
│   ├── HistoryPage
│   │   └── HistoryItem[] (expandable)
│   └── SettingsPage
│       └── ResetDemoData button
```

## Data Flow

1. App loads → `useLocalStorage` hook reads/validates `AppData` from localStorage
2. If no data or invalid → fall back to defaults (3 workout days, preset exercises)
3. Active workout lives in `activeWorkout` field of AppData
4. Finishing a workout: validate → save to `workoutHistory` → advance `currentWorkoutIndex` → clear `activeWorkout`
5. Skipping a workout: confirm → save skipped record to history → advance rotation
6. Previous-result autofill: look up most recent completed `WorkoutSession` containing the same exerciseId

## Types

Core types per user spec: `Exercise`, `WorkoutDay`, `PlannedExercise`, `ActiveWorkoutSession`, `ActiveExercise`, `WeightRepSet`, `WorkoutSession`, `CompletedExercise`, `AppData`.

Discriminated unions for set types:
- `WeightRepSet` (weight + reps + unit)
- `RepsOnlySet` (reps only)
- `DurationSet` (duration seconds)
- `DistanceDurationSet` (distance + duration)

## Design Tokens

CSS custom properties as specified (neutral palette, green success, red danger, rounded corners).

## Testing

- Vitest + React Testing Library
- 12 tests covering: default state, rotation, persistence, exercise card variants, custom exercises, duplicate detection, history creation, autofill
- Tests use `localStorage` mock

## Implementation Order

Per user spec: types → preset data → Today page → exercise sets → completion → rotation → localStorage → history → autofill → exercise library → custom exercises → plan editor → nav + styling → validation + a11y → tests → final checks.