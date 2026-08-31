import type { Exercise } from '../types/gym';

interface ExerciseSwapControlProps {
  currentExerciseId: string;
  allExercises: Exercise[];
  disabled: boolean;
  onSwap: (newExerciseId: string) => void;
}

export function ExerciseSwapControl({ currentExerciseId, allExercises, disabled, onSwap }: ExerciseSwapControlProps) {
  if (disabled) return null;
  return (
    <select
      className="input input-small exercise-swap-select"
      value={currentExerciseId}
      onClick={e => e.stopPropagation()}
      onChange={e => { if (e.target.value !== currentExerciseId) onSwap(e.target.value); }}
      aria-label="Change exercise"
    >
      {allExercises.map(ex => (
        <option key={ex.id} value={ex.id}>{ex.name}</option>
      ))}
    </select>
  );
}
