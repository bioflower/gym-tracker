import { describe, it, expect } from 'vitest';
import { buildWorkoutName } from '../utils/workoutName';
import type { Exercise } from '../types/gym';

const ex = (id: string, category: string) => ({ id, category }) as Exercise;
const all = [ex('a', 'lower-body'), ex('b', 'chest'), ex('c', 'lower-body')];

describe('buildWorkoutName', () => {
  it('lists each done muscle group once, in order', () => {
    expect(buildWorkoutName(['a', 'b', 'c'], all)).toBe('Lower Body + Chest');
  });
  it('skips groups that were not done', () => {
    expect(buildWorkoutName(['b'], all)).toBe('Chest');
  });
  it('is empty when nothing was done', () => {
    expect(buildWorkoutName([], all)).toBe('');
  });
});
