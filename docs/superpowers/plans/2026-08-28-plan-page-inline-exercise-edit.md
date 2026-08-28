# Plan Page Inline Exercise Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users click an already-added exercise on the Plan page and pick a different exercise in place, without removing and re-adding it.

**Architecture:** Pure `PlanPage.tsx` UI change. Add one piece of local state (`editingExerciseId`) to track which planned-exercise row is in edit mode, one handler (`handleChangeExercise`) that swaps the `exercise` field via the existing `updateWorkoutPlan` plumbing, and conditional JSX that renders a `<select>` in place of the `<span>` when that row is being edited.

**Tech Stack:** React + TypeScript, Vitest + @testing-library/react for tests (matching `src/__tests__/planContract.test.tsx` conventions).

## Global Constraints

- No backend/API changes — `updateWorkoutPlan` (already in `useGymTracker`) is reused as-is.
- `target_sets` editing is explicitly out of scope; do not add UI for it.
- Creating new custom exercises inline is out of scope.
- Only `PlannedExercise.exercise` should change on edit; `id`, `position`, and `target_sets` for that entry — and all other days/entries — must be preserved.
- Follow existing code patterns in `src/pages/PlanPage.tsx` exactly (same immutable-update style as `handleRemoveExercise`/`handleMoveExercise`, same `<select>`/`<option>` markup as the existing "Add Exercise" picker).

---

### Task 1: Add inline exercise-edit state, handler, and JSX to PlanPage

**Files:**
- Modify: `src/pages/PlanPage.tsx`
- Test: `src/__tests__/planContract.test.tsx`

**Interfaces:**
- Consumes: `data.workoutPlan` (`WorkoutDay[]`), `updateWorkoutPlan(plan: WorkoutDay[])` from `useGymTracker()` (both already destructured at `PlanPage.tsx:7`); `allExercises` (already computed at `PlanPage.tsx:12`).
- Produces: `editingExerciseId: string | null` state; `handleChangeExercise(dayId: string, plannedExerciseId: string, newExerciseId: string): void`. No other task depends on these (this is the only task in the plan), but keep the names exact since the test in this task calls into the rendered UI, not the handler directly.

- [ ] **Step 1: Write the failing test**

Add this test to the existing `describe('PlanPage with a server-backed plan', ...)` block in `src/__tests__/planContract.test.tsx` (after the existing `'saves added exercises...'` test, before the closing `});` of that describe block):

```tsx
  it('allows changing an existing exercise in place by clicking its name', async () => {
    render(<PlanPage />);

    await screen.findByText('Push Day');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Crunch'));

    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('uuid-preset-crunch');

    fireEvent.change(select, { target: { value: 'uuid-custom-1' } });

    await waitFor(() => {
      expect(screen.getByText('My Custom')).toBeInTheDocument();
    });
    expect(screen.queryByText('Crunch')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    expect(savePlanMock).toHaveBeenCalled();
    const savedBody = savePlanMock.mock.calls[savePlanMock.mock.calls.length - 1][0];
    expect(savedBody[0].exercises).toHaveLength(1);
    expect(savedBody[0].exercises[0]).toMatchObject({
      id: 'pe-1',
      exercise: 'uuid-custom-1',
      position: 0,
      target_sets: 3,
    });
  });

  it('closes edit mode without changing the plan when clicking away', async () => {
    render(<PlanPage />);

    await screen.findByText('Push Day');
    fireEvent.click(screen.getByText('Crunch'));

    const select = screen.getByRole('combobox');
    fireEvent.blur(select);

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('Crunch')).toBeInTheDocument();
    expect(savePlanMock).not.toHaveBeenCalled();
  });
```

Note: both new tests click `'Crunch'` (the exercise name text), not the "+ Add Exercise" button, so they exercise the new in-place edit path rather than the existing add-picker path.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- planContract`

Expected: The two new tests FAIL. `'allows changing an existing exercise in place...'` fails because clicking `'Crunch'` does nothing (`<span>` has no `onClick`), so `screen.getByRole('combobox')` throws (no combobox found). `'closes edit mode without changing the plan...'` fails for the same reason.

- [ ] **Step 3: Write minimal implementation**

In `src/pages/PlanPage.tsx`:

1. Add new state below the existing `showAddExercise` state (after line 10):

```tsx
  const [showAddExercise, setShowAddExercise] = useState<string | null>(null);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
```

2. Add the new handler after `handleRemoveExercise` (after line 70, before `handleMoveExercise`):

```tsx
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

3. Replace the exercise-name rendering. Current code (lines 109-121):

```tsx
            {day.exercises.map((ex, exIdx) => {
              const exerciseDef = allExercises.find(e => e.id === ex.exercise);
              return (
                <div key={ex.id} className="plan-exercise-row">
                  <span>{exerciseDef?.name ?? 'Unknown'}</span>
                  <div className="plan-exercise-controls">
                    <button className="btn btn-small" onClick={() => handleMoveExercise(day.id, ex.id, -1)} disabled={exIdx === 0}>↑</button>
                    <button className="btn btn-small" onClick={() => handleMoveExercise(day.id, ex.id, 1)} disabled={exIdx === day.exercises.length - 1}>↓</button>
                    <button className="btn btn-small btn-danger-outline" onClick={() => handleRemoveExercise(day.id, ex.id)}>✕</button>
                  </div>
                </div>
              );
            })}
```

Replace with:

```tsx
            {day.exercises.map((ex, exIdx) => {
              const exerciseDef = allExercises.find(e => e.id === ex.exercise);
              return (
                <div key={ex.id} className="plan-exercise-row">
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
                  <div className="plan-exercise-controls">
                    <button className="btn btn-small" onClick={() => handleMoveExercise(day.id, ex.id, -1)} disabled={exIdx === 0}>↑</button>
                    <button className="btn btn-small" onClick={() => handleMoveExercise(day.id, ex.id, 1)} disabled={exIdx === day.exercises.length - 1}>↓</button>
                    <button className="btn btn-small btn-danger-outline" onClick={() => handleRemoveExercise(day.id, ex.id)}>✕</button>
                  </div>
                </div>
              );
            })}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- planContract`

Expected: All tests in `planContract.test.tsx` PASS, including the two new ones and the pre-existing ones (`'resolves exercise names...'` and `'saves added exercises...'`).

- [ ] **Step 5: Run full test suite and lint to check for regressions**

Run: `npm test` and `npm run lint`

Expected: All tests pass; no new lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/PlanPage.tsx src/__tests__/planContract.test.tsx
git commit -m "feat: allow in-place exercise editing on Plan page"
```

---

## Self-Review Notes

- **Spec coverage:** Interaction flow (click → select pre-filled → onChange commits → onBlur cancels), state addition, handler, and JSX change are all covered by Task 1. Testing section of the spec (pre-selected select, plan update correctness, cancel-without-mutation) is covered by the two new tests.
- **Placeholder scan:** None — all code is concrete and copy-pasteable.
- **Type consistency:** `handleChangeExercise(dayId: string, plannedExerciseId: string, newExerciseId: string)` matches its only call site `handleChangeExercise(day.id, ex.id, e.target.value)`. `editingExerciseId` type (`string | null`) matches `PlannedExercise.id` (a string) and the `useState` initializer.
