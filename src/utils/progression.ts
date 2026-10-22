import type { WeightUnit } from '../types/gym';

export const MAX_REPS = 12;
const WEIGHT_STEP: Record<WeightUnit, number> = { kg: 2.5, lb: 5 };

export const TARGET_REPS_AFTER_BUMP = 8;

// Epley: 1RM = w * (1 + reps / 30). At MAX_REPS, keep the 1RM and solve for the weight at 8 reps, rounded to the plate step.
export function nextWeightReps(weight: number | null, unit: WeightUnit, reps: number): { weight: number | null; reps: number } {
  if (weight == null || reps < MAX_REPS) return { weight, reps: reps + 1 };
  const oneRepMax = weight * (1 + reps / 30);
  const step = WEIGHT_STEP[unit];
  const nextWeight = Math.round(oneRepMax / (1 + TARGET_REPS_AFTER_BUMP / 30) / step) * step;
  return { weight: Math.max(nextWeight, weight + step), reps: TARGET_REPS_AFTER_BUMP };
}

export interface Suggestion { weight: number | null; unit: WeightUnit; reps: number | null }

// source: last time's first set (progress = true) or today's completed first set (progress = false).
export function suggestSet(trackingType: string, source: Partial<{ weight: number | null; weightUnit: WeightUnit | null; reps: number | null }> | null, progress: boolean): Suggestion {
  const isWeight = trackingType === 'weight-reps';
  const unit = isWeight ? (source?.weightUnit ?? 'kg') : 'kg';
  let weight = isWeight ? (source?.weight ?? null) : null;
  let reps = isWeight || trackingType === 'reps' ? source?.reps ?? null : null;
  if (progress && reps != null) {
    if (isWeight) ({ weight, reps } = nextWeightReps(weight, unit, reps));
    else reps += 1;
  }
  return { weight, unit, reps };
}

export function formatSuggestion(trackingType: string, s: Suggestion): string | null {
  if (s.reps == null) return null;
  return trackingType === 'weight-reps' && s.weight != null ? `${s.weight} ${s.unit} × ${s.reps}` : `${s.reps} reps`;
}
