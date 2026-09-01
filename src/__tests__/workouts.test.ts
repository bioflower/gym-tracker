import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchExercises, fetchSessions } from '../api/workouts';

vi.mock('../api/client', () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from '../api/client';
const mockedApiRequest = vi.mocked(apiRequest);

describe('fetchExercises', () => {
  it('unwraps the paginated DRF response into a plain array', async () => {
    const results = [
      { id: 'ex-1', name: 'Squat', category: 'lower-body', tracking_type: 'weight-reps', equipment: '', is_preset: true },
      { id: 'ex-2', name: 'Curl', category: 'arms', tracking_type: 'reps', equipment: '', is_preset: false },
    ];
    mockedApiRequest.mockResolvedValue({ count: 2, next: null, previous: null, results });

    const exercises = await fetchExercises();

    expect(Array.isArray(exercises)).toBe(true);
    expect(exercises).toHaveLength(2);
    expect(mockedApiRequest).toHaveBeenCalledWith('/workouts/exercises/');
  });
});

describe('fetchSessions', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('unwraps the paginated DRF response into a plain array', async () => {
    const results = [
      {
        id: 'sess-1',
        workout_day: 'day-1',
        workout_name: 'Workout A',
        date: '2026-08-07',
        started_at: '2026-08-07T09:00:00Z',
        completed_at: '2026-08-07T09:30:00Z',
        status: 'completed',
        exercises: [],
      },
    ];
    mockedApiRequest.mockResolvedValue({ count: 1, next: null, previous: null, results });

    const sessions = await fetchSessions();

    expect(Array.isArray(sessions)).toBe(true);
    expect(sessions).toHaveLength(1);
  });

  it('maps the snake_case server payload to the camelCase WorkoutSession shape', async () => {
    const results = [
      {
        id: 'sess-1',
        workout_day: 'day-1',
        workout_name: 'Workout A',
        date: '2026-08-07',
        started_at: '2026-08-07T09:00:00Z',
        completed_at: '2026-08-07T09:30:00Z',
        status: 'completed',
        exercises: [
          {
            id: 'ce-1',
            exercise: 'ex-1',
            exercise_name: 'Squat',
            tracking_type: 'weight-reps',
            sets: [
              {
                id: 'set-1',
                type: 'weight-reps',
                weight: '80.00',
                weight_unit: 'kg',
                reps: 10,
                duration_seconds: null,
                distance: null,
                distance_unit: null,
                started_at: '2026-08-07T09:10:00Z',
                completed_at: '2026-08-07T09:12:00Z',
                completed: true,
              },
            ],
          },
        ],
      },
    ];
    mockedApiRequest.mockResolvedValue({ count: 1, next: null, previous: null, results });

    const [session] = await fetchSessions();

    expect(session).toEqual({
      id: 'sess-1',
      workoutDayId: 'day-1',
      workoutName: 'Workout A',
      date: '2026-08-07',
      startedAt: '2026-08-07T09:00:00Z',
      completedAt: '2026-08-07T09:30:00Z',
      status: 'completed',
      exercises: [
        {
          id: 'ce-1',
          exerciseId: 'ex-1',
          exerciseName: 'Squat',
          trackingType: 'weight-reps',
          startedAt: null,
          completedAt: null,
          sets: [
            {
              id: 'set-1',
              type: 'weight-reps',
              weight: 80,
              weightUnit: 'kg',
              reps: 10,
              durationSeconds: null,
              distance: null,
              distanceUnit: null,
              startedAt: '2026-08-07T09:10:00Z',
              completedAt: '2026-08-07T09:12:00Z',
              completed: true,
            },
          ],
        },
      ],
    });
  });
});
