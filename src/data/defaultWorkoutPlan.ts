import type { WorkoutDay } from '../types/gym';

export function getDefaultWorkoutPlan(): WorkoutDay[] {
  return [
    {
      id: 'workout-a',
      name: 'Workout A',
      exercises: [
        { id: 'plan-a-1', exerciseId: 'lower-dumbbell-deadlift', position: 0, targetSets: 3 },
        { id: 'plan-a-2', exerciseId: 'chest-push-up', position: 1, targetSets: 3 },
        { id: 'plan-a-3', exerciseId: 'back-dumbbell-row', position: 2, targetSets: 3 },
        { id: 'plan-a-4', exerciseId: 'core-crunch', position: 3, targetSets: 3 },
      ],
    },
    {
      id: 'workout-b',
      name: 'Workout B',
      exercises: [
        { id: 'plan-b-1', exerciseId: 'lower-dumbbell-lunge', position: 0, targetSets: 3 },
        { id: 'plan-b-2', exerciseId: 'chest-dumbbell-bench-press', position: 1, targetSets: 3 },
        { id: 'plan-b-3', exerciseId: 'arms-dumbbell-curl', position: 2, targetSets: 3 },
        { id: 'plan-b-4', exerciseId: 'core-lying-leg-raise', position: 3, targetSets: 3 },
      ],
    },
    {
      id: 'workout-c',
      name: 'Workout C',
      exercises: [
        { id: 'plan-c-1', exerciseId: 'lower-goblet-squat', position: 0, targetSets: 3 },
        { id: 'plan-c-2', exerciseId: 'shoulder-shoulder-press', position: 1, targetSets: 3 },
        { id: 'plan-c-3', exerciseId: 'back-lat-pulldown', position: 2, targetSets: 3 },
        { id: 'plan-c-4', exerciseId: 'core-plank', position: 3, targetSets: 3 },
      ],
    },
  ];
}
