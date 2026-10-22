import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TodayPage } from '../pages/TodayPage';
import * as workouts from '../api/workouts';
import { getDefaultAppData } from '../utils/storage';

vi.mock('../api/sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/sync')>()),
  isOnline: () => true,
  enqueue: vi.fn(),
  setupSyncListener: () => () => {},
}));
vi.mock('../api/workouts');

function seedFinishedExercise(done: boolean) {
  const data = getDefaultAppData();
  data.activeWorkout = {
    id: 'w1', workoutDayId: 'workout-a', workoutName: 'Workout A', date: '2026-10-22',
    startedAt: '2026-10-22T10:00:00Z', completedAt: null, status: 'in-progress',
    exercises: [{
      id: 'e1', exerciseId: '0a1b2c3d-0001-4000-8000-000000000003', exerciseName: 'Barbell Lunge',
      trackingType: 'weight-reps', sets: [], notes: '', startedAt: null, completedAt: null, completed: done,
    }],
  };
  window.localStorage.setItem('gym-tracker-data-v1', JSON.stringify(data));
}

describe('session payload', () => {
  beforeEach(() => window.localStorage.clear());

  it('never sends a non-UUID workout_day (server rejects it with 400)', async () => {
    vi.mocked(workouts.fetchExercises).mockRejectedValue(new Error('x'));
    vi.mocked(workouts.fetchPlan).mockRejectedValue(new Error('x'));
    vi.mocked(workouts.fetchSessions).mockRejectedValue(new Error('x'));
    vi.mocked(workouts.saveSession).mockResolvedValue({} as never);

    seedFinishedExercise(true);
    render(<MemoryRouter><TodayPage /></MemoryRouter>);
    await act(async () => { fireEvent.click(screen.getByText('Finish Workout')); });

    const body = vi.mocked(workouts.saveSession).mock.calls[0][0] as { workout_day: string | null; workout_name: string };
    expect(body.workout_day).toBeNull();
    expect(body.workout_name).toBe('Lower Body');
  });

  it('does not save or add history when nothing was done', async () => {
    vi.mocked(workouts.saveSession).mockClear();
    seedFinishedExercise(false);
    render(<MemoryRouter><TodayPage /></MemoryRouter>);
    await act(async () => { fireEvent.click(screen.getByText('Finish Workout')); });
    await act(async () => { fireEvent.click(screen.getByText('Finish Anyway')); });
    expect(workouts.saveSession).not.toHaveBeenCalled();
    expect(JSON.parse(window.localStorage.getItem('gym-tracker-data-v1')!).workoutHistory).toEqual([]);
  });
});
