import { apiRequest, API_BASE } from './client';
import type {
  Exercise, WorkoutDay, WorkoutSession,
  CompletedExercise, CompletedSet,
  WeightUnit, DistanceUnit, TrackingType,
} from '../types/gym';

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Fetch every page of a paginated DRF list endpoint and return all items. */
async function fetchAll<T>(startPath: string): Promise<T[]> {
  const all: T[] = [];
  let path: string | null = startPath;
  while (path) {
    // eslint-disable-next-line no-await-in-loop
    const raw = await apiRequest<Paginated<T> | T[]>(path);
    if (Array.isArray(raw)) {
      all.push(...raw);
      path = null;
    } else {
      const page = raw as Paginated<T>;
      all.push(...page.results);
      path = page.next ? page.next.replace(API_BASE, '') : null;
    }
  }
  return all;
}

// ---------------------------------------------------------------------------
// Exercise catalog
// ---------------------------------------------------------------------------

interface ServerExercise {
  id: string;
  name: string;
  category: Exercise['category'];
  tracking_type: Exercise['trackingType'];
  equipment: string;
  is_preset: boolean;
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

export async function fetchExercises(): Promise<Exercise[]> {
  const raw = await fetchAll<ServerExercise>('/workouts/exercises/');
  return raw.map(mapExercise);
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

// ---------------------------------------------------------------------------
// Workout plan
// ---------------------------------------------------------------------------

export async function fetchPlan(): Promise<WorkoutDay[]> {
  return apiRequest<WorkoutDay[]>('/workouts/plan/');
}

export async function savePlan(days: WorkoutDay[]): Promise<WorkoutDay[]> {
  return apiRequest<WorkoutDay[]>('/workouts/plan/', {
    method: 'PUT',
    body: JSON.stringify(days),
  });
}

// ---------------------------------------------------------------------------
// Sessions — server → frontend transformation
// DRF uses snake_case; Django DecimalFields arrive as strings.
// ---------------------------------------------------------------------------

interface ServerCompletedSet {
  id: string;
  type: CompletedSet['type'];
  weight: string | null;         // DecimalField → string
  weight_unit: string | null;
  reps: number | null;
  duration_seconds: number | null;
  distance: string | null;       // DecimalField → string
  distance_unit: string | null;
  started_at: string | null;
  completed_at: string | null;
  completed: boolean;
}

interface ServerCompletedExercise {
  id: string;
  exercise: string | null;       // FK UUID → exerciseId
  exercise_name: string;
  tracking_type: CompletedExercise['trackingType'];
  started_at?: string | null;
  completed_at?: string | null;
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

function mapSet(s: ServerCompletedSet): CompletedSet {
  return {
    id: s.id,
    type: s.type,
    weight:          s.weight   !== null ? Number(s.weight)   : null,
    weightUnit:      s.weight_unit   as WeightUnit   | null,
    reps:            s.reps,
    durationSeconds: s.duration_seconds,
    distance:        s.distance !== null ? Number(s.distance) : null,
    distanceUnit:    s.distance_unit as DistanceUnit | null,
    startedAt:       s.started_at,
    completedAt:     s.completed_at,
    completed:       s.completed,
  };
}

function mapCompletedExercise(e: ServerCompletedExercise): CompletedExercise {
  return {
    id:            e.id,
    exerciseId:    e.exercise ?? '',
    exerciseName:  e.exercise_name,
    trackingType:  e.tracking_type as TrackingType,
    startedAt:     e.started_at  ?? null,
    completedAt:   e.completed_at ?? null,
    sets:          e.sets.map(mapSet),
  };
}

export function mapSession(s: ServerSession): WorkoutSession {
  return {
    id:           s.id,
    workoutDayId: s.workout_day ?? '',
    workoutName:  s.workout_name,
    date:         s.date,
    startedAt:    s.started_at,
    completedAt:  s.completed_at,
    status:       s.status,
    exercises:    s.exercises.map(mapCompletedExercise),
  };
}

export async function fetchSessions(): Promise<WorkoutSession[]> {
  const raw = await fetchAll<ServerSession>('/workouts/sessions/');
  return raw.map(mapSession);
}

export async function saveSession(session: Partial<WorkoutSession>): Promise<WorkoutSession> {
  return apiRequest<WorkoutSession>('/workouts/sessions/', {
    method: 'POST',
    body: JSON.stringify(session),
  });
}
