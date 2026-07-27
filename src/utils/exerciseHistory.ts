import type { WorkoutSession, CompletedExercise, ActiveExercise, TrackingType, CompletedSet, ExerciseSet } from '../types/gym';

export function findMostRecentExerciseResult(
  history: WorkoutSession[],
  exerciseId: string
): CompletedExercise | null {
  for (const session of history) {
    if (session.status !== 'completed') continue;
    const exercise = session.exercises.find(e => e.exerciseId === exerciseId);
    if (exercise) return exercise;
  }
  return null;
}

export function convertActiveToCompletedExercise(active: ActiveExercise): CompletedExercise {
  return {
    id: active.id,
    exerciseId: active.exerciseId,
    exerciseName: active.exerciseName,
    trackingType: active.trackingType,
    startedAt: active.startedAt,
    completedAt: active.completedAt,
    sets: active.sets.map(s => convertSet(s, active.trackingType)),
  };
}

function convertSet(set: ExerciseSet, trackingType: TrackingType): CompletedSet {
  const base: CompletedSet = { id: set.id, type: trackingType };
  if (trackingType === 'weight-reps') {
    const ws = set as { weight: number | null; weightUnit: 'kg' | 'lb'; reps: number | null };
    return { ...base, weight: ws.weight, weightUnit: ws.weightUnit, reps: ws.reps };
  }
  if (trackingType === 'reps') {
    const rs = set as { reps: number | null };
    return { ...base, reps: rs.reps };
  }
  if (trackingType === 'duration') {
    const ds = set as { durationSeconds: number | null };
    return { ...base, durationSeconds: ds.durationSeconds };
  }
  const dds = set as { distance: number | null; distanceUnit: 'km' | 'm' | 'mi'; durationSeconds: number | null };
  return { ...base, distance: dds.distance, distanceUnit: dds.distanceUnit, durationSeconds: dds.durationSeconds };
}
