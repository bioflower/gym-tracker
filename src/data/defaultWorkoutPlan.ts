import type { WorkoutDay } from '../types/gym';

export function getDefaultWorkoutPlan(): WorkoutDay[] {
  return [
    {
      id: 'workout-a',
      name: 'Workout A',
      exercises: [
        { id: 'plan-a-1', exerciseId: 'lower-barbell-lunge', position: 0, targetSets: 3 },
        { id: 'plan-a-2', exerciseId: 'chest-barbell-bench-press', position: 1, targetSets: 3 },
        { id: 'plan-a-3', exerciseId: 'back-lat-pulldown', position: 2, targetSets: 3 },
        { id: 'plan-a-4', exerciseId: 'core-crunch', position: 3, targetSets: 3 },
      ],
    },
    {
      id: 'workout-b',
      name: 'Workout B',
      exercises: [
        { id: 'plan-b-1', exerciseId: 'lower-hip-thrust', position: 0, targetSets: 3 },
        { id: 'plan-b-2', exerciseId: 'chest-fly', position: 1, targetSets: 3 },
        { id: 'plan-b-3', exerciseId: 'shoulder-lateral-raise', position: 2, targetSets: 3 },
        { id: 'plan-b-4', exerciseId: 'back-seated-cable-row', position: 3, targetSets: 3 },
      ],
    },
    {
      id: 'workout-c',
      name: 'Workout C',
      exercises: [
        { id: 'plan-c-1', exerciseId: 'lower-barbell-squat', position: 0, targetSets: 3 },
        { id: 'plan-c-2', exerciseId: 'chest-barbell-bench-press', position: 1, targetSets: 3 },
        { id: 'plan-c-3', exerciseId: 'back-lat-pulldown', position: 2, targetSets: 3 },
        { id: 'plan-c-4', exerciseId: 'core-lying-leg-raise', position: 3, targetSets: 3 },
      ],
    },
  ];
}
