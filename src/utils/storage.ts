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
