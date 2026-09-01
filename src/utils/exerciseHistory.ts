import type { WorkoutSession, CompletedExercise, ActiveExercise, TrackingType, CompletedSet, ExerciseSet } from '../types/gym';

export function findMostRecentExerciseResult(
  history: WorkoutSession[],
  exerciseId: string,
  exerciseName?: string
): CompletedExercise | null {
  // Ensure history is examined newest-first even if caller passed unsorted data.
  // Sort by date descending, then completedAt descending as tiebreaker.
  const sorted = [...history].sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date);
    if (dateCmp !== 0) return dateCmp;
    return (b.completedAt ?? '').localeCompare(a.completedAt ?? '');
  });

  const normalizedName = exerciseName?.toLowerCase().trim() ?? null;

  for (const session of sorted) {
    if (session.status !== 'completed') continue;

    // Primary: exact exerciseId match (handles preset UUIDs correctly)
    const byId = session.exercises.find(e => e.exerciseId === exerciseId);
    if (byId) return byId;

    // Fallback: match by exerciseName (case-insensitive)
    // This covers cases where the same logical exercise has different UUIDs
    // between local import and server (custom exercises created via upload).
    if (normalizedName) {
      const byName = session.exercises.find(
        e => e.exerciseName.toLowerCase().trim() === normalizedName
      );
      if (byName) return byName;
    }
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
  const base: CompletedSet = {
    id: set.id,
    type: trackingType,
    startedAt: set.startedAt,
    completedAt: set.completedAt,
    completed: set.completed,
  };
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
