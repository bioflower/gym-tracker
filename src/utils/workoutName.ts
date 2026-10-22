import type { Exercise } from '../types/gym';

const LABELS: Record<string, string> = {
  'lower-body': 'Lower Body',
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  arms: 'Arms',
  core: 'Core',
  cardio: 'Cardio',
};

/** "Lower Body + Chest": every muscle group with a done exercise, in workout order. */
export function buildWorkoutName(
  doneExerciseIds: string[],
  allExercises: Exercise[],
): string {
  const groups = new Set<string>();
  for (const id of doneExerciseIds) {
    const label = LABELS[allExercises.find(e => e.id === id)?.category ?? ''];
    if (label) groups.add(label);
  }
  return [...groups].join(' + ');
}
