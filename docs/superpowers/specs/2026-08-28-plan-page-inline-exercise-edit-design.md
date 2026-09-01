# Plan Page: In-Place Exercise Editing

## Problem

On the Plan page (`src/pages/PlanPage.tsx`), each workout day lists its planned
exercises as plain, non-interactive text:

```tsx
<span>{exerciseDef?.name ?? 'Unknown'}</span>
```

To swap an exercise for a different one, the user must remove it (✕ button)
and then use the separate "+ Add Exercise" flow to pick a replacement. There
is no way to click an existing exercise row and directly choose a different
exercise in place.

## Goal

Clicking an already-added exercise's name should let the user pick a
replacement exercise from a dropdown, in place, without removing and re-adding
the row.

## Non-goals

- Editing `target_sets` (currently hardcoded to `3` on add, no edit UI at all)
  is out of scope for this change.
- Creating new custom exercises inline is out of scope.
- No changes to the backend API, `useGymTracker` hook, or `updateWorkoutPlan`
  are required — this is purely a `PlanPage.tsx` UI change.

## Design

### State

Add one new piece of local state to `PlanPage`, tracking which
`PlannedExercise` row (by its `id`, unique across the whole plan) is currently
in edit mode:

```ts
const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
```

This is separate from the existing `showAddExercise` state (which tracks which
*day* has its "add new exercise" picker open) since editing an existing row
and adding a new row are distinct UI locations and can be open independently.

### Handler

```ts
function handleChangeExercise(dayId: string, plannedExerciseId: string, newExerciseId: string) {
  updateWorkoutPlan(data.workoutPlan.map(d =>
    d.id === dayId
      ? { ...d, exercises: d.exercises.map(e =>
          e.id === plannedExerciseId ? { ...e, exercise: newExerciseId } : e
        ) }
      : d
  ));
  setEditingExerciseId(null);
}
```

This mirrors the existing `handleRemoveExercise` / `handleMoveExercise`
pattern: immutable update over `data.workoutPlan`, then
`updateWorkoutPlan(...)`, which already handles the online `PUT
/workouts/plan/` call and the offline enqueue fallback. No new API call is
needed.

Only the `exercise` field of the matched `PlannedExercise` changes; `id`,
`position`, and `target_sets` are preserved.

### Render

In the exercise row (`PlanPage.tsx`, inside `day.exercises.map(...)`), branch
on whether this row's id matches `editingExerciseId`:

```tsx
{editingExerciseId === ex.id ? (
  <select
    className="input"
    defaultValue={ex.exercise}
    onChange={e => handleChangeExercise(day.id, ex.id, e.target.value)}
    onBlur={() => setEditingExerciseId(null)}
    autoFocus
  >
    {allExercises.map(e => (
      <option key={e.id} value={e.id}>{e.name}</option>
    ))}
  </select>
) : (
  <span onClick={() => setEditingExerciseId(ex.id)}>{exerciseDef?.name ?? 'Unknown'}</span>
)}
```

This reuses the same `<select>` markup/options already used for "Add
Exercise" (existing `exercise-picker` block), just wired to commit-on-change
and cancel-on-blur instead of add-only-on-change.

### Interaction flow

1. User clicks the exercise name (`<span onClick>`) → row swaps to a `<select>`
   pre-filled (`defaultValue`) with the current exercise, focused
   (`autoFocus`).
2. User picks a new value → `onChange` fires `handleChangeExercise`, which
   updates the plan and closes edit mode (`setEditingExerciseId(null)`).
3. User clicks away without selecting a new value → `onBlur` closes edit mode
   with no change.
4. Move (`↑`/`↓`) and remove (`✕`) buttons are unaffected by this change.

## Testing

- Add a test (unit or component-level, matching existing `PlanPage` test
  conventions if present) covering:
  - Clicking an exercise name reveals a `<select>` pre-selected with the
    current exercise's id/name.
  - Selecting a different option calls `updateWorkoutPlan` with the plan
    updated so only that `PlannedExercise.exercise` changed — `id`,
    `position`, and `target_sets` for that entry, and all other days/entries,
    are untouched.
  - Clicking away without selecting closes edit mode without mutating the
    plan.
  - Editing one row does not affect the "+ Add Exercise" picker state for the
    same or other days, and vice versa.
