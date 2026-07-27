import { WorkoutDay, ActiveWorkoutSession, ActiveExercise, Exercise } from '../types/gym';
import { generateId } from './validation';
import { getTodayISO, nowISO } from './dateTime';

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
