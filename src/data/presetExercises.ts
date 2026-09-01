import type { Exercise } from '../types/gym';

export const presetExercises: Exercise[] = [
  // Lower body
  { id: '0a1b2c3d-0001-4000-8000-000000000001', name: 'Dumbbell Deadlift', category: 'lower-body', trackingType: 'weight-reps', isPreset: true },
  { id: '0a1b2c3d-0001-4000-8000-000000000002', name: 'Goblet Squat', category: 'lower-body', trackingType: 'weight-reps', isPreset: true },
  { id: '0a1b2c3d-0001-4000-8000-000000000003', name: 'Dumbbell Lunge', category: 'lower-body', trackingType: 'weight-reps', isPreset: true },
  { id: '0a1b2c3d-0001-4000-8000-000000000004', name: 'Romanian Deadlift', category: 'lower-body', trackingType: 'weight-reps', isPreset: true },
  { id: '0a1b2c3d-0001-4000-8000-000000000005', name: 'Barbell Squat', category: 'lower-body', trackingType: 'weight-reps', isPreset: true },
  { id: '0a1b2c3d-0001-4000-8000-000000000006', name: 'Leg Press', category: 'lower-body', trackingType: 'weight-reps', isPreset: true },
  { id: '0a1b2c3d-0001-4000-8000-000000000007', name: 'Hip Thrust', category: 'lower-body', trackingType: 'weight-reps', isPreset: true },
  { id: '0a1b2c3d-0001-4000-8000-000000000008', name: 'Calf Raise', category: 'lower-body', trackingType: 'weight-reps', isPreset: true },
  // Chest
  { id: '0a1b2c3d-0002-4000-8000-000000000001', name: 'Push-up', category: 'chest', trackingType: 'reps', isPreset: true },
  { id: '0a1b2c3d-0002-4000-8000-000000000002', name: 'Bench Press', category: 'chest', trackingType: 'weight-reps', isPreset: true },
  { id: '0a1b2c3d-0002-4000-8000-000000000003', name: 'Dumbbell Bench Press', category: 'chest', trackingType: 'weight-reps', isPreset: true },
  { id: '0a1b2c3d-0002-4000-8000-000000000004', name: 'Incline Dumbbell Press', category: 'chest', trackingType: 'weight-reps', isPreset: true },
  { id: '0a1b2c3d-0002-4000-8000-000000000005', name: 'Chest Fly', category: 'chest', trackingType: 'weight-reps', isPreset: true },
  // Back
  { id: '0a1b2c3d-0003-4000-8000-000000000001', name: 'Dumbbell Row', category: 'back', trackingType: 'weight-reps', isPreset: true },
  { id: '0a1b2c3d-0003-4000-8000-000000000002', name: 'Barbell Row', category: 'back', trackingType: 'weight-reps', isPreset: true },
  { id: '0a1b2c3d-0003-4000-8000-000000000003', name: 'Lat Pulldown', category: 'back', trackingType: 'weight-reps', isPreset: true },
  { id: '0a1b2c3d-0003-4000-8000-000000000004', name: 'Pull-up', category: 'back', trackingType: 'reps', isPreset: true },
  { id: '0a1b2c3d-0003-4000-8000-000000000005', name: 'Seated Cable Row', category: 'back', trackingType: 'weight-reps', isPreset: true },
  // Shoulders
  { id: '0a1b2c3d-0004-4000-8000-000000000001', name: 'Shoulder Press', category: 'shoulders', trackingType: 'weight-reps', isPreset: true },
  { id: '0a1b2c3d-0004-4000-8000-000000000002', name: 'Lateral Raise', category: 'shoulders', trackingType: 'weight-reps', isPreset: true },
  { id: '0a1b2c3d-0004-4000-8000-000000000003', name: 'Front Raise', category: 'shoulders', trackingType: 'weight-reps', isPreset: true },
  // Arms
  { id: '0a1b2c3d-0005-4000-8000-000000000001', name: 'Dumbbell Curl', category: 'arms', trackingType: 'weight-reps', isPreset: true },
  { id: '0a1b2c3d-0005-4000-8000-000000000002', name: 'Hammer Curl', category: 'arms', trackingType: 'weight-reps', isPreset: true },
  { id: '0a1b2c3d-0005-4000-8000-000000000003', name: 'Triceps Extension', category: 'arms', trackingType: 'weight-reps', isPreset: true },
  { id: '0a1b2c3d-0005-4000-8000-000000000004', name: 'Triceps Pushdown', category: 'arms', trackingType: 'weight-reps', isPreset: true },
  // Core
  { id: '0a1b2c3d-0006-4000-8000-000000000001', name: 'Crunch', category: 'core', trackingType: 'reps', isPreset: true },
  { id: '0a1b2c3d-0006-4000-8000-000000000002', name: 'Plank', category: 'core', trackingType: 'duration', isPreset: true },
  { id: '0a1b2c3d-0006-4000-8000-000000000003', name: 'Side Plank', category: 'core', trackingType: 'duration', isPreset: true },
  { id: '0a1b2c3d-0006-4000-8000-000000000004', name: 'Lying Leg Raise', category: 'core', trackingType: 'reps', isPreset: true },
  { id: '0a1b2c3d-0006-4000-8000-000000000005', name: 'Russian Twist', category: 'core', trackingType: 'reps', isPreset: true },
  // Cardio
  { id: '0a1b2c3d-0007-4000-8000-000000000001', name: 'Running', category: 'cardio', trackingType: 'distance-duration', isPreset: true },
  { id: '0a1b2c3d-0007-4000-8000-000000000002', name: 'Treadmill', category: 'cardio', trackingType: 'distance-duration', isPreset: true },
  { id: '0a1b2c3d-0007-4000-8000-000000000003', name: 'Cycling', category: 'cardio', trackingType: 'distance-duration', isPreset: true },
  { id: '0a1b2c3d-0007-4000-8000-000000000004', name: 'Rowing Machine', category: 'cardio', trackingType: 'distance-duration', isPreset: true },
  { id: '0a1b2c3d-0007-4000-8000-000000000005', name: 'Stair Climber', category: 'cardio', trackingType: 'distance-duration', isPreset: true },
];