# Today Tab: Simplified Set-Logging Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Today tab's redundant per-set Start/type/Mark-Done + per-exercise Start/Complete flow with a single Start → Stop → enter value → rest timer → Start Next Set loop, add a rest stopwatch, and let users swap an exercise for today's session only.

**Architecture:** Sets are created one at a time (not pre-batched); each `ActiveExercise.sets` array holds zero or more completed sets plus at most one in-progress set. Component state is fully derived from existing `ExerciseSet` timestamp fields (`startedAt`, `completedAt`, `completed`) — no new persisted fields are introduced. `ExerciseCard` derives which of four UI phases to show (idle / active-timer / awaiting-input / resting) from that one in-progress set (if any) and the exercise's `completed` flag.

**Tech Stack:** React 19 + TypeScript (Vite), Vitest + @testing-library/react, no new dependencies.

## Global Constraints

- No new fields on `ExerciseSet`/`ActiveExercise`/`AppData` — rest time and timer phase are always derived from existing `startedAt`/`completedAt`/`completed` timestamps.
- `noUnusedLocals`/`noUnusedParameters`/`verbatimModuleSyntax` are enabled in `tsconfig.app.json` — use `import type` for type-only imports and don't leave unused params/imports.
- Follow existing CSS variable/class conventions in `src/styles/global.css` (`--space-*`, `.btn`, `.input`, `.badge`) rather than introducing new design tokens.
- Run `npm test` (vitest) after every task; run `npm run build` (`tsc -b && vite build`) after the final task to confirm the whole app type-checks.

---

### Task 1: `diffSeconds` and `formatClock` date/time utilities

**Files:**
- Modify: `src/utils/dateTime.ts`
- Test: `src/__tests__/dateTime.test.ts`

**Interfaces:**
- Produces: `diffSeconds(start: string, end: string): number` — whole seconds between two ISO timestamps, clamped to 0.
- Produces: `formatClock(totalSeconds: number): string` — `"M:SS"` zero-padded clock format (e.g. `92` → `"1:32"`).

- [ ] **Step 1: Write the failing tests**

Read the existing file first so the new tests sit alongside the current ones:

```bash
cat src/__tests__/dateTime.test.ts
```

Append to `src/__tests__/dateTime.test.ts`:

```ts
import { diffSeconds, formatClock } from '../utils/dateTime';

describe('diffSeconds', () => {
  it('returns whole seconds between two ISO timestamps', () => {
    expect(diffSeconds('2026-01-01T00:00:00.000Z', '2026-01-01T00:01:32.000Z')).toBe(92);
  });

  it('clamps negative differences to 0', () => {
    expect(diffSeconds('2026-01-01T00:01:00.000Z', '2026-01-01T00:00:00.000Z')).toBe(0);
  });
});

describe('formatClock', () => {
  it('formats seconds under a minute', () => {
    expect(formatClock(5)).toBe('0:05');
  });

  it('formats minutes and seconds, zero-padded', () => {
    expect(formatClock(92)).toBe('1:32');
  });

  it('formats exactly zero', () => {
    expect(formatClock(0)).toBe('0:00');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- dateTime`
Expected: FAIL — `diffSeconds`/`formatClock` are not exported from `../utils/dateTime`.

- [ ] **Step 3: Implement the utilities**

Append to `src/utils/dateTime.ts`:

```ts
export function diffSeconds(start: string, end: string): number {
  const diff = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  return Math.max(0, diff);
}

export function formatClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- dateTime`
Expected: PASS (all `dateTime.test.ts` tests, old and new)

- [ ] **Step 5: Commit**

```bash
git add src/utils/dateTime.ts src/__tests__/dateTime.test.ts
git commit -m "feat: add diffSeconds and formatClock time utilities"
```

---

### Task 2: `useGymTracker` hook changes — one-at-a-time sets, exercise done toggle, exercise swap

**Files:**
- Modify: `src/hooks/useGymTracker.ts`

**Interfaces:**
- Consumes: `createEmptySets(trackingType, count)` (existing, unchanged), `generateId`, `nowISO` (existing).
- Produces (replacing `startExercise`/`completeExercise`):
  - `setExerciseDone(exerciseId: string, done: boolean): void`
  - `swapExerciseForToday(exerciseId: string, newExerciseId: string): void`
- Modifies behavior of:
  - `startWorkout()` — exercises now start with `sets: []` instead of pre-populated empty sets.
  - `addSet(exerciseId: string): void` — now stamps the new set's `startedAt` with `nowISO()` immediately (it represents "Start" being pressed), and sets `exercise.startedAt` on the exercise the first time this happens.
- These are consumed later by `SetInProgress`/`RestTimer` (Task 6/4, via `ExerciseCard` in Task 8) calling `onStart` → `addSet`, and by the new "Mark exercise done"/"Resume" link and swap control in `ExerciseCard` (Task 8).

This task has no dedicated test file of its own: `useGymTracker` has no `renderHook`-based test setup in this codebase (the existing convention, per `src/__tests__/gymTracker.test.tsx`, is to exercise the hook indirectly through the rendered `TodayPage`/`ExerciseCard` tree). Since those components haven't been updated to the new API yet, hook-behavior tests are added in Task 9 (`gymTrackerActions.test.tsx`) once `TodayPage`/`ExerciseCard` can actually render the new flow end-to-end. This task is verified by type-checking only.

- [ ] **Step 1: Implement the hook changes**

In `src/hooks/useGymTracker.ts`, change `startWorkout` to stop pre-populating sets:

```ts
  const startWorkout = useCallback(() => {
    const workout = getCurrentWorkout(data.workoutPlan, data.currentWorkoutIndex);
    if (!workout) return;
    const allExercises: Exercise[] = [...data.presetExercises, ...data.customExercises];
    const exercises: ActiveExercise[] = workout.exercises.map(pe => {
      const exerciseDef = allExercises.find(e => e.id === pe.exercise);
      return {
        id: generateId(),
        exerciseId: pe.exercise,
        exerciseName: exerciseDef?.name ?? 'Unknown',
        trackingType: exerciseDef?.trackingType ?? ('reps' as const),
        sets: [],
        notes: '',
        startedAt: null,
        completedAt: null,
        completed: false,
      };
    });
    const session: ActiveWorkoutSession = {
      id: generateId(),
      workoutDayId: workout.id,
      workoutName: workout.name,
      date: getTodayISO(),
      startedAt: nowISO(),
      completedAt: null,
      status: 'in-progress',
      exercises,
    };
    setData(prev => ({ ...prev, activeWorkout: session }));
  }, [data.workoutPlan, data.currentWorkoutIndex, data.customExercises, data.presetExercises]);
```

(This drops the `createEmptySets` call and its dependency, but `createEmptySets` itself stays — `addSet` below still uses it.)

Replace `addSet` so it stamps `startedAt` and bumps the exercise's own `startedAt`:

```ts
  const addSet = useCallback((exerciseId: string) => {
    setData(prev => {
      if (!prev.activeWorkout) return prev;
      const now = nowISO();
      return {
        ...prev,
        activeWorkout: {
          ...prev.activeWorkout,
          exercises: prev.activeWorkout.exercises.map(e => {
            if (e.id !== exerciseId) return e;
            const newSet = { ...createEmptySets(e.trackingType, 1)[0], startedAt: now };
            return { ...e, startedAt: e.startedAt ?? now, sets: [...e.sets, newSet] };
          }),
        },
      };
    });
  }, [createEmptySets]);
```

Replace `startExercise`/`completeExercise` with:

```ts
  const setExerciseDone = useCallback((exerciseId: string, done: boolean) => {
    setData(prev => {
      if (!prev.activeWorkout) return prev;
      return {
        ...prev,
        activeWorkout: {
          ...prev.activeWorkout,
          exercises: prev.activeWorkout.exercises.map(e =>
            e.id === exerciseId ? { ...e, completed: done, completedAt: done ? nowISO() : null } : e
          ),
        },
      };
    });
  }, []);

  const swapExerciseForToday = useCallback((exerciseId: string, newExerciseId: string) => {
    setData(prev => {
      if (!prev.activeWorkout) return prev;
      const allExercises = [...prev.presetExercises, ...prev.customExercises];
      const newExerciseDef = allExercises.find(e => e.id === newExerciseId);
      if (!newExerciseDef) return prev;
      return {
        ...prev,
        activeWorkout: {
          ...prev.activeWorkout,
          exercises: prev.activeWorkout.exercises.map(e => {
            if (e.id !== exerciseId || e.sets.length > 0) return e;
            return {
              ...e,
              exerciseId: newExerciseDef.id,
              exerciseName: newExerciseDef.name,
              trackingType: newExerciseDef.trackingType,
              sets: [],
              completed: false,
              startedAt: null,
              completedAt: null,
            };
          }),
        },
      };
    });
  }, []);
```

Update the hook's returned object: remove `startExercise, completeExercise,` and add `setExerciseDone, swapExerciseForToday,`:

```ts
  return {
    data,
    startWorkout,
    getCurrentWorkoutDay,
    finishWorkout,
    skipWorkout,
    updateSet,
    addSet,
    removeSet,
    setExerciseDone,
    swapExerciseForToday,
    addCustomExercise,
    editCustomExercise,
    removeCustomExercise,
    updateWorkoutPlan,
    addWorkoutDay,
    resetAll,
    getAllExercises,
    getNextWorkout,
    syncFromServer,
  };
```

Note: `TodayPage.tsx` and `ExerciseCard.tsx` still reference the old `startExercise`/`completeExercise`/pre-batched-sets props at this point in the plan — that's expected. They are fixed in Tasks 8 and 9. Until then, `npm run build` / `npm test` will show errors originating from those two files only; that's the expected, temporary state for this one task.

- [ ] **Step 2: Verify the hook itself type-checks and existing tests still run**

Run: `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -v "TodayPage.tsx\|ExerciseCard.tsx" || true`
Expected: no output (no type errors outside of the two files that are fixed in later tasks).

Run: `npm test -- dateTime`
Expected: PASS (confirms the test runner itself and unrelated suites are unaffected by this change).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useGymTracker.ts
git commit -m "feat: rework useGymTracker set/exercise actions for one-at-a-time set logging"
```

---

### Task 3: `LiveTimer` component

**Files:**
- Create: `src/components/LiveTimer.tsx`
- Test: `src/__tests__/liveTimer.test.tsx`

**Interfaces:**
- Consumes: `diffSeconds`, `formatClock` from `src/utils/dateTime.ts` (Task 1).
- Produces: `LiveTimer({ startAt: string })` — a component rendering a ticking `M:SS` clock computed from `startAt` to "now", updating every second.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/liveTimer.test.tsx`:

```tsx
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LiveTimer } from '../components/LiveTimer';

describe('LiveTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders 0:00 immediately when started now', () => {
    render(<LiveTimer startAt="2026-01-01T00:00:00.000Z" />);
    expect(screen.getByText('0:00')).toBeInTheDocument();
  });

  it('ticks up every second', () => {
    render(<LiveTimer startAt="2026-01-01T00:00:00.000Z" />);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('0:03')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- liveTimer`
Expected: FAIL — `src/components/LiveTimer.tsx` does not exist.

- [ ] **Step 3: Implement `LiveTimer`**

Create `src/components/LiveTimer.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { diffSeconds, formatClock } from '../utils/dateTime';

interface LiveTimerProps {
  startAt: string;
}

export function LiveTimer({ startAt }: LiveTimerProps) {
  const [elapsed, setElapsed] = useState(() => diffSeconds(startAt, new Date().toISOString()));

  useEffect(() => {
    setElapsed(diffSeconds(startAt, new Date().toISOString()));
    const interval = setInterval(() => {
      setElapsed(diffSeconds(startAt, new Date().toISOString()));
    }, 1000);
    return () => clearInterval(interval);
  }, [startAt]);

  return <span className="live-timer">{formatClock(elapsed)}</span>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- liveTimer`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/LiveTimer.tsx src/__tests__/liveTimer.test.tsx
git commit -m "feat: add LiveTimer ticking clock component"
```

---

### Task 4: `RestTimer` component

**Files:**
- Create: `src/components/RestTimer.tsx`
- Test: `src/__tests__/restTimer.test.tsx`

**Interfaces:**
- Consumes: `LiveTimer` (Task 3).
- Produces: `RestTimer({ previousCompletedAt: string; onStartNext: () => void })` — renders a "Rest" label, a `LiveTimer` anchored at `previousCompletedAt`, and a "Start Next Set" button.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/restTimer.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RestTimer } from '../components/RestTimer';

describe('RestTimer', () => {
  it('renders a Rest label and a Start Next Set button', () => {
    render(<RestTimer previousCompletedAt={new Date().toISOString()} onStartNext={() => {}} />);
    expect(screen.getByText('Rest')).toBeInTheDocument();
    expect(screen.getByText('Start Next Set')).toBeInTheDocument();
  });

  it('calls onStartNext when the button is pressed', () => {
    const onStartNext = vi.fn();
    render(<RestTimer previousCompletedAt={new Date().toISOString()} onStartNext={onStartNext} />);
    fireEvent.click(screen.getByText('Start Next Set'));
    expect(onStartNext).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- restTimer`
Expected: FAIL — `src/components/RestTimer.tsx` does not exist.

- [ ] **Step 3: Implement `RestTimer`**

Create `src/components/RestTimer.tsx`:

```tsx
import { LiveTimer } from './LiveTimer';

interface RestTimerProps {
  previousCompletedAt: string;
  onStartNext: () => void;
}

export function RestTimer({ previousCompletedAt, onStartNext }: RestTimerProps) {
  return (
    <div className="rest-timer">
      <span className="rest-timer-label">Rest</span>
      <LiveTimer startAt={previousCompletedAt} />
      <button className="btn btn-primary btn-small" onClick={onStartNext}>Start Next Set</button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- restTimer`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/RestTimer.tsx src/__tests__/restTimer.test.tsx
git commit -m "feat: add RestTimer component"
```

---

### Task 5: `CompletedSetRow` component (replaces the display half of `ExerciseSetRow`)

**Files:**
- Create: `src/components/CompletedSetRow.tsx`
- Test: `src/__tests__/completedSetRow.test.tsx`

**Interfaces:**
- Produces: `CompletedSetRow({ set, trackingType, setIndex, onUpdate, onRemove })` — a collapsed summary row (e.g. `Set 1  80 kg × 8 reps`), tappable to expand into editable weight/reps/duration/distance inputs depending on `trackingType`, with a remove (✕) button.
- Produces (exported, used by tests and reused nowhere else): `summarizeSet(set: ExerciseSet, trackingType: TrackingType): string`.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/completedSetRow.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CompletedSetRow } from '../components/CompletedSetRow';
import type { WeightRepSet } from '../types/gym';

const baseSet: WeightRepSet = {
  id: 'set-1',
  weight: 80,
  weightUnit: 'kg',
  reps: 8,
  startedAt: '2026-01-01T00:00:00.000Z',
  completedAt: '2026-01-01T00:01:00.000Z',
  completed: true,
};

describe('CompletedSetRow', () => {
  it('renders a summary line for a weight-reps set', () => {
    render(
      <CompletedSetRow set={baseSet} trackingType="weight-reps" setIndex={0} onUpdate={() => {}} onRemove={() => {}} />
    );
    expect(screen.getByText('Set 1')).toBeInTheDocument();
    expect(screen.getByText('80 kg × 8 reps')).toBeInTheDocument();
  });

  it('expands to show editable weight and reps inputs on click', () => {
    render(
      <CompletedSetRow set={baseSet} trackingType="weight-reps" setIndex={0} onUpdate={() => {}} onRemove={() => {}} />
    );
    fireEvent.click(screen.getByText('80 kg × 8 reps'));
    expect(screen.getByDisplayValue('80')).toBeInTheDocument();
    expect(screen.getByDisplayValue('8')).toBeInTheDocument();
  });

  it('calls onUpdate when the expanded reps input changes', () => {
    const onUpdate = vi.fn();
    render(
      <CompletedSetRow set={baseSet} trackingType="weight-reps" setIndex={0} onUpdate={onUpdate} onRemove={() => {}} />
    );
    fireEvent.click(screen.getByText('80 kg × 8 reps'));
    fireEvent.change(screen.getByDisplayValue('8'), { target: { value: '9' } });
    expect(onUpdate).toHaveBeenCalledWith('set-1', { reps: 9 });
  });

  it('calls onRemove when the remove button is pressed', () => {
    const onRemove = vi.fn();
    render(
      <CompletedSetRow set={baseSet} trackingType="weight-reps" setIndex={0} onUpdate={() => {}} onRemove={onRemove} />
    );
    fireEvent.click(screen.getByText('80 kg × 8 reps'));
    fireEvent.click(screen.getByLabelText('Remove set 1'));
    expect(onRemove).toHaveBeenCalledWith('set-1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- completedSetRow`
Expected: FAIL — `src/components/CompletedSetRow.tsx` does not exist.

- [ ] **Step 3: Implement `CompletedSetRow`**

Create `src/components/CompletedSetRow.tsx`:

```tsx
import { useState } from 'react';
import type { ExerciseSet, TrackingType, WeightRepSet, RepsOnlySet, DurationSet, DistanceDurationSet } from '../types/gym';

interface CompletedSetRowProps {
  set: ExerciseSet;
  trackingType: TrackingType;
  setIndex: number;
  onUpdate: (setId: string, updates: Partial<ExerciseSet>) => void;
  onRemove: (setId: string) => void;
}

export function CompletedSetRow({ set, trackingType, setIndex, onUpdate, onRemove }: CompletedSetRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="completed-set-row">
      <button
        type="button"
        className="completed-set-summary"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="set-label">Set {setIndex + 1}</span>
        <span className="set-summary-text">{summarizeSet(set, trackingType)}</span>
      </button>
      {expanded && (
        <div className="completed-set-edit">
          {trackingType === 'weight-reps' && renderWeightRepsEdit(set as WeightRepSet, onUpdate)}
          {trackingType === 'reps' && renderRepsEdit(set as RepsOnlySet, onUpdate)}
          {trackingType === 'duration' && renderDurationEdit(set as DurationSet, onUpdate)}
          {trackingType === 'distance-duration' && renderDistanceDurationEdit(set as DistanceDurationSet, onUpdate)}
          <button
            className="btn btn-small btn-danger-outline"
            onClick={() => onRemove(set.id)}
            aria-label={`Remove set ${setIndex + 1}`}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export function summarizeSet(set: ExerciseSet, trackingType: TrackingType): string {
  if (trackingType === 'weight-reps') {
    const s = set as WeightRepSet;
    return `${s.weight ?? '--'} ${s.weightUnit} × ${s.reps ?? '--'} reps`;
  }
  if (trackingType === 'reps') {
    const s = set as RepsOnlySet;
    return `${s.reps ?? '--'} reps`;
  }
  if (trackingType === 'duration') {
    const s = set as DurationSet;
    return `${s.durationSeconds ?? 0}s`;
  }
  const s = set as DistanceDurationSet;
  return `${s.distance ?? '--'} ${s.distanceUnit} in ${s.durationSeconds ?? 0}s`;
}

function renderWeightRepsEdit(set: WeightRepSet, onUpdate: (id: string, u: Partial<ExerciseSet>) => void) {
  return (
    <>
      <div className="set-input-group">
        <label htmlFor={`weight-${set.id}`} className="sr-only">Weight</label>
        <input
          id={`weight-${set.id}`} className="input input-small" type="number" min="0" step="0.5"
          value={set.weight ?? ''}
          onChange={e => onUpdate(set.id, { weight: e.target.value ? parseFloat(e.target.value) : null })}
        />
        <select
          className="input input-small input-unit" value={set.weightUnit}
          onChange={e => onUpdate(set.id, { weightUnit: e.target.value as 'kg' | 'lb' })}
          aria-label="Weight unit"
        >
          <option value="kg">kg</option><option value="lb">lb</option>
        </select>
      </div>
      <div className="set-input-group">
        <label htmlFor={`reps-${set.id}`} className="sr-only">Reps</label>
        <input
          id={`reps-${set.id}`} className="input input-small" type="number" min="0" step="1"
          value={set.reps ?? ''}
          onChange={e => onUpdate(set.id, { reps: e.target.value ? parseInt(e.target.value, 10) : null })}
        />
      </div>
    </>
  );
}

function renderRepsEdit(set: RepsOnlySet, onUpdate: (id: string, u: Partial<ExerciseSet>) => void) {
  return (
    <div className="set-input-group">
      <label htmlFor={`reps-${set.id}`} className="sr-only">Reps</label>
      <input
        id={`reps-${set.id}`} className="input input-small" type="number" min="0" step="1"
        value={set.reps ?? ''}
        onChange={e => onUpdate(set.id, { reps: e.target.value ? parseInt(e.target.value, 10) : null })}
      />
    </div>
  );
}

function renderDurationEdit(set: DurationSet, onUpdate: (id: string, u: Partial<ExerciseSet>) => void) {
  return (
    <div className="set-input-group">
      <label htmlFor={`duration-${set.id}`} className="sr-only">Duration (seconds)</label>
      <input
        id={`duration-${set.id}`} className="input input-small" type="number" min="0" step="1"
        value={set.durationSeconds ?? ''}
        onChange={e => onUpdate(set.id, { durationSeconds: e.target.value ? parseInt(e.target.value, 10) : null })}
      />
    </div>
  );
}

function renderDistanceDurationEdit(set: DistanceDurationSet, onUpdate: (id: string, u: Partial<ExerciseSet>) => void) {
  return (
    <>
      <div className="set-input-group">
        <label htmlFor={`dist-${set.id}`} className="sr-only">Distance</label>
        <input
          id={`dist-${set.id}`} className="input input-small" type="number" min="0" step="0.1"
          value={set.distance ?? ''}
          onChange={e => onUpdate(set.id, { distance: e.target.value ? parseFloat(e.target.value) : null })}
        />
        <select
          className="input input-small input-unit" value={set.distanceUnit}
          onChange={e => onUpdate(set.id, { distanceUnit: e.target.value as 'km' | 'm' | 'mi' })}
          aria-label="Distance unit"
        >
          <option value="km">km</option><option value="m">m</option><option value="mi">mi</option>
        </select>
      </div>
      <div className="set-input-group">
        <label htmlFor={`dur-${set.id}`} className="sr-only">Duration (seconds)</label>
        <input
          id={`dur-${set.id}`} className="input input-small" type="number" min="0" step="1"
          value={set.durationSeconds ?? ''}
          onChange={e => onUpdate(set.id, { durationSeconds: e.target.value ? parseInt(e.target.value, 10) : null })}
        />
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- completedSetRow`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/CompletedSetRow.tsx src/__tests__/completedSetRow.test.tsx
git commit -m "feat: add CompletedSetRow component"
```

---

### Task 6: `SetInProgress` component (replaces the start half of `ExerciseSetRow`) and removal of `ExerciseSetRow`

**Files:**
- Create: `src/components/SetInProgress.tsx`
- Delete: `src/components/ExerciseSetRow.tsx` (fully superseded by `SetInProgress` + `CompletedSetRow`; nothing else imports it after Task 8)
- Test: `src/__tests__/setInProgress.test.tsx`

**Interfaces:**
- Consumes: `LiveTimer` (Task 3), `diffSeconds` (Task 1).
- Produces: `SetInProgress({ mode, set, trackingType, setIndex, defaultWeight, defaultWeightUnit, onStart, onUpdate })`:
  - `mode: 'idle' | 'active' | 'awaiting-input'`
  - `set: ExerciseSet | null` (`null` only when `mode === 'idle'`)
  - `trackingType: TrackingType`
  - `setIndex: number`
  - `defaultWeight: number | null`, `defaultWeightUnit: WeightUnit` — used only for `weight-reps` awaiting-input, pre-filling weight from the most recent prior session.
  - `onStart: () => void` — idle Start button and (via `ExerciseCard`, reused from `RestTimer`) the same handler backs "Start Next Set".
  - `onUpdate: (setId: string, updates: Partial<ExerciseSet>) => void`

- [ ] **Step 1: Write the failing tests**

Note: this component's tests don't need `vi.useFakeTimers()` because `LiveTimer` is already covered in Task 3 — here we only assert the Stop/Start/input wiring, and render `LiveTimer` without asserting its tick.

Create `src/__tests__/setInProgress.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SetInProgress } from '../components/SetInProgress';
import type { DurationSet, WeightRepSet } from '../types/gym';

describe('SetInProgress', () => {
  it('idle mode renders a Start button and calls onStart', () => {
    const onStart = vi.fn();
    render(
      <SetInProgress
        mode="idle" set={null} trackingType="weight-reps" setIndex={0}
        defaultWeight={null} defaultWeightUnit="kg" onStart={onStart} onUpdate={() => {}}
      />
    );
    fireEvent.click(screen.getByText('Start'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('active mode renders a Stop button that, for weight-reps, only stamps completedAt (no reps yet)', () => {
    const onUpdate = vi.fn();
    const set: WeightRepSet = {
      id: 'set-1', weight: null, weightUnit: 'kg', reps: null,
      startedAt: '2026-01-01T00:00:00.000Z', completedAt: null, completed: false,
    };
    render(
      <SetInProgress
        mode="active" set={set} trackingType="weight-reps" setIndex={0}
        defaultWeight={null} defaultWeightUnit="kg" onStart={() => {}} onUpdate={onUpdate}
      />
    );
    fireEvent.click(screen.getByText('Stop'));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    const [setId, updates] = onUpdate.mock.calls[0];
    expect(setId).toBe('set-1');
    expect(updates.completedAt).toBeTruthy();
    expect(updates.completed).toBeUndefined();
    expect(updates.durationSeconds).toBeUndefined();
  });

  it('active mode Stop auto-captures elapsed time as duration for duration tracking type', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:10.000Z'));
    const onUpdate = vi.fn();
    const set: DurationSet = {
      id: 'set-1', durationSeconds: null,
      startedAt: '2026-01-01T00:00:00.000Z', completedAt: null, completed: false,
    };
    render(
      <SetInProgress
        mode="active" set={set} trackingType="duration" setIndex={0}
        defaultWeight={null} defaultWeightUnit="kg" onStart={() => {}} onUpdate={onUpdate}
      />
    );
    fireEvent.click(screen.getByText('Stop'));
    expect(onUpdate).toHaveBeenCalledWith('set-1', { completedAt: '2026-01-01T00:00:10.000Z', completed: true, durationSeconds: 10 });
    vi.useRealTimers();
  });

  it('awaiting-input mode for weight-reps pre-fills weight from defaultWeight and completes on reps entry', () => {
    const onUpdate = vi.fn();
    const set: WeightRepSet = {
      id: 'set-1', weight: null, weightUnit: 'kg', reps: null,
      startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:00:05.000Z', completed: false,
    };
    render(
      <SetInProgress
        mode="awaiting-input" set={set} trackingType="weight-reps" setIndex={0}
        defaultWeight={80} defaultWeightUnit="kg" onStart={() => {}} onUpdate={onUpdate}
      />
    );
    expect(screen.getByDisplayValue('80')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Reps'), { target: { value: '8' } });
    expect(onUpdate).toHaveBeenCalledWith('set-1', { reps: 8, weight: 80, weightUnit: 'kg', completed: true });
  });

  it('awaiting-input mode for reps-only completes on reps entry with no weight field', () => {
    const onUpdate = vi.fn();
    const set = { id: 'set-1', reps: null, startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:00:05.000Z', completed: false };
    render(
      <SetInProgress
        mode="awaiting-input" set={set as never} trackingType="reps" setIndex={0}
        defaultWeight={null} defaultWeightUnit="kg" onStart={() => {}} onUpdate={onUpdate}
      />
    );
    expect(screen.queryByLabelText('Weight unit')).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Reps'), { target: { value: '12' } });
    expect(onUpdate).toHaveBeenCalledWith('set-1', { reps: 12, completed: true });
  });

  it('awaiting-input mode for distance-duration shows only a distance field', () => {
    const onUpdate = vi.fn();
    const set = {
      id: 'set-1', distance: null, distanceUnit: 'km' as const, durationSeconds: 30, notes: '',
      startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:00:30.000Z', completed: false,
    };
    render(
      <SetInProgress
        mode="awaiting-input" set={set as never} trackingType="distance-duration" setIndex={0}
        defaultWeight={null} defaultWeightUnit="kg" onStart={() => {}} onUpdate={onUpdate}
      />
    );
    fireEvent.change(screen.getByPlaceholderText('Distance'), { target: { value: '5' } });
    expect(onUpdate).toHaveBeenCalledWith('set-1', { distance: 5, completed: true });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- setInProgress`
Expected: FAIL — `src/components/SetInProgress.tsx` does not exist.

- [ ] **Step 3: Implement `SetInProgress` and delete `ExerciseSetRow`**

Create `src/components/SetInProgress.tsx`:

```tsx
import type { ExerciseSet, TrackingType, WeightRepSet, WeightUnit } from '../types/gym';
import { diffSeconds } from '../utils/dateTime';
import { LiveTimer } from './LiveTimer';

interface SetInProgressProps {
  mode: 'idle' | 'active' | 'awaiting-input';
  set: ExerciseSet | null;
  trackingType: TrackingType;
  setIndex: number;
  defaultWeight: number | null;
  defaultWeightUnit: WeightUnit;
  onStart: () => void;
  onUpdate: (setId: string, updates: Partial<ExerciseSet>) => void;
}

export function SetInProgress({
  mode, set, trackingType, setIndex, defaultWeight, defaultWeightUnit, onStart, onUpdate,
}: SetInProgressProps) {
  if (mode === 'idle' || !set) {
    return (
      <div className="current-set-card">
        <span className="set-label">Set {setIndex + 1}</span>
        <button className="btn btn-primary btn-small" onClick={onStart}>Start</button>
      </div>
    );
  }

  if (mode === 'active') {
    return (
      <div className="current-set-card">
        <span className="set-label">Set {setIndex + 1}</span>
        <LiveTimer startAt={set.startedAt!} />
        <button className="btn btn-primary btn-small" onClick={() => handleStop(set, trackingType, onUpdate)}>
          Stop
        </button>
      </div>
    );
  }

  return (
    <div className="current-set-card">
      <span className="set-label">Set {setIndex + 1}</span>
      {trackingType === 'weight-reps' && renderWeightRepsInput(set as WeightRepSet, defaultWeight, defaultWeightUnit, onUpdate)}
      {trackingType === 'reps' && renderRepsInput(set, onUpdate)}
      {trackingType === 'distance-duration' && renderDistanceInput(set, onUpdate)}
    </div>
  );
}

function handleStop(set: ExerciseSet, trackingType: TrackingType, onUpdate: (id: string, u: Partial<ExerciseSet>) => void) {
  const now = new Date().toISOString();
  if (trackingType === 'duration') {
    const durationSeconds = diffSeconds(set.startedAt!, now);
    onUpdate(set.id, { completedAt: now, completed: true, durationSeconds });
  } else if (trackingType === 'distance-duration') {
    const durationSeconds = diffSeconds(set.startedAt!, now);
    onUpdate(set.id, { completedAt: now, durationSeconds });
  } else {
    onUpdate(set.id, { completedAt: now });
  }
}

function renderWeightRepsInput(
  set: WeightRepSet,
  defaultWeight: number | null,
  defaultWeightUnit: WeightUnit,
  onUpdate: (id: string, u: Partial<ExerciseSet>) => void,
) {
  const weightValue = set.weight ?? defaultWeight;
  const weightUnit = set.weight !== null ? set.weightUnit : defaultWeightUnit;
  return (
    <>
      <div className="set-input-group">
        <label htmlFor={`weight-${set.id}`} className="sr-only">Weight</label>
        <input
          id={`weight-${set.id}`} className="input input-small" type="number" min="0" step="0.5" placeholder="Weight"
          value={weightValue ?? ''}
          onChange={e => onUpdate(set.id, { weight: e.target.value ? parseFloat(e.target.value) : null })}
        />
        <select
          className="input input-small input-unit" value={weightUnit}
          onChange={e => onUpdate(set.id, { weightUnit: e.target.value as WeightUnit })}
          aria-label="Weight unit"
        >
          <option value="kg">kg</option><option value="lb">lb</option>
        </select>
      </div>
      <div className="set-input-group">
        <label htmlFor={`reps-${set.id}`} className="sr-only">Reps</label>
        <input
          id={`reps-${set.id}`} className="input input-small" type="number" min="0" step="1" placeholder="Reps" autoFocus
          value={set.reps ?? ''}
          onChange={e => {
            const reps = e.target.value ? parseInt(e.target.value, 10) : null;
            onUpdate(set.id, { reps, weight: set.weight ?? defaultWeight, weightUnit, completed: reps !== null });
          }}
        />
      </div>
    </>
  );
}

function renderRepsInput(set: ExerciseSet, onUpdate: (id: string, u: Partial<ExerciseSet>) => void) {
  const s = set as { id: string; reps: number | null };
  return (
    <div className="set-input-group">
      <label htmlFor={`reps-${s.id}`} className="sr-only">Reps</label>
      <input
        id={`reps-${s.id}`} className="input input-small" type="number" min="0" step="1" placeholder="Reps" autoFocus
        value={s.reps ?? ''}
        onChange={e => {
          const reps = e.target.value ? parseInt(e.target.value, 10) : null;
          onUpdate(s.id, { reps, completed: reps !== null });
        }}
      />
    </div>
  );
}

function renderDistanceInput(set: ExerciseSet, onUpdate: (id: string, u: Partial<ExerciseSet>) => void) {
  const s = set as { id: string; distance: number | null; distanceUnit: 'km' | 'm' | 'mi' };
  return (
    <div className="set-input-group">
      <label htmlFor={`dist-${s.id}`} className="sr-only">Distance</label>
      <input
        id={`dist-${s.id}`} className="input input-small" type="number" min="0" step="0.1" placeholder="Distance" autoFocus
        value={s.distance ?? ''}
        onChange={e => {
          const distance = e.target.value ? parseFloat(e.target.value) : null;
          onUpdate(s.id, { distance, completed: distance !== null });
        }}
      />
      <select
        className="input input-small input-unit" value={s.distanceUnit}
        onChange={e => onUpdate(s.id, { distanceUnit: e.target.value as 'km' | 'm' | 'mi' })}
        aria-label="Distance unit"
      >
        <option value="km">km</option><option value="m">m</option><option value="mi">mi</option>
      </select>
    </div>
  );
}
```

Delete the now-superseded file:

```bash
git rm src/components/ExerciseSetRow.tsx
```

(`ExerciseCard.tsx` still imports `ExerciseSetRow` at this point — that import is removed in Task 8. Leave that breakage for now; it's fixed in the very next task.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- setInProgress`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A src/components/SetInProgress.tsx src/__tests__/setInProgress.test.tsx
git commit -m "feat: add SetInProgress component, remove ExerciseSetRow"
```

---

### Task 7: `ExerciseSwapControl` component

**Files:**
- Create: `src/components/ExerciseSwapControl.tsx`
- Test: `src/__tests__/exerciseSwapControl.test.tsx`

**Interfaces:**
- Produces: `ExerciseSwapControl({ currentExerciseId, allExercises, disabled, onSwap })` — a `<select>` of exercise names; hidden entirely when `disabled` is true; calls `onSwap(newExerciseId)` when a different exercise is chosen.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/exerciseSwapControl.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ExerciseSwapControl } from '../components/ExerciseSwapControl';
import type { Exercise } from '../types/gym';

const exercises: Exercise[] = [
  { id: 'ex-1', name: 'Bench Press', category: 'chest', trackingType: 'weight-reps', isPreset: true },
  { id: 'ex-2', name: 'Push-up', category: 'chest', trackingType: 'reps', isPreset: true },
];

describe('ExerciseSwapControl', () => {
  it('renders a select with all exercise names when not disabled', () => {
    render(
      <ExerciseSwapControl currentExerciseId="ex-1" allExercises={exercises} disabled={false} onSwap={() => {}} />
    );
    expect(screen.getByLabelText('Change exercise')).toBeInTheDocument();
    expect(screen.getByText('Push-up')).toBeInTheDocument();
  });

  it('renders nothing when disabled', () => {
    render(
      <ExerciseSwapControl currentExerciseId="ex-1" allExercises={exercises} disabled={true} onSwap={() => {}} />
    );
    expect(screen.queryByLabelText('Change exercise')).not.toBeInTheDocument();
  });

  it('calls onSwap with the newly selected exercise id', () => {
    const onSwap = vi.fn();
    render(
      <ExerciseSwapControl currentExerciseId="ex-1" allExercises={exercises} disabled={false} onSwap={onSwap} />
    );
    fireEvent.change(screen.getByLabelText('Change exercise'), { target: { value: 'ex-2' } });
    expect(onSwap).toHaveBeenCalledWith('ex-2');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- exerciseSwapControl`
Expected: FAIL — `src/components/ExerciseSwapControl.tsx` does not exist.

- [ ] **Step 3: Implement `ExerciseSwapControl`**

Create `src/components/ExerciseSwapControl.tsx`:

```tsx
import type { Exercise } from '../types/gym';

interface ExerciseSwapControlProps {
  currentExerciseId: string;
  allExercises: Exercise[];
  disabled: boolean;
  onSwap: (newExerciseId: string) => void;
}

export function ExerciseSwapControl({ currentExerciseId, allExercises, disabled, onSwap }: ExerciseSwapControlProps) {
  if (disabled) return null;
  return (
    <select
      className="input input-small exercise-swap-select"
      value={currentExerciseId}
      onClick={e => e.stopPropagation()}
      onChange={e => { if (e.target.value !== currentExerciseId) onSwap(e.target.value); }}
      aria-label="Change exercise"
    >
      {allExercises.map(ex => (
        <option key={ex.id} value={ex.id}>{ex.name}</option>
      ))}
    </select>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- exerciseSwapControl`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ExerciseSwapControl.tsx src/__tests__/exerciseSwapControl.test.tsx
git commit -m "feat: add ExerciseSwapControl component"
```

---

### Task 8: Rewrite `ExerciseCard` to derive UI phase and wire the new subcomponents

**Files:**
- Modify: `src/components/ExerciseCard.tsx`
- Modify: `src/styles/global.css` (append new classes used by the rewritten card and its children)
- Test: `src/__tests__/exerciseCard.test.tsx` (new — no prior dedicated test file existed for this component)

**Interfaces:**
- Consumes: `CompletedSetRow` (Task 5), `SetInProgress` (Task 6), `RestTimer` (Task 4), `ExerciseSwapControl` (Task 7), `findMostRecentExerciseResult` (existing, unchanged).
- Produces: `ExerciseCard({ exercise, workoutHistory, allExercises, onSetDone, onUpdateSet, onAddSet, onRemoveSet, onSwapExercise })`. Replaces the old `onStart`/`onComplete` props.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/exerciseCard.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ExerciseCard } from '../components/ExerciseCard';
import type { ActiveExercise, Exercise } from '../types/gym';

const exerciseDef: Exercise = { id: 'ex-1', name: 'Bench Press', category: 'chest', trackingType: 'weight-reps', isPreset: true };
const otherDef: Exercise = { id: 'ex-2', name: 'Push-up', category: 'chest', trackingType: 'reps', isPreset: true };

function makeExercise(overrides: Partial<ActiveExercise> = {}): ActiveExercise {
  return {
    id: 'active-1',
    exerciseId: 'ex-1',
    exerciseName: 'Bench Press',
    trackingType: 'weight-reps',
    sets: [],
    notes: '',
    startedAt: null,
    completedAt: null,
    completed: false,
    ...overrides,
  };
}

function renderCard(exercise: ActiveExercise, overrides: Partial<React.ComponentProps<typeof ExerciseCard>> = {}) {
  return render(
    <ExerciseCard
      exercise={exercise}
      workoutHistory={[]}
      allExercises={[exerciseDef, otherDef]}
      onSetDone={() => {}}
      onUpdateSet={() => {}}
      onAddSet={() => {}}
      onRemoveSet={() => {}}
      onSwapExercise={() => {}}
      {...overrides}
    />
  );
}

describe('ExerciseCard', () => {
  it('shows an idle Start button when no sets have been logged yet', () => {
    renderCard(makeExercise());
    fireEvent.click(document.querySelector('.exercise-card-header')!);
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('Not Started')).toBeInTheDocument();
  });

  it('shows the active timer and Stop button, and In Progress badge, once a set is in progress', () => {
    const exercise = makeExercise({
      startedAt: '2026-01-01T00:00:00.000Z',
      sets: [{ id: 'set-1', weight: null, weightUnit: 'kg', reps: null, startedAt: '2026-01-01T00:00:00.000Z', completedAt: null, completed: false }],
    });
    renderCard(exercise);
    fireEvent.click(document.querySelector('.exercise-card-header')!);
    expect(screen.getByText('Stop')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('shows a rest timer and "Mark exercise done" link once a set has been completed', () => {
    const exercise = makeExercise({
      startedAt: '2026-01-01T00:00:00.000Z',
      sets: [{ id: 'set-1', weight: 80, weightUnit: 'kg', reps: 8, startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:01:00.000Z', completed: true }],
    });
    renderCard(exercise);
    fireEvent.click(document.querySelector('.exercise-card-header')!);
    expect(screen.getByText('Rest')).toBeInTheDocument();
    expect(screen.getByText('Start Next Set')).toBeInTheDocument();
    expect(screen.getByText('Mark exercise done')).toBeInTheDocument();
    expect(screen.getByText('80 kg × 8 reps')).toBeInTheDocument();
  });

  it('calls onSetDone(true) when "Mark exercise done" is pressed', () => {
    const onSetDone = vi.fn();
    const exercise = makeExercise({
      sets: [{ id: 'set-1', weight: 80, weightUnit: 'kg', reps: 8, startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:01:00.000Z', completed: true }],
    });
    renderCard(exercise, { onSetDone });
    fireEvent.click(document.querySelector('.exercise-card-header')!);
    fireEvent.click(screen.getByText('Mark exercise done'));
    expect(onSetDone).toHaveBeenCalledWith(true);
  });

  it('shows Done badge and a Resume link, and hides the swap control, once completed', () => {
    const exercise = makeExercise({
      completed: true,
      sets: [{ id: 'set-1', weight: 80, weightUnit: 'kg', reps: 8, startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:01:00.000Z', completed: true }],
    });
    renderCard(exercise);
    fireEvent.click(document.querySelector('.exercise-card-header')!);
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Resume / log another set')).toBeInTheDocument();
    expect(screen.queryByLabelText('Change exercise')).not.toBeInTheDocument();
  });

  it('hides the exercise swap control once any set has been logged', () => {
    const exercise = makeExercise({
      sets: [{ id: 'set-1', weight: 80, weightUnit: 'kg', reps: 8, startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:01:00.000Z', completed: true }],
    });
    renderCard(exercise);
    fireEvent.click(document.querySelector('.exercise-card-header')!);
    expect(screen.queryByLabelText('Change exercise')).not.toBeInTheDocument();
  });

  it('shows the exercise swap control before any set is logged', () => {
    renderCard(makeExercise());
    fireEvent.click(document.querySelector('.exercise-card-header')!);
    expect(screen.getByLabelText('Change exercise')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- exerciseCard`
Expected: FAIL — `ExerciseCard.tsx` still has the old `onStart`/`onComplete`/pre-batched-sets API and imports the now-deleted `ExerciseSetRow`.

- [ ] **Step 3: Rewrite `ExerciseCard.tsx`**

Replace the full contents of `src/components/ExerciseCard.tsx`:

```tsx
import { useState } from 'react';
import type { ActiveExercise, Exercise, ExerciseSet, WorkoutSession } from '../types/gym';
import { CompletedSetRow } from './CompletedSetRow';
import { SetInProgress } from './SetInProgress';
import { RestTimer } from './RestTimer';
import { ExerciseSwapControl } from './ExerciseSwapControl';
import { findMostRecentExerciseResult } from '../utils/exerciseHistory';

interface ExerciseCardProps {
  exercise: ActiveExercise;
  workoutHistory: WorkoutSession[];
  allExercises: Exercise[];
  onSetDone: (done: boolean) => void;
  onUpdateSet: (setId: string, updates: Partial<ExerciseSet>) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onSwapExercise: (newExerciseId: string) => void;
}

export function ExerciseCard({
  exercise, workoutHistory, allExercises, onSetDone, onUpdateSet, onAddSet, onRemoveSet, onSwapExercise,
}: ExerciseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const previousResult = findMostRecentExerciseResult(workoutHistory, exercise.exerciseId);
  const lastPreviousSet = previousResult?.sets[previousResult.sets.length - 1] ?? null;
  const defaultWeight = lastPreviousSet?.type === 'weight-reps' ? (lastPreviousSet.weight ?? null) : null;
  const defaultWeightUnit = lastPreviousSet?.type === 'weight-reps' ? (lastPreviousSet.weightUnit ?? 'kg') : 'kg';

  const completedSets = exercise.sets.filter(s => s.completed);
  const activeSet = exercise.sets.find(s => !s.completed) ?? null;
  const lastCompletedSet = completedSets.length > 0 ? completedSets[completedSets.length - 1] : null;

  return (
    <div className={`exercise-card ${exercise.completed ? 'completed' : ''}`}>
      <div className="exercise-card-header" onClick={() => setExpanded(!expanded)}>
        <div>
          <h3 className="exercise-name">{exercise.exerciseName}</h3>
          <span className="exercise-meta">{trackingLabel(exercise.trackingType)}</span>
        </div>
        <div className="exercise-status">
          {exercise.completed ? (
            <span className="badge badge-success">Done</span>
          ) : exercise.startedAt ? (
            <span className="badge badge-active">In Progress</span>
          ) : (
            <span className="badge badge-pending">Not Started</span>
          )}
        </div>
      </div>
      {expanded && (
        <div className="exercise-card-body">
          <ExerciseSwapControl
            currentExerciseId={exercise.exerciseId}
            allExercises={allExercises}
            disabled={exercise.sets.length > 0}
            onSwap={onSwapExercise}
          />
          {previousResult && (
            <div className="previous-result">
              <strong>Last time:</strong>
              {previousResult.sets.map(set => (
                <div key={set.id} className="previous-set">
                  {set.type === 'weight-reps' && `${set.weight} ${set.weightUnit} × ${set.reps}`}
                  {set.type === 'reps' && `${set.reps} reps`}
                  {set.type === 'duration' && `${set.durationSeconds}s`}
                  {set.type === 'distance-duration' && `${set.distance} ${set.distanceUnit} in ${set.durationSeconds}s`}
                </div>
              ))}
            </div>
          )}
          <div className="sets-list">
            {completedSets.map((set, i) => (
              <CompletedSetRow
                key={set.id}
                set={set}
                trackingType={exercise.trackingType}
                setIndex={i}
                onUpdate={onUpdateSet}
                onRemove={onRemoveSet}
              />
            ))}
          </div>
          {exercise.completed ? (
            <button className="btn btn-small btn-outline" onClick={() => onSetDone(false)}>
              Resume / log another set
            </button>
          ) : (
            <>
              {activeSet ? (
                <SetInProgress
                  mode={activeSet.completedAt ? 'awaiting-input' : 'active'}
                  set={activeSet}
                  trackingType={exercise.trackingType}
                  setIndex={exercise.sets.length - 1}
                  defaultWeight={defaultWeight}
                  defaultWeightUnit={defaultWeightUnit}
                  onStart={onAddSet}
                  onUpdate={onUpdateSet}
                />
              ) : lastCompletedSet ? (
                <RestTimer previousCompletedAt={lastCompletedSet.completedAt!} onStartNext={onAddSet} />
              ) : (
                <SetInProgress
                  mode="idle"
                  set={null}
                  trackingType={exercise.trackingType}
                  setIndex={0}
                  defaultWeight={defaultWeight}
                  defaultWeightUnit={defaultWeightUnit}
                  onStart={onAddSet}
                  onUpdate={onUpdateSet}
                />
              )}
              {completedSets.length > 0 && (
                <button className="btn btn-small btn-success" onClick={() => onSetDone(true)}>
                  Mark exercise done
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function trackingLabel(type: string): string {
  switch (type) {
    case 'weight-reps': return 'Weight × Reps';
    case 'reps': return 'Reps';
    case 'duration': return 'Duration';
    case 'distance-duration': return 'Distance + Duration';
    default: return '';
  }
}
```

Append these classes to `src/styles/global.css` (near the existing `/* Set rows */` section):

```css
/* Current set / rest / swap */
.current-set-card {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) 0;
  flex-wrap: wrap;
}

.rest-timer {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) 0;
}

.rest-timer-label { font-weight: 600; color: var(--text-secondary); }

.live-timer { font-variant-numeric: tabular-nums; font-weight: 600; }

.completed-set-row { border-bottom: 1px solid var(--border); }

.completed-set-summary {
  display: flex;
  justify-content: space-between;
  width: 100%;
  background: none;
  border: none;
  padding: var(--space-xs) 0;
  cursor: pointer;
  font: inherit;
  color: inherit;
  text-align: left;
}

.completed-set-edit {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
  padding: var(--space-xs) 0 var(--space-sm);
}

.exercise-swap-select { margin-bottom: var(--space-sm); }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- exerciseCard`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ExerciseCard.tsx src/styles/global.css src/__tests__/exerciseCard.test.tsx
git commit -m "feat: rewrite ExerciseCard to derive UI phase from set state"
```

---

### Task 9: Wire `TodayPage`, update `allComplete` gating, and update the end-to-end flow test

**Files:**
- Modify: `src/pages/TodayPage.tsx`
- Modify: `src/__tests__/gymTracker.test.tsx` (update the existing end-to-end test to the new flow)
- Create: `src/__tests__/gymTrackerActions.test.tsx` (new hook-behavior tests for `setExerciseDone`/`swapExerciseForToday`/one-at-a-time `addSet`, driven through the rendered page now that `TodayPage`/`ExerciseCard` support the new flow)

**Interfaces:**
- Consumes: `setExerciseDone`, `swapExerciseForToday`, `getAllExercises` (from `useGymTracker`, Task 2), `ExerciseCard`'s new prop API (Task 8).

- [ ] **Step 1: Update `TodayPage.tsx`**

Replace the full contents of `src/pages/TodayPage.tsx`:

```tsx
import { useGymTracker } from '../hooks/useGymTracker';
import { WorkoutHeader } from '../components/WorkoutHeader';
import { ExerciseCard } from '../components/ExerciseCard';
import { WorkoutCompletionModal } from '../components/WorkoutCompletionModal';
import { useState } from 'react';

export function TodayPage() {
  const {
    data, startWorkout, getCurrentWorkoutDay,
    finishWorkout, skipWorkout, setExerciseDone,
    updateSet, addSet, removeSet, swapExerciseForToday,
    getAllExercises, getNextWorkout,
  } = useGymTracker();
  const [showModal, setShowModal] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  const workout = getCurrentWorkoutDay();
  const active = data.activeWorkout;

  if (!workout) {
    return <div className="today-page"><p>No workouts defined. Go to Plan to add one.</p></div>;
  }

  if (!active) {
    return (
      <div className="today-page">
        <div className="workout-preview">
          <h1>{workout.name}</h1>
          <p>{workout.exercises.length} exercises</p>
          <button className="btn btn-primary btn-large" onClick={startWorkout}>
            Start Workout
          </button>
        </div>
      </div>
    );
  }

  const incompleteExercises = active.exercises.filter(e => !e.completed);
  const allComplete = incompleteExercises.length === 0;
  const allExercises = getAllExercises();

  function handleFinish() {
    if (!allComplete) {
      setShowModal(true);
      return;
    }
    finishWorkout();
    setShowModal(true);
  }

  function handleFinishAnyway() {
    setShowModal(false);
    finishWorkout();
    setShowModal(true);
  }

  function handleSkip() {
    skipWorkout();
    setShowSkipConfirm(false);
  }

  return (
    <div className="today-page">
      <WorkoutHeader activeWorkout={active} />
      <div className="exercise-list">
        {active.exercises.map(exercise => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            workoutHistory={data.workoutHistory}
            allExercises={allExercises}
            onSetDone={(done) => setExerciseDone(exercise.id, done)}
            onUpdateSet={(setId, updates) => updateSet(exercise.id, setId, updates)}
            onAddSet={() => addSet(exercise.id)}
            onRemoveSet={(setId) => removeSet(exercise.id, setId)}
            onSwapExercise={(newExerciseId) => swapExerciseForToday(exercise.id, newExerciseId)}
          />
        ))}
      </div>
      <div className="workout-actions">
        <button className="btn btn-primary btn-large" onClick={handleFinish}>
          Finish Workout
        </button>
        <button className="btn btn-secondary" onClick={() => setShowSkipConfirm(true)}>
          Skip Workout
        </button>
      </div>
      {showSkipConfirm && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Skip workout confirmation">
          <div className="modal">
            <p>Skip {active.workoutName}? No exercise records will be saved.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowSkipConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleSkip}>Skip Workout</button>
            </div>
          </div>
        </div>
      )}
      {showModal && (
        <WorkoutCompletionModal
          nextWorkout={getNextWorkout()}
          allComplete={allComplete}
          incompleteCount={incompleteExercises.length}
          onFinishAnyway={handleFinishAnyway}
          onReturn={() => setShowModal(false)}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update the existing end-to-end test to the new flow**

Replace the second test in `src/__tests__/gymTracker.test.tsx` (`'advances to Workout B after finishing Workout A'`). Read the file first, then replace its body. The new version (all four Workout A exercises are `weight-reps`, so every exercise's flow uses the same "Reps"-labeled input):

```tsx
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { type ReactNode } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Navigation } from '../components/Navigation';
import { TodayPage } from '../pages/TodayPage';

vi.mock('../api/sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/sync')>();
  return {
    ...actual,
    isOnline: () => false,
    enqueue: vi.fn(),
    processQueue: vi.fn(),
    setupSyncListener: () => () => {},
  };
});

const mockUser = { id: 'test-id', email: 'test@test.com', created_at: '2025-01-01T00:00:00Z' };

function MockAuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider value={{ user: mockUser, loading: false, login: async () => {}, register: async () => {}, logout: () => {} }}>
      {children}
    </AuthContext.Provider>
  );
}

function renderApp() {
  return render(
    <MockAuthProvider>
      <MemoryRouter initialEntries={['/']}>
        <div className="app">
          <Navigation />
          <main className="main-content">
            <TodayPage />
          </main>
        </div>
      </MemoryRouter>
    </MockAuthProvider>
  );
}

describe('Gym Tracker', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('displays Workout A by default', () => {
    renderApp();
    expect(screen.getByText('Workout A')).toBeInTheDocument();
  });

  it('advances to Workout B after finishing Workout A', async () => {
    renderApp();
    await act(async () => {
      fireEvent.click(screen.getByText('Start Workout'));
    });
    document.querySelectorAll('.exercise-card-header').forEach(header => {
      fireEvent.click(header);
    });

    const cards = Array.from(document.querySelectorAll('.exercise-card-body'));
    for (const card of cards) {
      const scoped = within(card as HTMLElement);
      for (let setNum = 0; setNum < 3; setNum++) {
        const startLabel = setNum === 0 ? 'Start' : 'Start Next Set';
        await act(async () => {
          fireEvent.click(scoped.getByText(startLabel));
        });
        await act(async () => {
          fireEvent.click(scoped.getByText('Stop'));
        });
        await act(async () => {
          fireEvent.change(scoped.getByPlaceholderText('Reps'), { target: { value: '10' } });
        });
      }
      await act(async () => {
        fireEvent.click(scoped.getByText('Mark exercise done'));
      });
    }

    await act(async () => {
      fireEvent.click(screen.getByText('Finish Workout'));
    });
    expect(screen.getByText('Workout B')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Add hook-behavior tests for `setExerciseDone` and `swapExerciseForToday`**

Create `src/__tests__/gymTrackerActions.test.tsx`:

```tsx
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { type ReactNode } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Navigation } from '../components/Navigation';
import { TodayPage } from '../pages/TodayPage';

vi.mock('../api/sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/sync')>();
  return {
    ...actual,
    isOnline: () => false,
    enqueue: vi.fn(),
    processQueue: vi.fn(),
    setupSyncListener: () => () => {},
  };
});

const mockUser = { id: 'test-id', email: 'test@test.com', created_at: '2025-01-01T00:00:00Z' };

function MockAuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider value={{ user: mockUser, loading: false, login: async () => {}, register: async () => {}, logout: () => {} }}>
      {children}
    </AuthContext.Provider>
  );
}

function renderApp() {
  return render(
    <MockAuthProvider>
      <MemoryRouter initialEntries={['/']}>
        <div className="app">
          <Navigation />
          <main className="main-content">
            <TodayPage />
          </main>
        </div>
      </MemoryRouter>
    </MockAuthProvider>
  );
}

describe('useGymTracker actions', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts a workout with zero pre-created sets per exercise (one idle Start button each)', async () => {
    renderApp();
    await act(async () => {
      fireEvent.click(screen.getByText('Start Workout'));
    });
    document.querySelectorAll('.exercise-card-header').forEach(header => fireEvent.click(header));
    expect(screen.getAllByText('Start')).toHaveLength(4);
  });

  it('marks the exercise In Progress once its first set is started', async () => {
    renderApp();
    await act(async () => {
      fireEvent.click(screen.getByText('Start Workout'));
    });
    document.querySelectorAll('.exercise-card-header').forEach(header => fireEvent.click(header));
    await act(async () => {
      fireEvent.click(screen.getAllByText('Start')[0]);
    });
    expect(screen.getAllByText('In Progress')).toHaveLength(1);
  });

  it('marks an exercise done via "Mark exercise done" and shows a Resume link', async () => {
    renderApp();
    await act(async () => {
      fireEvent.click(screen.getByText('Start Workout'));
    });
    document.querySelectorAll('.exercise-card-header').forEach(header => fireEvent.click(header));
    const firstCard = within(document.querySelectorAll('.exercise-card-body')[0] as HTMLElement);
    await act(async () => {
      fireEvent.click(firstCard.getByText('Start'));
    });
    await act(async () => {
      fireEvent.click(firstCard.getByText('Stop'));
    });
    await act(async () => {
      fireEvent.change(firstCard.getByPlaceholderText('Reps'), { target: { value: '10' } });
    });
    await act(async () => {
      fireEvent.click(firstCard.getByText('Mark exercise done'));
    });
    expect(firstCard.getByText('Resume / log another set')).toBeInTheDocument();
  });

  it('swaps today\'s exercise before any set is logged, without touching the saved plan', async () => {
    renderApp();
    await act(async () => {
      fireEvent.click(screen.getByText('Start Workout'));
    });
    document.querySelectorAll('.exercise-card-header').forEach(header => fireEvent.click(header));
    const firstCard = within(document.querySelectorAll('.exercise-card-body')[0] as HTMLElement);
    const select = firstCard.getByLabelText('Change exercise') as HTMLSelectElement;
    const otherOption = Array.from(select.options).find(o => o.value !== select.value)!;
    await act(async () => {
      fireEvent.change(select, { target: { value: otherOption.value } });
    });
    expect(screen.getByText(otherOption.text)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run all tests to verify everything passes**

Run: `npm test`
Expected: PASS — every test file (`dateTime`, `liveTimer`, `restTimer`, `completedSetRow`, `setInProgress`, `exerciseSwapControl`, `exerciseCard`, `gymTrackerActions`, `gymTracker`, `workoutCompletionModal`, `apiContract`, `planContract`, `storageMigration`) is green.

- [ ] **Step 5: Type-check and build the whole app**

Run: `npm run build`
Expected: succeeds with no TypeScript errors (confirms no other file still references the removed `startExercise`/`completeExercise`/`ExerciseSetRow`).

Run: `npm run lint`
Expected: no lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/TodayPage.tsx src/__tests__/gymTracker.test.tsx src/__tests__/gymTrackerActions.test.tsx
git commit -m "feat: wire TodayPage to new set-logging flow and update end-to-end tests"
```

---

## Post-plan manual check (not a task, just a sanity pass)

After Task 9, manually run `npm run dev`, start a workout, and walk through: Start → Stop → type reps → see rest timer counting up → Start Next Set → ... → Mark exercise done → Finish Workout — confirming the flow matches the approved spec before considering this feature done.
