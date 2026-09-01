import { useEffect, useRef } from 'react';
import type { WorkoutDay } from '../types/gym';
import { useGymTracker } from '../hooks/useGymTracker';

interface WorkoutCompletionModalProps {
  nextWorkout: WorkoutDay | null;
  allComplete: boolean;
  incompleteCount: number;
  onFinishAnyway: () => void;
  onReturn: () => void;
  onClose: () => void;
}

export function WorkoutCompletionModal({
  nextWorkout,
  allComplete,
  incompleteCount,
  onFinishAnyway,
  onReturn,
  onClose,
}: WorkoutCompletionModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const { getAllExercises } = useGymTracker();
  const allExercises = getAllExercises();

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Workout completion">
      <div className="modal">
        {!allComplete ? (
          <>
            <h2>{incompleteCount} exercise{incompleteCount > 1 ? 's' : ''} not completed</h2>
            <p>You haven&apos;t finished all exercises. What would you like to do?</p>
            <div className="modal-actions">
              <button className="btn btn-primary" ref={closeRef} onClick={onFinishAnyway}>
                Finish Anyway
              </button>
              <button className="btn btn-secondary" onClick={onReturn}>
                Go Back
              </button>
            </div>
          </>
        ) : nextWorkout ? (
          <>
            <h2>Workout Completed</h2>
            <p className="next-workout-label">Next workout: {nextWorkout.name}</p>
            <ul className="next-workout-list">
              {nextWorkout.exercises.map(ex => {
                const def = allExercises.find(e => e.id === ex.exercise);
                return <li key={ex.id}>{def?.name ?? 'Unknown'}</li>;
              })}
            </ul>
            <div className="modal-actions">
              <button className="btn btn-primary" ref={closeRef} onClick={onClose}>
                View Next Workout
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>Workout Completed</h2>
            <p>No more workouts in the plan.</p>
            <div className="modal-actions">
              <button className="btn btn-primary" ref={closeRef} onClick={onClose}>
                OK
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
