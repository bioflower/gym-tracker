import type { Exercise } from '../types/gym';

export const presetExercises: Exercise[] = [
  // Lower body
  { id: 'lower-dumbbell-deadlift', name: 'Dumbbell Deadlift', category: 'lower-body', trackingType: 'weight-reps', isPreset: true },
  { id: 'lower-goblet-squat', name: 'Goblet Squat', category: 'lower-body', trackingType: 'weight-reps', isPreset: true },
  { id: 'lower-barbell-lunge', name: 'Barbell Lunge', category: 'lower-body', trackingType: 'weight-reps', isPreset: true },
  { id: 'lower-romanian-deadlift', name: 'Romanian Deadlift', category: 'lower-body', trackingType: 'weight-reps', isPreset: true },
  { id: 'lower-barbell-squat', name: 'Barbell Squat', category: 'lower-body', trackingType: 'weight-reps', isPreset: true },
  { id: 'lower-leg-press', name: 'Leg Press', category: 'lower-body', trackingType: 'weight-reps', isPreset: true },
  { id: 'lower-hip-thrust', name: 'Hip Thrust', category: 'lower-body', trackingType: 'weight-reps', isPreset: true },
  { id: 'lower-calf-raise', name: 'Calf Raise', category: 'lower-body', trackingType: 'weight-reps', isPreset: true },
  // Chest
  { id: 'chest-push-up', name: 'Push-up', category: 'chest', trackingType: 'reps', isPreset: true },
  { id: 'chest-barbell-bench-press', name: 'Barbell Bench Press', category: 'chest', trackingType: 'weight-reps', isPreset: true },
  { id: 'chest-dumbbell-bench-press', name: 'Dumbbell Bench Press', category: 'chest', trackingType: 'weight-reps', isPreset: true },
  { id: 'chest-incline-dumbbell-press', name: 'Incline Dumbbell Press', category: 'chest', trackingType: 'weight-reps', isPreset: true },
  { id: 'chest-fly', name: 'Chest Fly', category: 'chest', trackingType: 'weight-reps', isPreset: true },
  // Back
  { id: 'back-dumbbell-row', name: 'Dumbbell Row', category: 'back', trackingType: 'weight-reps', isPreset: true },
  { id: 'back-barbell-row', name: 'Barbell Row', category: 'back', trackingType: 'weight-reps', isPreset: true },
  { id: 'back-lat-pulldown', name: 'Lat Pulldown', category: 'back', trackingType: 'weight-reps', isPreset: true },
  { id: 'back-pull-up', name: 'Pull-up', category: 'back', trackingType: 'reps', isPreset: true },
  { id: 'back-seated-cable-row', name: 'Seated Cable Row', category: 'back', trackingType: 'weight-reps', isPreset: true },
  // Shoulders
  { id: 'shoulder-shoulder-press', name: 'Shoulder Press', category: 'shoulders', trackingType: 'weight-reps', isPreset: true },
  { id: 'shoulder-lateral-raise', name: 'Lateral Raise', category: 'shoulders', trackingType: 'weight-reps', isPreset: true },
  { id: 'shoulder-front-raise', name: 'Front Raise', category: 'shoulders', trackingType: 'weight-reps', isPreset: true },
  // Arms
  { id: 'arms-dumbbell-curl', name: 'Dumbbell Curl', category: 'arms', trackingType: 'weight-reps', isPreset: true },
  { id: 'arms-hammer-curl', name: 'Hammer Curl', category: 'arms', trackingType: 'weight-reps', isPreset: true },
  { id: 'arms-triceps-extension', name: 'Triceps Extension', category: 'arms', trackingType: 'weight-reps', isPreset: true },
  { id: 'arms-triceps-pushdown', name: 'Triceps Pushdown', category: 'arms', trackingType: 'weight-reps', isPreset: true },
  // Core
  { id: 'core-crunch', name: 'Crunch', category: 'core', trackingType: 'reps', isPreset: true },
  { id: 'core-plank', name: 'Plank', category: 'core', trackingType: 'duration', isPreset: true },
  { id: 'core-side-plank', name: 'Side Plank', category: 'core', trackingType: 'duration', isPreset: true },
  { id: 'core-lying-leg-raise', name: 'Lying Leg Raise', category: 'core', trackingType: 'reps', isPreset: true },
  { id: 'core-russian-twist', name: 'Russian Twist', category: 'core', trackingType: 'reps', isPreset: true },
  // Cardio
  { id: 'cardio-running', name: 'Running', category: 'cardio', trackingType: 'distance-duration', isPreset: true },
  { id: 'cardio-treadmill', name: 'Treadmill', category: 'cardio', trackingType: 'distance-duration', isPreset: true },
  { id: 'cardio-cycling', name: 'Cycling', category: 'cardio', trackingType: 'distance-duration', isPreset: true },
  { id: 'cardio-rowing-machine', name: 'Rowing Machine', category: 'cardio', trackingType: 'distance-duration', isPreset: true },
  { id: 'cardio-stair-climber', name: 'Stair Climber', category: 'cardio', trackingType: 'distance-duration', isPreset: true },
];
