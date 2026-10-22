export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isDuplicateName(
  newName: string,
  existingNames: string[],
  currentId?: string
): boolean {
  const normalized = normalizeName(newName);
  return existingNames.some((name, index) => {
    if (currentId !== undefined && index === existingNames.indexOf(name)) {
      return false;
    }
    return normalizeName(name) === normalized;
  });
}

export function validateExerciseName(name: string, existingNames: string[], currentId?: string): string | null {
  if (!name.trim()) return 'Exercise name is required.';
  if (isDuplicateName(name, existingNames, currentId)) return 'An exercise with this name already exists.';
  return null;
}

export function validateWorkoutDayName(name: string): string | null {
  if (!name.trim()) return 'Workout name is required.';
  return null;
}

export function validateWeight(value: number | null): string | null {
  if (value === null) return null;
  if (value < 0) return 'Weight cannot be negative.';
  return null;
}

export function validateReps(value: number | null): string | null {
  if (value === null) return null;
  if (value < 0) return 'Reps cannot be negative.';
  if (value === 0) return 'Reps must be at least 1.';
  return null;
}

export function validateDuration(value: number | null): string | null {
  if (value === null) return null;
  if (value < 0) return 'Duration cannot be negative.';
  return null;
}

export function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Backend workout_day is a UUID FK; the local default plan uses slugs like "workout-a". */
export function uuidOrNull(id: string): string | null {
  return UUID_RE.test(id) ? id : null;
}
