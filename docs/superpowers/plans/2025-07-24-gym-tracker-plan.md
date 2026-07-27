# Gym Tracker Frontend MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully functional single-page gym workout tracking app that runs entirely in the browser with localStorage persistence.

**Architecture:** React 19 + TypeScript 6 + Vite 8 SPA with react-router-dom v7 for client-side routing. All state managed via a custom `useGymTracker` hook backed by localStorage. No backend, no external state management.

**Tech Stack:** React 19, TypeScript 6, Vite 8, react-router-dom v7, Vitest + React Testing Library, regular CSS with CSS variables.

## Global Constraints

- Strict TypeScript — no `any` anywhere
- No backend, no database, no authentication, no API calls
- No Tailwind CSS, no component library, no Redux, no external state management
- All state persisted to localStorage under key `gym-tracker-data-v1`
- Mobile-first responsive design
- Every input must have an associated label
- No browser alerts for validation — use inline messages
- Completion not represented by color alone
- Pure helper functions for business logic outside components

---

## File Structure

All new files under `src/`:

```
src/
├── main.tsx
├── App.tsx
├── types/gym.ts
├── data/
│   ├── presetExercises.ts
│   └── defaultWorkoutPlan.ts
├── utils/
│   ├── storage.ts
│   ├── rotation.ts
│   ├── exerciseHistory.ts
│   ├── dateTime.ts
│   └── validation.ts
├── hooks/
│   └── useGymTracker.ts
├── components/
│   ├── ExerciseCard.tsx
│   ├── ExerciseSetRow.tsx
│   ├── WorkoutHeader.tsx
│   ├── WorkoutCompletionModal.tsx
│   ├── Navigation.tsx
│   └── CustomExerciseForm.tsx
├── pages/
│   ├── TodayPage.tsx
│   ├── PlanPage.tsx
│   ├── ExerciseLibraryPage.tsx
│   ├── HistoryPage.tsx
│   └── SettingsPage.tsx
├── styles/
│   ├── variables.css
│   └── global.css
```

---

### Task 1: Project Setup — Dependencies, Vite Config, Global Styles

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `tsconfig.app.json`
- Create: `src/styles/variables.css`
- Create: `src/styles/global.css`

**Interfaces:**
- Consumes: existing Vite scaffold
- Produces: dev environment with router + test deps, global CSS with design tokens

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/ngoclinhdo/Projects/gym-tracker/frontend
npm install react-router-dom
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

Expected output: packages installed with no errors.

- [ ] **Step 2: Configure vite.config.ts for tests**

Read the existing file first, then update:

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
})
```

- [ ] **Step 3: Update tsconfig.app.json compilerOptions**

Add or ensure these are present:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

- [ ] **Step 4: Create src/styles/variables.css**

```css
:root {
  --background: #f7f7f7;
  --surface: #ffffff;
  --surface-muted: #f0f0f0;
  --text-primary: #171717;
  --text-secondary: #666666;
  --border: #dddddd;
  --success: #237a3b;
  --danger: #b3261e;
  --radius-small: 8px;
  --radius-medium: 12px;
  --radius-large: 18px;
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
```

- [ ] **Step 5: Create src/styles/global.css**

```css
@import './variables.css';

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-family);
  background: var(--background);
  color: var(--text-primary);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

button {
  cursor: pointer;
  font: inherit;
}

input, select {
  font: inherit;
}

a {
  color: inherit;
  text-decoration: none;
}
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `src/types/gym.ts`

**Interfaces:**
- Consumes: nothing
- Produces: all types imported by every other file

- [ ] **Step 1: Create src/types/gym.ts with all types**

```typescript
export type ExerciseCategory =
  | 'lower-body'
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'core'
  | 'cardio'
  | 'other';

export type TrackingType =
  | 'weight-reps'
  | 'reps'
  | 'duration'
  | 'distance-duration';

export type WeightUnit = 'kg' | 'lb';

export type DistanceUnit = 'km' | 'm' | 'mi';

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  trackingType: TrackingType;
  equipment?: string;
  isPreset: boolean;
}

export interface WeightRepSet {
  id: string;
  weight: number | null;
  weightUnit: WeightUnit;
  reps: number | null;
  completed: boolean;
}

export interface RepsOnlySet {
  id: string;
  reps: number | null;
  completed: boolean;
}

export interface DurationSet {
  id: string;
  durationSeconds: number | null;
  completed: boolean;
}

export interface DistanceDurationSet {
  id: string;
  distance: number | null;
  distanceUnit: DistanceUnit;
  durationSeconds: number | null;
  notes: string;
  completed: boolean;
}

export type ExerciseSet = WeightRepSet | RepsOnlySet | DurationSet | DistanceDurationSet;

export interface WorkoutDay {
  id: string;
  name: string;
  exercises: PlannedExercise[];
}

export interface PlannedExercise {
  id: string;
  exerciseId: string;
  position: number;
  targetSets: number;
  notes?: string;
}

export interface ActiveWorkoutSession {
  id: string;
  workoutDayId: string;
  workoutName: string;
  date: string;
  startedAt: string | null;
  completedAt: string | null;
  status: 'not-started' | 'in-progress';
  exercises: ActiveExercise[];
}

export interface ActiveExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  trackingType: TrackingType;
  startedAt: string | null;
  completedAt: string | null;
  completed: boolean;
  sets: ExerciseSet[];
  notes: string;
}

export interface CompletedSet {
  id: string;
  type: TrackingType;
  weight?: number | null;
  weightUnit?: WeightUnit;
  reps?: number | null;
  durationSeconds?: number | null;
  distance?: number | null;
  distanceUnit?: DistanceUnit;
}

export interface CompletedExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  trackingType: TrackingType;
  startedAt: string | null;
  completedAt: string | null;
  sets: CompletedSet[];
}

export interface WorkoutSession {
  id: string;
  workoutDayId: string;
  workoutName: string;
  date: string;
  startedAt: string | null;
  completedAt: string | null;
  status: 'completed' | 'skipped';
  exercises: CompletedExercise[];
}

export interface AppData {
  version: 1;
  currentWorkoutIndex: number;
  workoutPlan: WorkoutDay[];
  customExercises: Exercise[];
  activeWorkout: ActiveWorkoutSession | null;
  workoutHistory: WorkoutSession[];
}
```

---

### Task 3: Preset Data

**Files:**
- Create: `src/data/presetExercises.ts`
- Create: `src/data/defaultWorkoutPlan.ts`

- [ ] **Step 1: Create src/data/presetExercises.ts**

```typescript
import { Exercise } from '../types/gym';

export const presetExercises: Exercise[] = [
  // Lower body
  { id: 'lower-dumbbell-deadlift', name: 'Dumbbell Deadlift', category: 'lower-body', trackingType: 'weight-reps', isPreset: true },
  { id: 'lower-goblet-squat', name: 'Goblet Squat', category: 'lower-body', trackingType: 'weight-reps', isPreset: true },
  { id: 'lower-dumbbell-lunge', name: 'Dumbbell Lunge', category: 'lower-body', trackingType: 'weight-reps', isPreset: true },
  { id: 'lower-romanian-deadlift', name: 'Romanian Deadlift', category: 'lower-body', trackingType: 'weight-reps', isPreset: true },
  { id: 'lower-barbell-squat', name: 'Barbell Squat', category: 'lower-body', trackingType: 'weight-reps', isPreset: true },
  { id: 'lower-leg-press', name: 'Leg Press', category: 'lower-body', trackingType: 'weight-reps', isPreset: true },
  { id: 'lower-hip-thrust', name: 'Hip Thrust', category: 'lower-body', trackingType: 'weight-reps', isPreset: true },
  { id: 'lower-calf-raise', name: 'Calf Raise', category: 'lower-body', trackingType: 'weight-reps', isPreset: true },
  // Chest
  { id: 'chest-push-up', name: 'Push-up', category: 'chest', trackingType: 'reps', isPreset: true },
  { id: 'chest-bench-press', name: 'Bench Press', category: 'chest', trackingType: 'weight-reps', isPreset: true },
  { id: 'chest-dumbbell-bench-press', name: 'Dumbbell Bench Press', category: 'chest', trackingType: 'weight-reps', isPreset: true },
  { id: 'chest-incline-dumbbell-press', name: 'Incline Dumbbell Press', category: 'chest', trackingType: 'weight-reps', isPreset: true },
  { id: 'chest-chest-fly', name: 'Chest Fly', category: 'chest', trackingType: 'weight-reps', isPreset: true },
  // Back
  { id: 'back-dumbbell-row', name: 'Dumbbell Row', category: 'back', trackingType: 'weight-reps', isPreset: true },
  { id: 'back-barbell-row', name: 'Barbell Row', category: 'back', trackingType: 'weight-reps', isPreset: true },
  { id: 'back-lat-pulldown', name: 'Lat Pulldown', category: 'back', trackingType: 'weight-reps', isPreset: true },
  { id: 'back-pull-up', name: 'Pull-up', category: 'back', trackingType: 'reps', isPreset: true },
  { id: 'back-seated-cable-row', name: 'Seated Cable Row', category: 'back', trackingType: 'weight-reps', isPreset: true },
  // Shoulders
  { id: 'shoulder-shoulder-press', name: 'Shoulder Press', category: 'shoulders', trackingType: 'weight-reps', isPreset: true },
  { id: 'shoulder-lateral-raise', name: 'Lateral Raise', category: 'shoulders', trackingType: 'weight-reps', isPreset: true },
  { id: 'shoulder-front-raise', name: 'Front Raise', category: 'shoulders', trackingType: 'weight-reps', isPreset: true },
  // Arms
  { id: 'arms-dumbbell-curl', name: 'Dumbbell Curl', category: 'arms', trackingType: 'weight-reps', isPreset: true },
  { id: 'arms-hammer-curl', name: 'Hammer Curl', category: 'arms', trackingType: 'weight-reps', isPreset: true },
  { id: 'arms-triceps-extension', name: 'Triceps Extension', category: 'arms', trackingType: 'weight-reps', isPreset: true },
  { id: 'arms-triceps-pushdown', name: 'Triceps Pushdown', category: 'arms', trackingType: 'weight-reps', isPreset: true },
  // Core
  { id: 'core-crunch', name: 'Crunch', category: 'core', trackingType: 'reps', isPreset: true },
  { id: 'core-plank', name: 'Plank', category: 'core', trackingType: 'duration', isPreset: true },
  { id: 'core-side-plank', name: 'Side Plank', category: 'core', trackingType: 'duration', isPreset: true },
  { id: 'core-lying-leg-raise', name: 'Lying Leg Raise', category: 'core', trackingType: 'reps', isPreset: true },
  { id: 'core-russian-twist', name: 'Russian Twist', category: 'core', trackingType: 'reps', isPreset: true },
  // Cardio
  { id: 'cardio-running', name: 'Running', category: 'cardio', trackingType: 'distance-duration', isPreset: true },
  { id: 'cardio-treadmill', name: 'Treadmill', category: 'cardio', trackingType: 'distance-duration', isPreset: true },
  { id: 'cardio-cycling', name: 'Cycling', category: 'cardio', trackingType: 'distance-duration', isPreset: true },
  { id: 'cardio-rowing-machine', name: 'Rowing Machine', category: 'cardio', trackingType: 'distance-duration', isPreset: true },
  { id: 'cardio-stair-climber', name: 'Stair Climber', category: 'cardio', trackingType: 'distance-duration', isPreset: true },
];
```

- [ ] **Step 2: Create src/data/defaultWorkoutPlan.ts**

```typescript
import { WorkoutDay } from '../types/gym';

export function getDefaultWorkoutPlan(): WorkoutDay[] {
  return [
    {
      id: 'workout-a',
      name: 'Workout A',
      exercises: [
        { id: 'plan-a-1', exerciseId: 'lower-dumbbell-deadlift', position: 0, targetSets: 3 },
        { id: 'plan-a-2', exerciseId: 'chest-push-up', position: 1, targetSets: 3 },
        { id: 'plan-a-3', exerciseId: 'back-dumbbell-row', position: 2, targetSets: 3 },
        { id: 'plan-a-4', exerciseId: 'core-crunch', position: 3, targetSets: 3 },
      ],
    },
    {
      id: 'workout-b',
      name: 'Workout B',
      exercises: [
        { id: 'plan-b-1', exerciseId: 'lower-dumbbell-lunge', position: 0, targetSets: 3 },
        { id: 'plan-b-2', exerciseId: 'chest-dumbbell-bench-press', position: 1, targetSets: 3 },
        { id: 'plan-b-3', exerciseId: 'arms-dumbbell-curl', position: 2, targetSets: 3 },
        { id: 'plan-b-4', exerciseId: 'core-lying-leg-raise', position: 3, targetSets: 3 },
      ],
    },
    {
      id: 'workout-c',
      name: 'Workout C',
      exercises: [
        { id: 'plan-c-1', exerciseId: 'lower-goblet-squat', position: 0, targetSets: 3 },
        { id: 'plan-c-2', exerciseId: 'shoulder-shoulder-press', position: 1, targetSets: 3 },
        { id: 'plan-c-3', exerciseId: 'back-lat-pulldown', position: 2, targetSets: 3 },
        { id: 'plan-c-4', exerciseId: 'core-plank', position: 3, targetSets: 3 },
      ],
    },
  ];
}
```

---

### Task 4: Utility Functions

**Files:**
- Create: `src/utils/storage.ts`
- Create: `src/utils/rotation.ts`
- Create: `src/utils/exerciseHistory.ts`
- Create: `src/utils/dateTime.ts`
- Create: `src/utils/validation.ts`

- [ ] **Step 1: Create src/utils/dateTime.ts**

```typescript
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(dateString: string | null): string {
  if (!dateString) return '--';
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export function formatDurationFromDates(start: string | null, end: string | null): string {
  if (!start || !end) return '--';
  const diff = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  return formatDuration(diff);
}

export function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function nowISO(): string {
  return new Date().toISOString();
}
```

- [ ] **Step 2: Create src/utils/validation.ts**

```typescript
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isDuplicateName(
  newName: string,
  existingNames: string[],
  currentId?: string
): boolean {
  const normalized = normalizeName(newName);
  return existingNames.some((name, index) => {
    if (currentId !== undefined && index === existingNames.indexOf(name)) {
      return false;
    }
    return normalizeName(name) === normalized;
  });
}

export function validateExerciseName(name: string, existingNames: string[], currentId?: string): string | null {
  if (!name.trim()) return 'Exercise name is required.';
  if (isDuplicateName(name, existingNames, currentId)) return 'An exercise with this name already exists.';
  return null;
}

export function validateWorkoutDayName(name: string): string | null {
  if (!name.trim()) return 'Workout name is required.';
  return null;
}

export function validateWeight(value: number | null): string | null {
  if (value === null) return null;
  if (value < 0) return 'Weight cannot be negative.';
  return null;
}

export function validateReps(value: number | null): string | null {
  if (value === null) return null;
  if (value < 0) return 'Reps cannot be negative.';
  if (value === 0) return 'Reps must be at least 1.';
  return null;
}

export function validateDuration(value: number | null): string | null {
  if (value === null) return null;
  if (value < 0) return 'Duration cannot be negative.';
  return null;
}

export function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
```

- [ ] **Step 3: Create src/utils/storage.ts**

```typescript
import { AppData } from '../types/gym';
import { presetExercises } from '../data/presetExercises';
import { getDefaultWorkoutPlan } from '../data/defaultWorkoutPlan';
import { generateId } from './validation';

const STORAGE_KEY = 'gym-tracker-data-v1';

export function getDefaultAppData(): AppData {
  return {
    version: 1,
    currentWorkoutIndex: 0,
    workoutPlan: getDefaultWorkoutPlan(),
    customExercises: [],
    activeWorkout: null,
    workoutHistory: [],
  };
}

export function validateAppData(data: unknown): data is AppData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    d.version === 1 &&
    Array.isArray(d.workoutPlan) &&
    Array.isArray(d.customExercises) &&
    Array.isArray(d.workoutHistory)
  );
}

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultAppData();
    const parsed = JSON.parse(raw);
    if (!validateAppData(parsed)) return getDefaultAppData();
    return parsed;
  } catch {
    return getDefaultAppData();
  }
}

export function saveAppData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearAppData(): void {
  localStorage.removeItem(STORAGE_KEY);
}
```

- [ ] **Step 4: Create src/utils/rotation.ts**

```typescript
import { WorkoutDay, ActiveWorkoutSession, ActiveExercise, Exercise } from '../types/gym';
import { generateId, getTodayISO, nowISO } from './validation';

export function getCurrentWorkout(
  workoutPlan: WorkoutDay[],
  currentIndex: number
): WorkoutDay | null {
  if (workoutPlan.length === 0) return null;
  if (currentIndex < 0 || currentIndex >= workoutPlan.length) return null;
  return workoutPlan[currentIndex];
}

export function advanceWorkout(
  workoutPlan: WorkoutDay[],
  currentIndex: number
): number {
  if (workoutPlan.length === 0) return 0;
  return (currentIndex + 1) % workoutPlan.length;
}

export function getWorkoutCount(workoutPlan: WorkoutDay[]): number {
  return workoutPlan.length;
}
```

- [ ] **Step 5: Create src/utils/exerciseHistory.ts**

```typescript
import { WorkoutSession, CompletedExercise, ActiveExercise, TrackingType, CompletedSet, ExerciseSet } from '../types/gym';

export function findMostRecentExerciseResult(
  history: WorkoutSession[],
  exerciseId: string
): CompletedExercise | null {
  for (const session of history) {
    if (session.status !== 'completed') continue;
    const exercise = session.exercises.find(e => e.exerciseId === exerciseId);
    if (exercise) return exercise;
  }
  return null;
}

export function convertActiveToCompletedExercise(active: ActiveExercise): CompletedExercise {
  return {
    id: active.id,
    exerciseId: active.exerciseId,
    exerciseName: active.exerciseName,
    trackingType: active.trackingType,
    startedAt: active.startedAt,
    completedAt: active.completedAt,
    sets: active.sets.map(s => convertSet(s, active.trackingType)),
  };
}

function convertSet(set: ExerciseSet, trackingType: TrackingType): CompletedSet {
  const base: CompletedSet = { id: set.id, type: trackingType };
  if (trackingType === 'weight-reps') {
    const ws = set as { weight: number | null; weightUnit: 'kg' | 'lb'; reps: number | null };
    return { ...base, weight: ws.weight, weightUnit: ws.weightUnit, reps: ws.reps };
  }
  if (trackingType === 'reps') {
    const rs = set as { reps: number | null };
    return { ...base, reps: rs.reps };
  }
  if (trackingType === 'duration') {
    const ds = set as { durationSeconds: number | null };
    return { ...base, durationSeconds: ds.durationSeconds };
  }
  const dds = set as { distance: number | null; distanceUnit: 'km' | 'm' | 'mi'; durationSeconds: number | null };
  return { ...base, distance: dds.distance, distanceUnit: dds.distanceUnit, durationSeconds: dds.durationSeconds };
}
```

---

### Task 5: useGymTracker Hook

**Files:**
- Create: `src/hooks/useGymTracker.ts`

- [ ] **Step 1: Create the hook file**

```typescript
import { useState, useCallback, useEffect } from 'react';
import {
  AppData, ActiveWorkoutSession, ActiveExercise,
  WorkoutDay, Exercise, ExerciseSet, WeightRepSet,
  RepsOnlySet, DurationSet, DistanceDurationSet, ExerciseCategory,
  TrackingType, WorkoutSession, PlannedExercise, WeightUnit, DistanceUnit,
} from '../types/gym';
import { loadAppData, saveAppData, clearAppData, getDefaultAppData } from '../utils/storage';
import { advanceWorkout, getCurrentWorkout } from '../utils/rotation';
import { convertActiveToCompletedExercise } from '../utils/exerciseHistory';
import { generateId, getTodayISO, nowISO } from '../utils/validation';
import { presetExercises } from '../data/presetExercises';

export function useGymTracker() {
  const [data, setData] = useState<AppData>(() => loadAppData());

  useEffect(() => {
    saveAppData(data);
  }, [data]);

  const createEmptySets = (trackingType: TrackingType, count: number = 3): ExerciseSet[] => {
    const sets: ExerciseSet[] = [];
    for (let i = 0; i < count; i++) {
      const id = generateId();
      if (trackingType === 'weight-reps') {
        sets.push({ id, weight: null, weightUnit: 'kg', reps: null, completed: false } as WeightRepSet);
      } else if (trackingType === 'reps') {
        sets.push({ id, reps: null, completed: false } as RepsOnlySet);
      } else if (trackingType === 'duration') {
        sets.push({ id, durationSeconds: null, completed: false } as DurationSet);
      } else {
        sets.push({ id, distance: null, distanceUnit: 'km', durationSeconds: null, notes: '', completed: false } as DistanceDurationSet);
      }
    }
    return sets;
  };

  const getAllExercises = useCallback((): Exercise[] => {
    return [...presetExercises, ...data.customExercises];
  },

  const startWorkout = useCallback(() => {
    const workout = getCurrentWorkout(data.workoutPlan, data.currentWorkoutIndex);
    if (!workout) return;
    const allExercises: Exercise[] = [...presetExercises, ...data.customExercises];
    const exercises: ActiveExercise[] = workout.exercises.map(pe => {
      const exerciseDef = allExercises.find(e => e.id === pe.exerciseId);
      return {
        id: generateId(),
        exerciseId: pe.exerciseId,
        exerciseName: exerciseDef?.name ?? 'Unknown',
        trackingType: exerciseDef?.trackingType ?? 'reps',
        startedAt: null,
        completedAt: null,
        completed: false,
        sets: createEmptySets(exerciseDef?.trackingType ?? 'reps', pe.targetSets),
        notes: pe.notes ?? '',
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
  }, [data.workoutPlan, data.currentWorkoutIndex, data.customExercises]);

  const getCurrentWorkoutDay = useCallback((): WorkoutDay | null => {
    return getCurrentWorkout(data.workoutPlan, data.currentWorkoutIndex);
  }, [data.workoutPlan, data.currentWorkoutIndex]);

  const finishWorkout = useCallback(() => {
    if (!data.activeWorkout) return;
    const completedExercises = data.activeWorkout.exercises.map(convertActiveToCompletedExercise);
    const session: WorkoutSession = {
      id: data.activeWorkout.id,
      workoutDayId: data.activeWorkout.workoutDayId,
      workoutName: data.activeWorkout.workoutName,
      date: data.activeWorkout.date,
      startedAt: data.activeWorkout.startedAt,
      completedAt: nowISO(),
      status: 'completed',
      exercises: completedExercises,
    };
    setData(prev => ({
      ...prev,
      activeWorkout: null,
      workoutHistory: [session, ...prev.workoutHistory],
      currentWorkoutIndex: advanceWorkout(prev.workoutPlan, prev.currentWorkoutIndex),
    }));
  }, [data.activeWorkout, data.workoutPlan, data.currentWorkoutIndex]);

  const skipWorkout = useCallback(() => {
    const workout = getCurrentWorkout(data.workoutPlan, data.currentWorkoutIndex);
    if (!workout) return;
    const session: WorkoutSession = {
      id: generateId(),
      workoutDayId: workout.id,
      workoutName: workout.name,
      date: getTodayISO(),
      startedAt: null,
      completedAt: null,
      status: 'skipped',
      exercises: [],
    };
    setData(prev => ({
      ...prev,
      activeWorkout: null,
      workoutHistory: [session, ...prev.workoutHistory],
      currentWorkoutIndex: advanceWorkout(prev.workoutPlan, prev.currentWorkoutIndex),
    }));
  }, [data.workoutPlan, data.currentWorkoutIndex]);

  const startExercise = useCallback((exerciseId: string) => {
    setData(prev => {
      if (!prev.activeWorkout) return prev;
      return {
        ...prev,
        activeWorkout: {
          ...prev.activeWorkout,
          exercises: prev.activeWorkout.exercises.map(e =>
            e.id === exerciseId ? { ...e, startedAt: nowISO() } : e
          ),
        },
      };
    });
  }, []);

  const completeExercise = useCallback((exerciseId: string) => {
    setData(prev => {
      if (!prev.activeWorkout) return prev;
      return {
        ...prev,
        activeWorkout: {
          ...prev.activeWorkout,
          exercises: prev.activeWorkout.exercises.map(e =>
            e.id === exerciseId ? { ...e, completed: true, completedAt: nowISO() } : e
          ),
        },
      };
    });
  }, []);

  const updateSet = useCallback((exerciseId: string, setId: string, updates: Partial<ExerciseSet>) => {
    setData(prev => {
      if (!prev.activeWorkout) return prev;
      return {
        ...prev,
        activeWorkout: {
          ...prev.activeWorkout,
          exercises: prev.activeWorkout.exercises.map(e =>
            e.id === exerciseId
              ? { ...e, sets: e.sets.map(s => (s.id === setId ? { ...s, ...updates } : s)) }
              : e
          ),
        },
      };
    });
  }, []);

  const addSet = useCallback((exerciseId: string) => {
    setData(prev => {
      if (!prev.activeWorkout) return prev;
      return {
        ...prev,
        activeWorkout: {
          ...prev.activeWorkout,
          exercises: prev.activeWorkout.exercises.map(e => {
            if (e.id !== exerciseId) return e;
            const newSet = createEmptySets(e.trackingType, 1)[0];
            return { ...e, sets: [...e.sets, newSet] };
          }),
        },
      };
    });
  }, []);

  const removeSet = useCallback((exerciseId: string, setId: string) => {
    setData(prev => {
      if (!prev.activeWorkout) return prev;
      return {
        ...prev,
        activeWorkout: {
          ...prev.activeWorkout,
          exercises: prev.activeWorkout.exercises.map(e =>
            e.id === exerciseId
              ? { ...e, sets: e.sets.filter(s => s.id !== setId) }
              : e
          ),
        },
      };
    });
  }, []);

  const addCustomExercise = useCallback((exercise: Exercise) => {
    setData(prev => ({
      ...prev,
      customExercises: [...prev.customExercises, exercise],
    }));
  }, []);

  const editCustomExercise = useCallback((id: string, updates: Partial<Exercise>) => {
    setData(prev => ({
      ...prev,
      customExercises: prev.customExercises.map(e =>
        e.id === id ? { ...e, ...updates } : e
      ),
    }));
  }, []);

  const removeCustomExercise = useCallback((id: string) => {
    setData(prev => ({
      ...prev,
      customExercises: prev.customExercises.filter(e => e.id !== id),
    }));
  }, []);

  const updateWorkoutPlan = useCallback((plan: WorkoutDay[]) => {
    setData(prev => ({ ...prev, workoutPlan: plan }));
  }, []);

  const addWorkoutDay = useCallback((day: WorkoutDay) => {
    setData(prev => ({ ...prev, workoutPlan: [...prev.workoutPlan, day] }));
  }, []);

  const resetAll = useCallback(() => {
    clearAppData();
    setData(getDefaultAppData());
  }, []);

  const getNextWorkout = useCallback((): WorkoutDay | null => {
    const nextIndex = advanceWorkout(data.workoutPlan, data.currentWorkoutIndex);
    return getCurrentWorkout(data.workoutPlan, nextIndex);
  }, [data.workoutPlan, data.currentWorkoutIndex]);

  return {
    data,
    startWorkout,
    getCurrentWorkoutDay,
    finishWorkout,
    skipWorkout,
    startExercise,
    completeExercise,
    updateSet,
    addSet,
    removeSet,
    addCustomExercise,
    editCustomExercise,
    removeCustomExercise,
    updateWorkoutPlan,
    addWorkoutDay,
    resetAll,
    getAllExercises,
    getNextWorkout,
  };
}
```

---

### Task 6: Navigation and App Shell

**Files:**
- Create: `src/components/Navigation.tsx`
- Create: `src/App.tsx`
- Create: `src/main.tsx`

- [ ] **Step 1: Create src/components/Navigation.tsx**

```typescript
import { NavLink } from 'react-router-dom';

export function Navigation() {
  return (
    <nav className="navigation" aria-label="Main navigation">
      <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        Today
      </NavLink>
      <NavLink to="/plan" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        Plan
      </NavLink>
      <NavLink to="/exercises" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        Exercises
      </NavLink>
      <NavLink to="/history" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        History
      </NavLink>
      <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        Settings
      </NavLink>
    </nav>
  );
}
```

- [ ] **Step 2: Create src/App.tsx**

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { TodayPage } from './pages/TodayPage';
import { PlanPage } from './pages/PlanPage';
import { ExerciseLibraryPage } from './pages/ExerciseLibraryPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Navigation />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<TodayPage />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/exercises" element={<ExerciseLibraryPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
```

- [ ] **Step 3: Create src/main.tsx**

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

---

### Task 7: Today Page and WorkoutHeader

**Files:**
- Create: `src/components/WorkoutHeader.tsx`
- Create: `src/pages/TodayPage.tsx`

- [ ] **Step 1: Create src/components/WorkoutHeader.tsx**

```typescript
import { ActiveWorkoutSession } from '../types/gym';
import { formatDate } from '../utils/dateTime';

interface WorkoutHeaderProps {
  activeWorkout: ActiveWorkoutSession;
}

export function WorkoutHeader({ activeWorkout }: WorkoutHeaderProps) {
  const total = activeWorkout.exercises.length;
  const completed = activeWorkout.exercises.filter(e => e.completed).length;
  return (
    <div className="workout-header">
      <h1 className="workout-name">{activeWorkout.workoutName}</h1>
      <p className="workout-meta">{formatDate(activeWorkout.date)}</p>
      <p className="workout-progress">{completed} of {total} exercises completed</p>
    </div>
  );
}
```

- [ ] **Step 2: Create src/pages/TodayPage.tsx**

```typescript
import { useGymTracker } from '../hooks/useGymTracker';
import { WorkoutHeader } from '../components/WorkoutHeader';
import { ExerciseCard } from '../components/ExerciseCard';
import { WorkoutCompletionModal } from '../components/WorkoutCompletionModal';
import { useState } from 'react';

export function TodayPage() {
  const {
    data, startWorkout, getCurrentWorkoutDay,
    finishWorkout, skipWorkout, startExercise,
    completeExercise, updateSet, addSet, removeSet,
    getNextWorkout,
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
            onStart={() => startExercise(exercise.id)}
            onComplete={() => completeExercise(exercise.id)}
            onUpdateSet={(setId, updates) => updateSet(exercise.id, setId, updates)}
            onAddSet={() => addSet(exercise.id)}
            onRemoveSet={(setId) => removeSet(exercise.id, setId)}
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

---

### Task 8: ExerciseSetRow Component

**Files:**
- Create: `src/components/ExerciseSetRow.tsx`

- [ ] **Step 1: Create ExerciseSetRow component**

```typescript
import { ExerciseSet, TrackingType, WeightRepSet, RepsOnlySet, DurationSet, DistanceDurationSet } from '../types/gym';

interface ExerciseSetRowProps {
  set: ExerciseSet;
  trackingType: TrackingType;
  onUpdate: (setId: string, updates: Partial<ExerciseSet>) => void;
  onRemove: (setId: string) => void;
  setIndex: number;
}

export function ExerciseSetRow({ set, trackingType, onUpdate, onRemove, setIndex }: ExerciseSetRowProps) {
  return (
    <div className="set-row">
      <span className="set-label">Set {setIndex + 1}</span>
      {trackingType === 'weight-reps' && renderWeightReps(set as WeightRepSet, onUpdate)}
      {trackingType === 'reps' && renderRepsOnly(set as RepsOnlySet, onUpdate)}
      {trackingType === 'duration' && renderDuration(set as DurationSet, onUpdate)}
      {trackingType === 'distance-duration' && renderDistanceDuration(set as DistanceDurationSet, onUpdate)}
      <button
        className="btn btn-small btn-danger-outline"
        onClick={() => onRemove(set.id)}
        aria-label={`Remove set ${setIndex + 1}`}
      >
        ✕
      </button>
    </div>
  );
}

function renderWeightReps(set: WeightRepSet, onUpdate: (id: string, u: Partial<ExerciseSet>) => void) {
  return (
    <>
      <div className="set-input-group">
        <label htmlFor={`weight-${set.id}`} className="sr-only">Weight</label>
        <input
          id={`weight-${set.id}`}
          className="input input-small"
          type="number"
          min="0"
          step="0.5"
          placeholder="Weight"
          value={set.weight ?? ''}
          onChange={e => onUpdate(set.id, { weight: e.target.value ? parseFloat(e.target.value) : null })}
        />
        <select
          className="input input-small input-unit"
          value={set.weightUnit}
          onChange={e => onUpdate(set.id, { weightUnit: e.target.value as 'kg' | 'lb' })}
          aria-label="Weight unit"
        >
          <option value="kg">kg</option>
          <option value="lb">lb</option>
        </select>
      </div>
      <div className="set-input-group">
        <label htmlFor={`reps-${set.id}`} className="sr-only">Reps</label>
        <input
          id={`reps-${set.id}`}
          className="input input-small"
          type="number"
          min="0"
          step="1"
          placeholder="Reps"
          value={set.reps ?? ''}
          onChange={e => onUpdate(set.id, { reps: e.target.value ? parseInt(e.target.value, 10) : null })}
        />
      </div>
    </>
  );
}

function renderRepsOnly(set: RepsOnlySet, onUpdate: (id: string, u: Partial<ExerciseSet>) => void) {
  return (
    <div className="set-input-group">
      <label htmlFor={`reps-${set.id}`} className="sr-only">Reps</label>
      <input
        id={`reps-${set.id}`}
        className="input input-small"
        type="number"
        min="0"
        step="1"
        placeholder="Reps"
        value={set.reps ?? ''}
        onChange={e => onUpdate(set.id, { reps: e.target.value ? parseInt(e.target.value, 10) : null })}
      />
    </div>
  );
}

function renderDuration(set: DurationSet, onUpdate: (id: string, u: Partial<ExerciseSet>) => void) {
  return (
    <div className="set-input-group">
      <label htmlFor={`duration-${set.id}`} className="sr-only">Duration (seconds)</label>
      <input
        id={`duration-${set.id}`}
        className="input input-small"
        type="number"
        min="0"
        step="1"
        placeholder="Seconds"
        value={set.durationSeconds ?? ''}
        onChange={e => onUpdate(set.id, { durationSeconds: e.target.value ? parseInt(e.target.value, 10) : null })}
      />
    </div>
  );
}

function renderDistanceDuration(set: DistanceDurationSet, onUpdate: (id: string, u: Partial<ExerciseSet>) => void) {
  return (
    <>
      <div className="set-input-group">
        <label htmlFor={`dist-${set.id}`} className="sr-only">Distance</label>
        <input
          id={`dist-${set.id}`}
          className="input input-small"
          type="number"
          min="0"
          step="0.1"
          placeholder="Distance"
          value={set.distance ?? ''}
          onChange={e => onUpdate(set.id, { distance: e.target.value ? parseFloat(e.target.value) : null })}
        />
        <select
          className="input input-small input-unit"
          value={set.distanceUnit}
          onChange={e => onUpdate(set.id, { distanceUnit: e.target.value as 'km' | 'm' | 'mi' })}
          aria-label="Distance unit"
        >
          <option value="km">km</option>
          <option value="m">m</option>
          <option value="mi">mi</option>
        </select>
      </div>
      <div className="set-input-group">
        <label htmlFor={`dur-${set.id}`} className="sr-only">Duration (seconds)</label>
        <input
          id={`dur-${set.id}`}
          className="input input-small"
          type="number"
          min="0"
          step="1"
          placeholder="Seconds"
          value={set.durationSeconds ?? ''}
          onChange={e => onUpdate(set.id, { durationSeconds: e.target.value ? parseInt(e.target.value, 10) : null })}
        />
      </div>
    </>
  );
}
```

---

### Task 9: ExerciseCard Component

**Files:**
- Create: `src/components/ExerciseCard.tsx`

- [ ] **Step 1: Create ExerciseCard**

```typescript
import { useState } from 'react';
import { ActiveExercise, ExerciseSet, TrackingType } from '../types/gym';
import { ExerciseSetRow } from './ExerciseSetRow';
import { findMostRecentExerciseResult } from '../utils/exerciseHistory';
import { useGymTracker } from '../hooks/useGymTracker';

interface ExerciseCardProps {
  exercise: ActiveExercise;
  onStart: () => void;
  onComplete: () => void;
  onUpdateSet: (setId: string, updates: Partial<ExerciseSet>) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
}

export function ExerciseCard({ exercise, onStart, onComplete, onUpdateSet, onAddSet, onRemoveSet }: ExerciseCardProps) {
  const { data } = useGymTracker();
  const [expanded, setExpanded] = useState(false);
  const previousResult = findMostRecentExerciseResult(data.workoutHistory, exercise.exerciseId);

  const categoryLabels: Record<string, string> = {
    'lower-body': 'Lower Body', chest: 'Chest', back: 'Back',
    shoulders: 'Shoulders', arms: 'Arms', core: 'Core', cardio: 'Cardio', other: 'Other',
  };

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
          {previousResult && (
            <div className="previous-result">
              <strong>Last time:</strong>
              {previousResult.sets.map((set, i) => (
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
            {exercise.sets.map((set, i) => (
              <ExerciseSetRow
                key={set.id}
                set={set}
                trackingType={exercise.trackingType}
                onUpdate={onUpdateSet}
                onRemove={onRemoveSet}
                setIndex={i}
              />
            ))}
          </div>
          <button className="btn btn-small btn-outline" onClick={onAddSet}>+ Add Set</button>
          <div className="exercise-card-actions">
            {!exercise.startedAt && !exercise.completed && (
              <button className="btn btn-primary" onClick={onStart}>Start Exercise</button>
            )}
            {exercise.startedAt && !exercise.completed && (
              <button className="btn btn-success" onClick={onComplete}>Complete Exercise</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function trackingLabel(type: TrackingType): string {
  switch (type) {
    case 'weight-reps': return 'Weight × Reps';
    case 'reps': return 'Reps';
    case 'duration': return 'Duration';
    case 'distance-duration': return 'Distance + Duration';
  }
}
```

---

### Task 10: WorkoutCompletionModal

**Files:**
- Create: `src/components/WorkoutCompletionModal.tsx`

- [ ] **Step 1: Create the modal**

```typescript
import { useEffect, useRef } from 'react';
import { WorkoutDay } from '../types/gym';

interface WorkoutCompletionModalProps {
  nextWorkout: WorkoutDay | null;
  allComplete: boolean;
  incompleteCount: number;
  onFinishAnyway: () => void;
  onReturn: () => void;
  onClose: () => void;
}

export function WorkoutCompletionModal({
  nextWorkout,
  allComplete,
  incompleteCount,
  onFinishAnyway,
  onReturn,
  onClose,
}: WorkoutCompletionModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Workout completion">
      <div className="modal">
        {!allComplete ? (
          <>
            <h2>{incompleteCount} exercise{incompleteCount > 1 ? 's' : ''} not completed</h2>
            <p>You haven't finished all exercises. What would you like to do?</p>
            <div className="modal-actions">
              <button className="btn btn-primary" ref={closeRef} onClick={onFinishAnyway}>
                Finish Anyway
              </button>
              <button className="btn btn-secondary" onClick={onReturn}>
                Go Back
              </button>
            </div>
          </>
        ) : nextWorkout ? (
          <>
            <h2>Workout Completed</h2>
            <p className="next-workout-label">Next workout: {nextWorkout.name}</p>
            <ul className="next-workout-list">
              {nextWorkout.exercises.map(ex => (
                <li key={ex.id}>{ex.exerciseId}</li>
              ))}
            </ul>
            <div className="modal-actions">
              <button className="btn btn-primary" ref={closeRef} onClick={onClose}>
                View Next Workout
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>Workout Completed</h2>
            <p>No more workouts in the plan.</p>
            <div className="modal-actions">
              <button className="btn btn-primary" ref={closeRef} onClick={onClose}>
                OK
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

---

### Task 11: Plan Page

**Files:**
- Create: `src/pages/PlanPage.tsx`

- [ ] **Step 1: Create PlanPage**

```typescript
import { useState } from 'react';
import { useGymTracker } from '../hooks/useGymTracker';
import { WorkoutDay, Exercise, PlannedExercise } from '../types/gym';
import { generateId, validateWorkoutDayName } from '../utils/validation';

export function PlanPage() {
  const { data, updateWorkoutPlan, getAllExercises } = useGymTracker();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newDayName, setNewDayName] = useState('');
  const [showAddExercise, setShowAddExercise] = useState<string | null>(null);

  const allExercises = getAllExercises();

  function handleRename(dayId: string, name: string) {
    const error = validateWorkoutDayName(name);
    if (error) return;
    updateWorkoutPlan(data.workoutPlan.map(d => d.id === dayId ? { ...d, name } : d));
    setEditingId(null);
  }

  function handleDelete(dayId: string) {
    updateWorkoutPlan(data.workoutPlan.filter(d => d.id !== dayId));
  }

  function handleMove(dayId: string, direction: -1 | 1) {
    const idx = data.workoutPlan.findIndex(d => d.id === dayId);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= data.workoutPlan.length) return;
    const plan = [...data.workoutPlan];
    [plan[idx], plan[newIdx]] = [plan[newIdx], plan[idx]];
    updateWorkoutPlan(plan);
  }

  function handleAddDay() {
    const error = validateWorkoutDayName(newDayName);
    if (error) return;
    const newDay: WorkoutDay = {
      id: generateId(),
      name: newDayName,
      exercises: [],
    };
    updateWorkoutPlan([...data.workoutPlan, newDay]);
    setNewDayName('');
  }

  function handleAddExercise(dayId: string, exerciseId: string) {
    const day = data.workoutPlan.find(d => d.id === dayId);
    if (!day) return;
    const newExercise: PlannedExercise = {
      id: generateId(),
      exerciseId,
      position: day.exercises.length,
      targetSets: 3,
    };
    updateWorkoutPlan(data.workoutPlan.map(d =>
      d.id === dayId ? { ...d, exercises: [...d.exercises, newExercise] } : d
    ));
    setShowAddExercise(null);
  }

  function handleRemoveExercise(dayId: string, exerciseId: string) {
    updateWorkoutPlan(data.workoutPlan.map(d =>
      d.id === dayId
        ? { ...d, exercises: d.exercises.filter(e => e.id !== exerciseId).map((e, i) => ({ ...e, position: i })) }
        : d
    ));
  }

  function handleMoveExercise(dayId: string, exerciseId: string, direction: -1 | 1) {
    const day = data.workoutPlan.find(d => d.id === dayId);
    if (!day) return;
    const idx = day.exercises.findIndex(e => e.id === exerciseId);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= day.exercises.length) return;
    const exercises = [...day.exercises];
    [exercises[idx], exercises[newIdx]] = [exercises[newIdx], exercises[idx]];
    updateWorkoutPlan(data.workoutPlan.map(d =>
      d.id === dayId ? { ...d, exercises: exercises.map((e, i) => ({ ...e, position: i })) } : d
    ));
  }

  return (
    <div className="plan-page">
      <h1>Workout Plan</h1>
      {data.workoutPlan.map((day, idx) => (
        <div key={day.id} className="plan-day-card">
          <div className="plan-day-header">
            {editingId === day.id ? (
              <input
                className="input"
                defaultValue={day.name}
                onBlur={e => handleRename(day.id, e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRename(day.id, (e.target as HTMLInputElement).value)}
                autoFocus
              />
            ) : (
              <h2 onClick={() => setEditingId(day.id)}>{day.name}</h2>
            )}
            <div className="plan-day-controls">
              <button className="btn btn-small" onClick={() => handleMove(day.id, -1)} disabled={idx === 0}>↑</button>
              <button className="btn btn-small" onClick={() => handleMove(day.id, 1)} disabled={idx === data.workoutPlan.length - 1}>↓</button>
              <button className="btn btn-small btn-danger-outline" onClick={() => handleDelete(day.id)}>✕</button>
            </div>
          </div>
          <div className="plan-exercise-list">
            {day.exercises.map((ex, exIdx) => {
              const exerciseDef = allExercises.find(e => e.id === ex.exerciseId);
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
          </div>
          <div className="plan-add-exercise">
            <button className="btn btn-outline btn-small" onClick={() => setShowAddExercise(day.id)}>+ Add Exercise</button>
            {showAddExercise === day.id && (
              <div className="exercise-picker">
                <select
                  className="input"
                  defaultValue=""
                  onChange={e => { if (e.target.value) handleAddExercise(day.id, e.target.value); }}
                  autoFocus
                >
                  <option value="" disabled>Select exercise...</option>
                  {allExercises.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      ))}
      <div className="plan-add-day">
        <input
          className="input"
          placeholder="New workout name"
          value={newDayName}
          onChange={e => setNewDayName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddDay()}
        />
        <button className="btn btn-primary" onClick={handleAddDay}>Add Workout Day</button>
      </div>
    </div>
  );
}
```

---

### Task 12: Exercise Library Page

**Files:**
- Create: `src/pages/ExerciseLibraryPage.tsx`
- Create: `src/components/CustomExerciseForm.tsx`

- [ ] **Step 1: Create ExerciseLibraryPage**

```typescript
import { useState } from 'react';
import { useGymTracker } from '../hooks/useGymTracker';
import { CustomExerciseForm } from '../components/CustomExerciseForm';
import { ExerciseCategory } from '../types/gym';

export function ExerciseLibraryPage() {
  const { data, getAllExercises, removeCustomExercise } = useGymTracker();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<ExerciseCategory | 'all'>('all');

  const allExercises = getAllExercises();

  const categories: { value: ExerciseCategory | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'lower-body', label: 'Lower Body' },
    { value: 'chest', label: 'Chest' },
    { value: 'back', label: 'Back' },
    { value: 'shoulders', label: 'Shoulders' },
    { value: 'arms', label: 'Arms' },
    { value: 'core', label: 'Core' },
    { value: 'cardio', label: 'Cardio' },
    { value: 'other', label: 'Other' },
  ];

  const filtered = filter === 'all'
    ? allExercises
    : allExercises.filter(e => e.category === filter);

  return (
    <div className="exercise-library-page">
      <h1>Exercise Library</h1>
      <div className="filter-bar">
        {categories.map(cat => (
          <button
            key={cat.value}
            className={`btn btn-small ${filter === cat.value ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter(cat.value)}
          >
            {cat.label}
          </button>
        ))}
      </div>
      <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Custom Exercise</button>
      {showForm && <CustomExerciseForm onClose={() => setShowForm(false)} />}
      <div className="exercise-grid">
        {filtered.map(ex => (
          <div key={ex.id} className="exercise-item">
            <div className="exercise-item-info">
              <strong>{ex.name}</strong>
              <span className="exercise-item-meta">{ex.category} · {ex.trackingType}</span>
              {ex.equipment && <span className="exercise-item-meta">Equipment: {ex.equipment}</span>}
              {!ex.isPreset && <span className="badge badge-custom">Custom</span>}
            </div>
            {!ex.isPreset && (
              <button
                className="btn btn-small btn-danger-outline"
                onClick={() => removeCustomExercise(ex.id)}
                aria-label={`Remove ${ex.name}`}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create CustomExerciseForm**

```typescript
import { useState } from 'react';
import { useGymTracker } from '../hooks/useGymTracker';
import { Exercise, ExerciseCategory, TrackingType } from '../types/gym';
import { generateId, validateExerciseName, normalizeName } from '../utils/validation';

interface CustomExerciseFormProps {
  onClose: () => void;
}

export function CustomExerciseForm({ onClose }: CustomExerciseFormProps) {
  const { addCustomExercise, getAllExercises } = useGymTracker();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExerciseCategory>('other');
  const [trackingType, setTrackingType] = useState<TrackingType>('weight-reps');
  const [equipment, setEquipment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showDuplicate, setShowDuplicate] = useState(false);

  const existingExercises = getAllExercises();
  const existingNames = existingExercises.map(e => e.name);

  function handleSubmit() {
    const normalized = normalizeName(name);
    if (!normalized) {
      setError('Exercise name is required.');
      return;
    }
    const dup = existingExercises.find(e => normalizeName(e.name) === normalized);
    if (dup && !showDuplicate) {
      setError(`"${dup.name}" already exists. Click submit again to use this name.`);
      setShowDuplicate(true);
      return;
    }
    const exercise: Exercise = {
      id: generateId(),
      name: name.trim(),
      category,
      trackingType,
      equipment: equipment.trim() || undefined,
      isPreset: false,
    };
    addCustomExercise(exercise);
    onClose();
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Custom exercise form">
      <div className="modal">
        <h2>New Custom Exercise</h2>
        <div className="form-group">
          <label htmlFor="ex-name">Exercise Name</label>
          <input id="ex-name" className="input" value={name} onChange={e => { setName(e.target.value); setError(null); setShowDuplicate(false); }} />
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
        <div className="form-group">
          <label htmlFor="ex-category">Category</label>
          <select id="ex-category" className="input" value={category} onChange={e => setCategory(e.target.value as ExerciseCategory)}>
            <option value="lower-body">Lower Body</option>
            <option value="chest">Chest</option>
            <option value="back">Back</option>
            <option value="shoulders">Shoulders</option>
            <option value="arms">Arms</option>
            <option value="core">Core</option>
            <option value="cardio">Cardio</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="ex-tracking">Tracking Type</label>
          <select id="ex-tracking" className="input" value={trackingType} onChange={e => setTrackingType(e.target.value as TrackingType)}>
            <option value="weight-reps">Weight × Reps</option>
            <option value="reps">Reps Only</option>
            <option value="duration">Duration</option>
            <option value="distance-duration">Distance + Duration</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="ex-equipment">Equipment (optional)</label>
          <input id="ex-equipment" className="input" value={equipment} onChange={e => setEquipment(e.target.value)} />
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={handleSubmit}>Save Exercise</button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
```

---

### Task 13: History Page

**Files:**
- Create: `src/pages/HistoryPage.tsx`

- [ ] **Step 1: Create HistoryPage**

```typescript
import { useState } from 'react';
import { useGymTracker } from '../hooks/useGymTracker';
import { formatDate, formatTime, formatDurationFromDates } from '../utils/dateTime';

export function HistoryPage() {
  const { data } = useGymTracker();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="history-page">
      <h1>Workout History</h1>
      {data.workoutHistory.length === 0 && <p>No workouts yet.</p>}
      {data.workoutHistory.map(session => (
        <div key={session.id} className="history-card">
          <div className="history-card-header" onClick={() => setExpandedId(expandedId === session.id ? null : session.id)}>
            <div>
              <strong>{session.workoutName}</strong>
              <span className="history-date">{formatDate(session.date)}</span>
            </div>
            <div className="history-meta">
              <span className={`badge ${session.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                {session.status === 'completed' ? 'Completed' : 'Skipped'}
              </span>
              <span>{formatTime(session.startedAt)} – {formatTime(session.completedAt)}</span>
            </div>
          </div>
          {expandedId === session.id && session.status === 'completed' && (
            <div className="history-card-body">
              <p>Duration: {formatDurationFromDates(session.startedAt, session.completedAt)}</p>
              <p>Exercises: {session.exercises.length}</p>
              {session.exercises.map(ex => (
                <div key={ex.id} className="history-exercise">
                  <strong>{ex.exerciseName}</strong>
                  {ex.sets.map((set, i) => (
                    <div key={set.id} className="history-set">
                      Set {i + 1}: {
                        set.type === 'weight-reps' ? `${set.weight} ${set.weightUnit} × ${set.reps}` :
                        set.type === 'reps' ? `${set.reps} reps` :
                        set.type === 'duration' ? `${set.durationSeconds}s` :
                        `${set.distance} ${set.distanceUnit} in ${set.durationSeconds}s`
                      }
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

### Task 14: Settings Page

**Files:**
- Create: `src/pages/SettingsPage.tsx`

- [ ] **Step 1: Create SettingsPage**

```typescript
import { useState } from 'react';
import { useGymTracker } from '../hooks/useGymTracker';

export function SettingsPage() {
  const { resetAll } = useGymTracker();
  const [showConfirm, setShowConfirm] = useState(false);

  function handleReset() {
    resetAll();
    setShowConfirm(false);
  }

  return (
    <div className="settings-page">
      <h1>Settings</h1>
      <div className="settings-section">
        <h2>Data</h2>
        <button className="btn btn-danger" onClick={() => setShowConfirm(true)}>
          Reset Demo Data
        </button>
        {showConfirm && (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Reset confirmation">
            <div className="modal">
              <p>Reset all data? This will delete your workout history, custom exercises, and plan changes.</p>
              <div className="modal-actions">
                <button className="btn btn-danger" onClick={handleReset}>Reset All Data</button>
                <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### Task 15: Global Styles

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 1: Add component styles to global.css**

```css
@import './variables.css';

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-family);
  background: var(--background);
  color: var(--text-primary);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

button { cursor: pointer; font: inherit; }
input, select { font: inherit; }
a { color: inherit; text-decoration: none; }

/* Navigation */
.navigation {
  display: flex;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  position: sticky;
  top: 0;
  z-index: 10;
}

.nav-link {
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-small);
  color: var(--text-secondary);
  font-weight: 500;
  white-space: nowrap;
}

.nav-link.active {
  background: var(--surface-muted);
  color: var(--text-primary);
}

/* Main content */
.main-content {
  max-width: 640px;
  margin: 0 auto;
  padding: var(--space-md);
  padding-bottom: calc(var(--space-xl) * 2);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-small);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.9rem;
  font-weight: 500;
  transition: background 0.15s, opacity 0.15s;
}

.btn:hover { opacity: 0.85; }
.btn:focus-visible { outline: 2px solid var(--text-primary); outline-offset: 2px; }

.btn-primary { background: var(--text-primary); color: var(--surface); border-color: var(--text-primary); }
.btn-success { background: var(--success); color: white; border-color: var(--success); }
.btn-danger { background: var(--danger); color: white; border-color: var(--danger); }
.btn-secondary { background: var(--surface-muted); color: var(--text-secondary); border-color: var(--border); }
.btn-outline { background: transparent; border-color: var(--border); }
.btn-danger-outline { background: transparent; border-color: var(--danger); color: var(--danger); }

.btn-large { padding: var(--space-md) var(--space-lg); font-size: 1rem; width: 100%; }
.btn-small { padding: var(--space-xs) var(--space-sm); font-size: 0.8rem; }

/* Inputs */
.input {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-small);
  background: var(--surface);
  color: var(--text-primary);
  width: 100%;
}

.input:focus { outline: 2px solid var(--text-primary); outline-offset: 1px; }

.input-small { padding: var(--space-xs) var(--space-sm); width: auto; }
.input-unit { max-width: 60px; }

/* Cards */
.exercise-card, .plan-day-card, .history-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-medium);
  margin-bottom: var(--space-md);
  overflow: hidden;
}

.exercise-card.completed { border-color: var(--success); }

.exercise-card-header, .plan-day-header, .history-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md);
  cursor: pointer;
}

.exercise-card-header:hover { background: var(--surface-muted); }

.exercise-name { font-size: 1rem; margin-bottom: var(--space-xs); }
.exercise-meta { font-size: 0.8rem; color: var(--text-secondary); }
.exercise-status { display: flex; align-items: center; gap: var(--space-sm); }

.exercise-card-body {
  padding: 0 var(--space-md) var(--space-md);
}

/* Badges */
.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-success { background: #e8f5e9; color: var(--success); }
.badge-active { background: #fff3e0; color: #e65100; }
.badge-pending { background: var(--surface-muted); color: var(--text-secondary); }
.badge-warning { background: #fff3e0; color: #e65100; }
.badge-custom { background: #e3f2fd; color: #1565c0; }

/* Set rows */
.set-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) 0;
  flex-wrap: wrap;
}

.set-label {
  min-width: 40px;
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.set-input-group {
  display: flex;
  gap: var(--space-xs);
  align-items: center;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: var(--space-md);
}

.modal {
  background: var(--surface);
  border-radius: var(--radius-large);
  padding: var(--space-lg);
  max-width: 400px;
  width: 100%;
}

.modal h2 { margin-bottom: var(--space-md); }
.modal p { margin-bottom: var(--space-md); color: var(--text-secondary); }
.modal-actions { display: flex; gap: var(--space-sm); margin-top: var(--space-md); }
.modal-actions .btn { flex: 1; }

/* Form */
.form-group { margin-bottom: var(--space-md); }
.form-group label { display: block; margin-bottom: var(--space-xs); font-weight: 500; font-size: 0.9rem; }
.form-error { color: var(--danger); font-size: 0.85rem; margin-top: var(--space-xs); }

/* Plan page */
.plan-day { margin-bottom: var(--space-md); }
.plan-day-header h2 { font-size: 1.1rem; cursor: pointer; }
.plan-day-header h2:hover { color: var(--text-secondary); }
.plan-day-controls, .plan-exercise-controls { display: flex; gap: var(--space-xs); }
.plan-exercise-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm) var(--space-md);
  border-top: 1px solid var(--border);
}
.plan-add-exercise { padding: var(--space-sm) var(--space-md); }
.plan-add-day {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
}
.plan-add-day .input { flex: 1; }

/* Exercise library */
.filter-bar {
  display: flex;
  gap: var(--space-xs);
  flex-wrap: wrap;
  margin-bottom: var(--space-md);
}
.exercise-grid { margin-top: var(--space-md); }
.exercise-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm) var(--space-md);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-small);
  margin-bottom: var(--space-sm);
}
.exercise-item-info strong { display: block; }
.exercise-item-meta { font-size: 0.8rem; color: var(--text-secondary); }
.exercise-item .badge { margin-top: var(--space-xs); }

/* History */
.history-date { display: block; font-size: 0.85rem; color: var(--text-secondary); }
.history-meta { display: flex; flex-direction: column; align-items: flex-end; gap: var(--space-xs); }
.history-card-body { padding: 0 var(--space-md) var(--space-md); border-top: 1px solid var(--border); padding-top: var(--space-md); }
.history-exercise { margin-top: var(--space-sm); }
.history-set { font-size: 0.85rem; color: var(--text-secondary); padding-left: var(--space-md); }

/* Today page */
.workout-header { margin-bottom: var(--space-lg); }
.workout-name { font-size: 1.5rem; margin-bottom: var(--space-xs); }
.workout-meta { color: var(--text-secondary); margin-bottom: var(--space-xs); }
.workout-progress { color: var(--text-secondary); font-size: 0.9rem; }

.workout-preview {
  text-align: center;
  padding: var(--space-xl) 0;
}

.workout-preview h1 { font-size: 2rem; margin-bottom: var(--space-sm); }
.workout-preview p { color: var(--text-secondary); margin-bottom: var(--space-lg); }

.workout-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
}

.exercise-list { margin-bottom: var(--space-md); }

/* Previous result */
.previous-result {
  background: var(--surface-muted);
  border-radius: var(--radius-small);
  padding: var(--space-sm) var(--space-md);
  margin-bottom: var(--space-sm);
  font-size: 0.85rem;
}

.previous-set { color: var(--text-secondary); padding-left: var(--space-sm); }

/* Next workout preview */
.next-workout-label { font-weight: 600; margin-top: var(--space-sm); }
.next-workout-list {
  list-style: none;
  padding: 0;
}
.next-workout-list li {
  padding: var(--space-xs) 0;
  color: var(--text-secondary);
}

/* Settings */
.settings-section { margin-top: var(--space-lg); }
.settings-section h2 { margin-bottom: var(--space-md); }

/* Screen reader only */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

### Task 16: Tests

**Files:**
- Create: `src/setupTests.ts`
- Create: `src/__tests__/gymTracker.test.tsx`

- [ ] **Step 1: Create test setup file**

```typescript
import '@testing-library/jest-dom';

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock crypto.randomUUID
Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}` },
});
```

- [ ] **Step 2: Write tests**

Create `src/__tests__/gymTracker.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import App from '../App';

function renderApp() {
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
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
    // Click Start
    fireEvent.click(screen.getByText('Start Workout'));
    // Complete all 4 exercises
    const startButtons = screen.getAllByText('Start Exercise');
    for (const btn of startButtons) {
      fireEvent.click(btn);
      fireEvent.click(screen.getByText('Complete Exercise'));
    }
    // Click Finish
    fireEvent.click(screen.getByText('Finish Workout'));
    // Should show completion modal
    expect(screen.getByText('Workout Completed')).toBeInTheDocument();
    fireEvent.click(screen.getByText('View Next Workout'));
    // Should now show Workout B
    expect(screen.getByText('Workout B')).toBeInTheDocument();
  });
});
```

---

### Task 17: Final Build and Verification

- [ ] **Step 1: Run TypeScript check**

```bash
cd /Users/ngoclinhdo/Projects/gym-tracker/frontend
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: No lint errors.

- [ ] **Step 3: Run tests**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 4: Run production build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Clean up unused Vite demo files**

Delete `src/App.css`, `src/assets/` directory, and any other Vite demo files.