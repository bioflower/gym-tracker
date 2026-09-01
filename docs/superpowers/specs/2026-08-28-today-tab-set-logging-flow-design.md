# Today Tab: Simplified Set-Logging Flow

## Problem

The current Today tab requires too many redundant taps per set, and duplicates
state at two levels:

- Per set: press **Start**, manually type weight/reps/duration/distance into
  number inputs, then press **Mark Done** — three separate interactions.
- Per exercise: a *separate* **Start Exercise** / **Complete Exercise** button
  pair exists on top of the per-set buttons, with no relationship enforced
  between the two levels.
- Sets are pre-created in a fixed batch (default 3, or `target_sets` from the
  plan) via `createEmptySets`, rather than logged one at a time as they
  happen.
- There is no rest timer between sets.
- There is no way to swap an exercise for today's session (only via the Plan
  tab, which edits the saved template).

## Goals

- One clear interaction loop per set: **Start → do the set → Stop → enter the
  one remaining value (reps or distance) → rest timer runs → Start Next Set**.
- Remove the redundant exercise-level Start/Complete buttons; derive exercise
  status from its sets, with a lightweight manual "done" toggle instead of a
  hard button pair.
- Add a count-up rest timer between sets, requiring no new persisted timer
  state (derived from existing timestamps).
- Let the user swap an exercise for today's session only, without touching
  the saved plan.
- User can press "Finish Workout" at any point regardless of timer/set state.

## Non-goals

- Configurable/target rest durations, countdowns, sounds/notifications.
- Changing the Plan tab's own exercise-swap behavior.
- Enforcing a hard cap on number of sets logged (target set count from the
  plan remains a hint only).

## Flow

### Per-set interaction

1. Exercise card renders: previously completed sets as compact, tappable
   summary rows (e.g. `80kg × 8 reps`), followed by one **Current Set** card.
2. **Idle state**: Current Set card shows just a **Start** button (no rest
   timer before the very first set of an exercise).
3. Press **Start** → button becomes **Stop**; a live elapsed-time readout
   runs while the set is in progress.
4. Press **Stop**:
   - `weight-reps` / `reps` tracking types → reveals a **reps** input
     (weight pre-filled from the most recent session via
     `findMostRecentExerciseResult`, editable). The elapsed Start→Stop time
     is discarded — it's just a lightweight prompt to log reps.
   - `duration` tracking type → the elapsed Start→Stop time itself becomes
     the recorded duration; the set auto-completes immediately with no
     further input.
   - `distance-duration` tracking type → elapsed time becomes the duration
     automatically; reveals a **distance** input only.
5. The set is marked `completed` as soon as the required manual field (reps
   or distance) has a value — no separate confirm/"Mark Done" button. For
   `duration` sets, completion happens immediately on Stop.
6. On completion, a **rest stopwatch** appears in place of the next Current
   Set card: a count-up `mm:ss` display plus a single **"Start Next Set"**
   button.
   - Rest elapsed time is *derived*, not stored: `now - previousSet.completedAt`.
     No new field is added to `ExerciseSet`; a page refresh mid-rest
     recomputes correctly from the existing `completedAt` timestamp.
7. Pressing **"Start Next Set"** stops the rest display and immediately
   begins the next set's active (Start→Stop) timer in one tap — there is no
   separate "stop rest" step.
8. Completed set summary rows are tappable to expand into an editable
   inline form (weight/reps/duration/distance depending on type), with the
   existing ✕ remove control preserved.
9. The plan's target set count (`target_sets`) is shown as a hint (e.g. a
   "Set 3 of 3" style label) but does not block logging additional sets.

### Exercise-level status

- No more **Start Exercise** / **Complete Exercise** buttons.
- Status badge (Not Started / In Progress / Done) is derived:
  - Not Started: no sets logged and not marked done.
  - In Progress: at least one set started/logged, not marked done.
  - Done: `exercise.completed === true` (see below).
- A small text link, **"Mark exercise done"**, appears once at least one set
  has been logged. Clicking it sets `exercise.completed = true` and replaces
  the Current Set / rest-timer area with a small **"Resume / log another
  set"** link that un-sets `completed` and restores the normal flow (so the
  user isn't locked out if they change their mind or want an extra set).

### Exercise swap (new, Today tab only)

- A small dropdown/button in the exercise card header lets the user swap
  today's exercise for a different one from the exercise library (same
  source list as `PlanPage.handleChangeExercise`).
- Only mutates `activeWorkout.exercises[i]` for the current session — the
  saved `workoutPlan` template is untouched.
- Only available while the exercise has **no logged sets** (`sets.length ===
  0`), since tracking type may differ across exercises and swapping after
  data exists would be a confusing partial-loss of that data. Once any set
  has been logged, the swap control is disabled/hidden.
- Swapping resets: `exerciseId`, `exerciseName`, `trackingType` (from the new
  exercise), `sets: []`, `completed: false`, `startedAt: undefined`.

### Finish Workout

- Gating check changes from `sets.every(s => s.completed)` per exercise to
  simply `exercise.completed` per exercise (the manual done-flag described
  above), since sets no longer have a fixed target count to compare against.
- Behavior otherwise unchanged: if any exercise isn't marked done, show the
  existing confirmation modal ("Finish Anyway" / "Go Back"); if all are
  done, finish immediately.
- User may press Finish Workout at any time, including mid-rest or with a
  set actively started (Stop not yet pressed). An in-progress (started but
  not stopped/completed) set is simply not persisted — same behavior as
  today for any incomplete set.

## Components

- **`SetInProgress.tsx`** (new, replaces the "start" half of
  `ExerciseSetRow.tsx`): renders the Current Set card — idle Start button,
  active Stop button + elapsed readout, then the post-Stop reps/distance
  input depending on tracking type. Calls back to mark the set completed
  once the required field is filled.
- **`CompletedSetRow.tsx`** (new, replaces the "display" half of
  `ExerciseSetRow.tsx`): renders a completed set as a compact summary row,
  expandable/editable inline, with the remove (✕) control.
- **`RestTimer.tsx`** (new): props include the previous set's `completedAt`;
  renders a live `mm:ss` count-up (local `setInterval`, no persisted state)
  and the "Start Next Set" button.
- **`ExerciseSwapControl.tsx`** (new): dropdown/button in the exercise card
  header; disabled once `exercise.sets.length > 0`.
- **`ExerciseCard.tsx`** (modified): drops `onStart`/`onComplete` button
  wiring; adds `onMarkDone` / `onResume` for the text-link toggle; renders
  the list of `CompletedSetRow`s followed by either `SetInProgress`, a
  `RestTimer`, or the "mark done"/"resume" link depending on exercise/set
  state. Also renders `ExerciseSwapControl`.
- **`ExerciseSetRow.tsx`**: removed, superseded by `SetInProgress` +
  `CompletedSetRow`.

## Data model & hook changes (`useGymTracker.ts`, `types/gym.ts`)

- No new fields on `ExerciseSet` — rest time is always derived from existing
  `completedAt` timestamps, never stored.
- `createEmptySets` pre-population removed: `startWorkout` initializes each
  `ActiveExercise` with `sets: []`.
- `addSet` becomes the sole way a set row is created — invoked when the user
  presses **Start** on the Current Set card (and again for "log another
  set" after marking done).
- `startExercise` / `completeExercise` removed; replaced by a single
  `setExerciseDone(exerciseId, done: boolean)` that toggles only
  `exercise.completed`. `exercise.startedAt` is unaffected by this toggle —
  it continues to be set once, the first time a set is started on that
  exercise.
- New `swapExerciseForToday(exerciseId, newExerciseId)` action: looks up the
  new exercise's `name`/`trackingType` from the exercise library the same
  way `PlanPage.handleChangeExercise` does, and resets the target
  `ActiveExercise` as described above. No-ops (or is not exposed) if the
  target exercise already has logged sets.
- `updateSet` / `removeSet` remain as-is, reused for editing completed rows.
- `TodayPage.tsx`'s `allComplete` computation changes from
  `active.exercises.every(e => e.sets.every(s => s.completed))`-style logic
  to `active.exercises.every(e => e.completed)`.

## Testing

- Unit tests for the new derived-state logic: exercise status badge
  derivation, `allComplete` gating, rest-time derivation from timestamps
  across a page-refresh-like recompute.
- Unit tests for `useGymTracker`: `addSet` creation on Start, `setExerciseDone`
  toggle, `swapExerciseForToday` (including the no-op-when-sets-exist guard).
- Component tests for `SetInProgress` covering all four tracking types
  (weight-reps, reps, duration, distance-duration), verifying duration
  auto-capture behavior specifically.
- Component test for `RestTimer` verifying it computes elapsed time from a
  given `completedAt` prop rather than owning its own start timestamp.
