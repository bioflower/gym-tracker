import { describe, it, expect, beforeEach } from 'vitest';
import { loadAppData } from '../utils/storage';

const STORAGE_KEY = 'gym-tracker-data-v1';

describe('loadAppData plan migration', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('migrates a v1 slug-based plan to v2 backend field names and UUIDs', () => {
    const v1 = {
      version: 1,
      currentWorkoutIndex: 1,
      workoutPlan: [
        {
          id: 'workout-a',
          name: 'Workout A',
          exercises: [
            { id: 'plan-a-1', exerciseId: 'lower-barbell-lunge', position: 0, targetSets: 3 },
            { id: 'plan-a-2', exerciseId: 'chest-barbell-bench-press', position: 1, targetSets: 4 },
          ],
        },
      ],
      customExercises: [],
      activeWorkout: null,
      workoutHistory: [],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v1));

    const data = loadAppData();

    expect(data.version).toBe(2);
    expect(data.workoutPlan[0].position).toBe(0);
    expect(data.workoutPlan[0].exercises[0]).toEqual({
      id: 'plan-a-1',
      exercise: '0a1b2c3d-0001-4000-8000-000000000003',
      position: 0,
      target_sets: 3,
    });
    expect(data.workoutPlan[0].exercises[1]).toEqual({
      id: 'plan-a-2',
      exercise: '0a1b2c3d-0002-4000-8000-000000000002',
      position: 1,
      target_sets: 4,
    });
    expect(data.presetExercises.length).toBeGreaterThan(0);
  });

  it('leaves custom (non-slug) exercise references unchanged', () => {
    const customId = '123e4567-e89b-12d3-a456-426614174000';
    const v1 = {
      version: 1,
      currentWorkoutIndex: 0,
      workoutPlan: [
        {
          id: 'day-1',
          name: 'Custom Day',
          exercises: [
            { id: 'pe-1', exerciseId: customId, position: 0, targetSets: 5 },
          ],
        },
      ],
      customExercises: [],
      activeWorkout: null,
      workoutHistory: [],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v1));

    const data = loadAppData();

    expect(data.workoutPlan[0].exercises[0]).toEqual({
      id: 'pe-1',
      exercise: customId,
      position: 0,
      target_sets: 5,
    });
  });

  it('normalizes a version-2 plan still stored in the old shape', () => {
    const v2OldShape = {
      version: 2,
      currentWorkoutIndex: 0,
      workoutPlan: [
        {
          id: 'workout-a',
          name: 'Workout A',
          exercises: [
            { id: 'plan-a-1', exerciseId: 'core-crunch', position: 0, targetSets: 3 },
          ],
        },
      ],
      customExercises: [],
      activeWorkout: null,
      workoutHistory: [],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v2OldShape));

    const data = loadAppData();

    expect(data.workoutPlan[0].position).toBe(0);
    expect(data.workoutPlan[0].exercises[0]).toEqual({
      id: 'plan-a-1',
      exercise: '0a1b2c3d-0006-4000-8000-000000000001',
      position: 0,
      target_sets: 3,
    });
  });
});