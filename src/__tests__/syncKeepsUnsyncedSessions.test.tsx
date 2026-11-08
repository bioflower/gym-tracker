import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGymTracker } from '../hooks/useGymTracker';
import { getDefaultAppData } from '../utils/storage';
import * as workouts from '../api/workouts';
import type { WorkoutSession } from '../types/gym';

vi.mock('../api/sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/sync')>()),
  isOnline: () => true,
  setupSyncListener: () => () => {},
}));
vi.mock('../api/workouts');

const session = (id: string, date: string): WorkoutSession => ({
  id, workoutDayId: 'd', workoutName: 'w', date, startedAt: null, completedAt: null, status: 'completed',
  exercises: [{ id: 'e' + id, exerciseId: 'sq', exerciseName: 'Squat', trackingType: 'weight-reps',
    sets: [{ id: 's' + id, type: 'weight-reps', weight: 100, weightUnit: 'kg', reps: 1, completed: true }] }],
});

describe('syncFromServer', () => {
  beforeEach(() => window.localStorage.clear());

  it('keeps a finished session the server has not received yet', async () => {
    const data = getDefaultAppData();
    data.workoutHistory = [session('new', '2026-10-22')];
    window.localStorage.setItem('gym-tracker-data-v1', JSON.stringify(data));
    vi.mocked(workouts.fetchExercises).mockRejectedValue(new Error('x'));
    vi.mocked(workouts.fetchPlan).mockRejectedValue(new Error('x'));
    vi.mocked(workouts.fetchSessions).mockResolvedValue([session('old', '2026-10-01')]);

    const { result } = renderHook(() => useGymTracker());
    await act(async () => {});
    await waitFor(() => expect(workouts.fetchSessions).toHaveBeenCalled());

    expect(result.current.data.workoutHistory.map(s => s.id).sort()).toEqual(['new', 'old']);
  });
});
