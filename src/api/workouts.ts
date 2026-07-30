import { apiRequest } from './client';
import type { Exercise, WorkoutDay, WorkoutSession } from '../types/gym';

export async function fetchExercises(): Promise<Exercise[]> {
  return apiRequest<Exercise[]>('/workouts/exercises/');
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
