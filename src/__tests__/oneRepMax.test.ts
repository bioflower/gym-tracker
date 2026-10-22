import { describe, it, expect } from 'vitest';
import { estimateOneRepMax, getOneRepMaxSeries } from '../utils/oneRepMax';
import type { WorkoutSession } from '../types/gym';

const session = (date: string, sets: { weight: number; reps: number; weightUnit?: 'kg' | 'lb' }[]): WorkoutSession => ({
  id: date, workoutDayId: 'd', workoutName: 'w', date, startedAt: null, completedAt: null, status: 'completed',
  exercises: [{ id: 'e' + date, exerciseId: 'sq', exerciseName: 'Squat', trackingType: 'weight-reps',
    sets: sets.map((s, i) => ({ id: String(i), type: 'weight-reps' as const, weightUnit: 'kg' as const, completed: true, ...s })) }],
});

describe('oneRepMax', () => {
  it('estimates with Epley, 1 rep is exact', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(100, 3)).toBeCloseTo(110);
  });
  it('takes best set per date, sorted by date, converts units', () => {
    const h = [session('2026-02-01', [{ weight: 100, reps: 1 }]), session('2026-01-01', [{ weight: 50, reps: 1 }, { weight: 90, reps: 3 }])];
    const s = getOneRepMaxSeries(h, 'sq', 'kg');
    expect(s.map(p => p.date)).toEqual(['2026-01-01', '2026-02-01']);
    expect(s[0].value).toBeCloseTo(99);
    expect(getOneRepMaxSeries([session('2026-01-01', [{ weight: 220.462, reps: 1, weightUnit: 'lb' }])], 'sq', 'kg')[0].value).toBeCloseTo(100);
  });
});
