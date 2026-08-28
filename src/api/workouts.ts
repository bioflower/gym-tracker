import { apiRequest } from './client';
import type { Exercise, WorkoutDay, WorkoutSession } from '../types/gym';

interface ServerExercise {
  id: string;
  name: string;
  category: Exercise['category'];
  tracking_type: Exercise['trackingType'];
  equipment?: string;
  is_preset: boolean;
}

function toExercise(raw: ServerExercise): Exercise {
  return {
    id: raw.id,
    name: raw.name,
    category: raw.category,
    trackingType: raw.tracking_type,
    equipment: raw.equipment,
    isPreset: raw.is_preset,
  };
}

export async function fetchExercises(): Promise<Exercise[]> {
  const raw = await apiRequest<ServerExercise[]>('/workouts/exercises/');
  return raw.map(toExercise);
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
  return apiRequest<WorkoutSession[]>('/workouts/sessions/');
}

export async function saveSession(session: Partial<WorkoutSession>): Promise<WorkoutSession> {
  return apiRequest<WorkoutSession>('/workouts/sessions/', {
    method: 'POST',
    body: JSON.stringify(session),
  });
}
