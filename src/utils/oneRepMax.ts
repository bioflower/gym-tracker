import type { WorkoutSession } from '../types/gym';

export interface OneRepMaxPoint { date: string; value: number }

const LB_PER_KG = 2.20462;

// Epley estimate; a single rep is the weight itself.
export function estimateOneRepMax(weight: number, reps: number): number {
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

// Best estimated 1RM per session date for one exercise, converted to `unit`.
export function getOneRepMaxSeries(history: WorkoutSession[], exerciseId: string, unit: 'kg' | 'lb'): OneRepMaxPoint[] {
  const best = new Map<string, number>();
  for (const s of history) {
    if (s.status !== 'completed') continue;
    for (const ex of s.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const set of ex.sets) {
        if (set.type !== 'weight-reps' || set.completed === false || !set.weight || !set.reps) continue;
        const w = (set.weightUnit ?? 'kg') === unit ? set.weight : unit === 'kg' ? set.weight / LB_PER_KG : set.weight * LB_PER_KG;
        best.set(s.date, Math.max(best.get(s.date) ?? 0, estimateOneRepMax(w, set.reps)));
      }
    }
  }
  return [...best].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
}
