import { describe, it, expect, afterEach, vi } from 'vitest';
import { fetchExercises } from '../api/workouts';

describe('fetchExercises', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps server snake_case fields to frontend camelCase', async () => {
    const serverPayload = [
      { id: 'uuid-1', name: 'Crunch', category: 'core', tracking_type: 'reps', equipment: '', is_preset: true },
      { id: 'uuid-2', name: 'My Move', category: 'other', tracking_type: 'weight-reps', equipment: 'Barbell', is_preset: false },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(serverPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    const result = await fetchExercises();

    expect(result).toEqual([
      { id: 'uuid-1', name: 'Crunch', category: 'core', trackingType: 'reps', equipment: '', isPreset: true },
      { id: 'uuid-2', name: 'My Move', category: 'other', trackingType: 'weight-reps', equipment: 'Barbell', isPreset: false },
    ]);
  });
});