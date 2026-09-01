import type { AppData, WorkoutDay, PlannedExercise, Exercise } from '../types/gym';
import { getDefaultWorkoutPlan } from '../data/defaultWorkoutPlan';
import { presetExercises } from '../data/presetExercises';

const STORAGE_KEY = 'gym-tracker-data-v1';

const LEGACY_SLUG_TO_UUID: Record<string, string> = {
  'lower-dumbbell-deadlift': '0a1b2c3d-0001-4000-8000-000000000001',
  'lower-goblet-squat': '0a1b2c3d-0001-4000-8000-000000000002',
  'lower-barbell-lunge': '0a1b2c3d-0001-4000-8000-000000000003',
  'lower-romanian-deadlift': '0a1b2c3d-0001-4000-8000-000000000004',
  'lower-barbell-squat': '0a1b2c3d-0001-4000-8000-000000000005',
  'lower-leg-press': '0a1b2c3d-0001-4000-8000-000000000006',
  'lower-hip-thrust': '0a1b2c3d-0001-4000-8000-000000000007',
  'lower-calf-raise': '0a1b2c3d-0001-4000-8000-000000000008',
  'chest-push-up': '0a1b2c3d-0002-4000-8000-000000000001',
  'chest-barbell-bench-press': '0a1b2c3d-0002-4000-8000-000000000002',
  'chest-dumbbell-bench-press': '0a1b2c3d-0002-4000-8000-000000000003',
  'chest-incline-dumbbell-press': '0a1b2c3d-0002-4000-8000-000000000004',
  'chest-fly': '0a1b2c3d-0002-4000-8000-000000000005',
  'back-dumbbell-row': '0a1b2c3d-0003-4000-8000-000000000001',
  'back-barbell-row': '0a1b2c3d-0003-4000-8000-000000000002',
  'back-lat-pulldown': '0a1b2c3d-0003-4000-8000-000000000003',
  'back-pull-up': '0a1b2c3d-0003-4000-8000-000000000004',
  'back-seated-cable-row': '0a1b2c3d-0003-4000-8000-000000000005',
  'shoulder-shoulder-press': '0a1b2c3d-0004-4000-8000-000000000001',
  'shoulder-lateral-raise': '0a1b2c3d-0004-4000-8000-000000000002',
  'shoulder-front-raise': '0a1b2c3d-0004-4000-8000-000000000003',
  'arms-dumbbell-curl': '0a1b2c3d-0005-4000-8000-000000000001',
  'arms-hammer-curl': '0a1b2c3d-0005-4000-8000-000000000002',
  'arms-triceps-extension': '0a1b2c3d-0005-4000-8000-000000000003',
  'arms-triceps-pushdown': '0a1b2c3d-0005-4000-8000-000000000004',
  'core-crunch': '0a1b2c3d-0006-4000-8000-000000000001',
  'core-plank': '0a1b2c3d-0006-4000-8000-000000000002',
  'core-side-plank': '0a1b2c3d-0006-4000-8000-000000000003',
  'core-lying-leg-raise': '0a1b2c3d-0006-4000-8000-000000000004',
  'core-russian-twist': '0a1b2c3d-0006-4000-8000-000000000005',
  'cardio-running': '0a1b2c3d-0007-4000-8000-000000000001',
  'cardio-treadmill': '0a1b2c3d-0007-4000-8000-000000000002',
  'cardio-cycling': '0a1b2c3d-0007-4000-8000-000000000003',
  'cardio-rowing-machine': '0a1b2c3d-0007-4000-8000-000000000004',
  'cardio-stair-climber': '0a1b2c3d-0007-4000-8000-000000000005',
};

function normalizeWorkoutPlan(plan: unknown): WorkoutDay[] {
  if (!Array.isArray(plan)) return [];
  return plan.map((dayRaw, dayIdx) => {
    const day = dayRaw as Record<string, unknown>;
    const rawExercises = Array.isArray(day.exercises) ? day.exercises : [];
    const exercises: PlannedExercise[] = rawExercises.map((exRaw, exIdx) => {
      const ex = exRaw as Record<string, unknown>;
      const legacyId = typeof ex.exerciseId === 'string' ? ex.exerciseId : undefined;
      return {
        id: typeof ex.id === 'string' ? ex.id : String(ex.id ?? ''),
        exercise: legacyId
          ? (LEGACY_SLUG_TO_UUID[legacyId] ?? legacyId)
          : (typeof ex.exercise === 'string' ? ex.exercise : ''),
        position: typeof ex.position === 'number' ? ex.position : exIdx,
        target_sets:
          typeof ex.target_sets === 'number'
            ? ex.target_sets
            : (typeof ex.targetSets === 'number' ? ex.targetSets : 3),
      };
    });
    return {
      id: typeof day.id === 'string' ? day.id : String(day.id ?? ''),
      name: typeof day.name === 'string' ? day.name : '',
      position: typeof day.position === 'number' ? day.position : dayIdx,
      exercises,
    };
  });
}

export function getDefaultAppData(): AppData {
  return {
    version: 2,
    currentWorkoutIndex: 0,
    workoutPlan: getDefaultWorkoutPlan(),
    presetExercises,
    customExercises: [],
    activeWorkout: null,
    workoutHistory: [],
  };
}

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultAppData();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed?.version === 1 || parsed?.version === 2) {
      return {
        version: 2,
        currentWorkoutIndex: typeof parsed.currentWorkoutIndex === 'number' ? parsed.currentWorkoutIndex : 0,
        workoutPlan: normalizeWorkoutPlan(parsed.workoutPlan),
        presetExercises:
          Array.isArray(parsed.presetExercises) && parsed.presetExercises.length > 0
            ? (parsed.presetExercises as Exercise[])
            : presetExercises,
        customExercises: Array.isArray(parsed.customExercises) ? parsed.customExercises : [],
        activeWorkout: parsed.activeWorkout ? (parsed.activeWorkout as AppData['activeWorkout']) : null,
        workoutHistory: Array.isArray(parsed.workoutHistory) ? parsed.workoutHistory : [],
      };
    }
    return getDefaultAppData();
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