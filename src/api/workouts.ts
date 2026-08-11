import { apiRequest } from './client';
import type {
  Exercise, WorkoutDay, WorkoutSession,
  CompletedExercise, CompletedSet,
  WeightUnit, DistanceUnit,
} from '../types/gym';

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface ServerExercise {
  id: string;
  name: string;
  category: Exercise['category'];
  tracking_type: Exercise['trackingType'];
  equipment: string;
  is_preset: boolean;
}

interface ServerCompletedSet {
  id: string;
  type: CompletedSet['type'];
  weight: string | null;
  weight_unit: string | null;
  reps: number | null;
  duration_seconds: number | null;
  distance: string | null;
  distance_unit: string | null;
  started_at: string | null;
  completed_at: string | null;
  completed: boolean;
}

interface ServerCompletedExercise {
  id: string;
  exercise: string | null;
  exercise_name: string;
  tracking_type: CompletedExercise['trackingType'];
  sets: ServerCompletedSet[];
}

interface ServerSession {
  id: string;
  workout_day: string | null;
  workout_name: string;
  date: string;
  started_at: string | null;
  completed_at: string | null;
  status: 'completed' | 'skipped';
  exercises: ServerCompletedExercise[];
}

function unwrap<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  return ((data as Paginated<T>)?.results ?? []) as T[];
}

function mapSet(s: ServerCompletedSet): CompletedSet {
  return {
    id: s.id,
    type: s.type,
    weight: s.weight !== null ? Number(s.weight) : null,
    weightUnit: s.weight_unit as WeightUnit | null,
    reps: s.reps,
    durationSeconds: s.duration_seconds,
    distance: s.distance !== null ? Number(s.distance) : null,
    distanceUnit: s.distance_unit as DistanceUnit | null,
    startedAt: s.started_at,
    completedAt: s.completed_at,
    completed: s.completed,
  };
}

function mapExercise(ex: ServerExercise): Exercise {
  return {
    id: ex.id,
    name: ex.name,
    category: ex.category,
    trackingType: ex.tracking_type,
    equipment: ex.equipment,
    isPreset: ex.is_preset,
  };
}

function mapCompletedExercise(e: ServerCompletedExercise): CompletedExercise {
  return {
    id: e.id,
    exerciseId: e.exercise ?? '',
    exerciseName: e.exercise_name,
    trackingType: e.tracking_type,
    sets: e.sets.map(mapSet),
  };
}

export function mapSession(s: ServerSession): WorkoutSession {
  return {
    id: s.id,
    workoutDayId: s.workout_day ?? '',
    workoutName: s.workout_name,
    date: s.date,
    startedAt: s.started_at,
    completedAt: s.completed_at,
    status: s.status,
    exercises: s.exercises.map(mapCompletedExercise),
  };
}

export async function fetchExercises(): Promise<Exercise[]> {
  const data = await apiRequest<unknown>('/workouts/exercises/');
  return unwrap<ServerExercise>(data).map(mapExercise);
}

export async function createExercise(data: Partial<Exercise>): Promise<Exercise> {
  return apiRequest<Exercise>('/workouts/exercises/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateExercise(id: string, data: Partial<Exercise>): Promise<Exercise> {
  return apiRequest<Exercise>(`/workouts/exercises/${id}/`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteExercise(id: string): Promise<void> {
  return apiRequest<void>(`/workouts/exercises/${id}/`, { method: 'DELETE' });
}

export async function fetchPlan(): Promise<WorkoutDay[]> {
  return apiRequest<WorkoutDay[]>('/workouts/plan/');
}

export async function savePlan(days: WorkoutDay[]): Promise<WorkoutDay[]> {
  return apiRequest<WorkoutDay[]>('/workouts/plan/', {
    method: 'PUT',
    body: JSON.stringify(days),
  });
}

export async function fetchSessions(): Promise<WorkoutSession[]> {
  const data = await apiRequest<unknown>('/workouts/sessions/');
  return unwrap<ServerSession>(data).map(mapSession);
}

export async function saveSession(session: Partial<WorkoutSession>): Promise<WorkoutSession> {
  return apiRequest<WorkoutSession>('/workouts/sessions/', {
    method: 'POST',
    body: JSON.stringify(session),
  });
}
