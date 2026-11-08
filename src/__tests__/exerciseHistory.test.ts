import { describe, it, expect } from 'vitest';
import { findMostRecentExerciseResult } from '../utils/exerciseHistory';
import type { WorkoutSession, CompletedSet } from '../types/gym';

const session = (id: string, date: string, sets: CompletedSet[]): WorkoutSession => ({
  id, workoutDayId: 'd', workoutName: 'w', date, startedAt: null, completedAt: null, status: 'completed',
  exercises: [{ id: 'e' + id, exerciseId: 'sq', exerciseName: 'Squat', trackingType: 'weight-reps', sets }],
});
const done: CompletedSet = { id: 's', type: 'weight-reps', weight: 100, weightUnit: 'kg', reps: 5, completed: true };

describe('findMostRecentExerciseResult', () => {
  it('skips newer sessions where the exercise was never logged', () => {
    const history = [session('new', '2026-10-22', []), session('old', '2026-10-01', [done])];
    expect(findMostRecentExerciseResult(history, 'sq', 'Squat')?.id).toBe('eold');
  });

  it('puts a logged set first when the earlier sets were left incomplete', () => {
    const skipped: CompletedSet = { id: 'x', type: 'weight-reps', weight: null, reps: null, completed: false };
    const result = findMostRecentExerciseResult([session('a', '2026-10-01', [skipped, done])], 'sq', 'Squat');
    expect(result?.sets[0]).toBe(done);
  });
});
