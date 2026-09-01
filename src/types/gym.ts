export type ExerciseCategory =
  | 'lower-body'
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'core'
  | 'cardio'
  | 'other';

export type TrackingType =
  | 'weight-reps'
  | 'reps'
  | 'duration'
  | 'distance-duration';

export type WeightUnit = 'kg' | 'lb';

export type DistanceUnit = 'km' | 'm' | 'mi';

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  trackingType: TrackingType;
  equipment?: string;
  isPreset: boolean;
}

export interface WeightRepSet {
  id: string;
  weight: number | null;
  weightUnit: WeightUnit;
  reps: number | null;
  startedAt: string | null;
  completedAt: string | null;
  completed: boolean;
}

export interface RepsOnlySet {
  id: string;
  reps: number | null;
  startedAt: string | null;
  completedAt: string | null;
  completed: boolean;
}

export interface DurationSet {
  id: string;
  durationSeconds: number | null;
  startedAt: string | null;
  completedAt: string | null;
  completed: boolean;
}

export interface DistanceDurationSet {
  id: string;
  distance: number | null;
  distanceUnit: DistanceUnit;
  durationSeconds: number | null;
  notes: string;
  startedAt: string | null;
  completedAt: string | null;
  completed: boolean;
}

export type ExerciseSet = WeightRepSet | RepsOnlySet | DurationSet | DistanceDurationSet;

export interface WorkoutDay {
  id: string;
  name: string;
  position: number;
  exercises: PlannedExercise[];
}

export interface PlannedExercise {
  id: string;
  exercise: string;
  position: number;
  target_sets: number;
}

export interface ActiveWorkoutSession {
  id: string;
  workoutDayId: string;
  workoutName: string;
  date: string;
  startedAt: string | null;
  completedAt: string | null;
  status: 'not-started' | 'in-progress';
  exercises: ActiveExercise[];
}

export interface ActiveExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  trackingType: TrackingType;
  sets: ExerciseSet[];
  notes: string;
  startedAt: string | null;
  completedAt: string | null;
  completed: boolean;
}

export interface CompletedSet {
  id: string;
  type: TrackingType;
  weight?: number | null;
  weightUnit?: WeightUnit | null;
  reps?: number | null;
  durationSeconds?: number | null;
  distance?: number | null;
  distanceUnit?: DistanceUnit | null;
  startedAt?: string | null;
  completedAt?: string | null;
  completed?: boolean;
}

export interface CompletedExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  trackingType: TrackingType;
  startedAt?: string | null;
  completedAt?: string | null;
  sets: CompletedSet[];
}

export interface WorkoutSession {
  id: string;
  workoutDayId: string;
  workoutName: string;
  date: string;
  startedAt: string | null;
  completedAt: string | null;
  status: 'completed' | 'skipped';
  exercises: CompletedExercise[];
}

export interface AppData {
  version: 2;
  currentWorkoutIndex: number;
  workoutPlan: WorkoutDay[];
  presetExercises: Exercise[];
  customExercises: Exercise[];
  activeWorkout: ActiveWorkoutSession | null;
  workoutHistory: WorkoutSession[];
}
