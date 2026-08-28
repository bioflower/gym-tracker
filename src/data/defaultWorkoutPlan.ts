import type { WorkoutDay } from '../types/gym';

export function getDefaultWorkoutPlan(): WorkoutDay[] {
  return [
    {
      id: 'workout-a',
      name: 'Workout A',
      position: 0,
      exercises: [
        { id: 'plan-a-1', exercise: '0a1b2c3d-0001-4000-8000-000000000003', position: 0, target_sets: 3 },
        { id: 'plan-a-2', exercise: '0a1b2c3d-0002-4000-8000-000000000002', position: 1, target_sets: 3 },
        { id: 'plan-a-3', exercise: '0a1b2c3d-0003-4000-8000-000000000003', position: 2, target_sets: 3 },
        { id: 'plan-a-4', exercise: '0a1b2c3d-0006-4000-8000-000000000001', position: 3, target_sets: 3 },
      ],
    },
    {
      id: 'workout-b',
      name: 'Workout B',
      position: 1,
      exercises: [
        { id: 'plan-b-1', exercise: '0a1b2c3d-0001-4000-8000-000000000007', position: 0, target_sets: 3 },
        { id: 'plan-b-2', exercise: '0a1b2c3d-0002-4000-8000-000000000005', position: 1, target_sets: 3 },
        { id: 'plan-b-3', exercise: '0a1b2c3d-0004-4000-8000-000000000002', position: 2, target_sets: 3 },
        { id: 'plan-b-4', exercise: '0a1b2c3d-0003-4000-8000-000000000005', position: 3, target_sets: 3 },
      ],
    },
    {
      id: 'workout-c',
      name: 'Workout C',
      position: 2,
      exercises: [
        { id: 'plan-c-1', exercise: '0a1b2c3d-0001-4000-8000-000000000005', position: 0, target_sets: 3 },
        { id: 'plan-c-2', exercise: '0a1b2c3d-0002-4000-8000-000000000002', position: 1, target_sets: 3 },
        { id: 'plan-c-3', exercise: '0a1b2c3d-0003-4000-8000-000000000003', position: 2, target_sets: 3 },
        { id: 'plan-c-4', exercise: '0a1b2c3d-0006-4000-8000-000000000004', position: 3, target_sets: 3 },
      ],
    },
  ];
}