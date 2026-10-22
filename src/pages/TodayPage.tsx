import { useGymTracker } from '../hooks/useGymTracker';
import { WorkoutHeader } from '../components/WorkoutHeader';
import { ExerciseCard } from '../components/ExerciseCard';
import { WorkoutCompletionModal } from '../components/WorkoutCompletionModal';
import { useState } from 'react';
import { findMostRecentExerciseResult } from '../utils/exerciseHistory';
import { suggestSet, formatSuggestion } from '../utils/progression';
import { getTodayISO } from '../utils/dateTime';

export function TodayPage() {
  const {
    data, startWorkout, getCurrentWorkoutDay,
    finishWorkout, skipWorkout, setExerciseDone,
    updateSet, addSet, removeSet, swapExerciseForToday,
    getAllExercises, getNextWorkout,
  } = useGymTracker();
  const [showModal, setShowModal] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  const workout = getCurrentWorkoutDay();
  const active = data.activeWorkout;

  if (!workout) {
    return <div className="today-page"><p>No workouts defined. Go to Plan to add one.</p></div>;
  }

  if (!active) {
    const doneToday = data.workoutHistory.some(s => s.status === 'completed' && s.date === getTodayISO());
    return (
      <div className="today-page">
        <div className="workout-preview">
          {doneToday && <h1>Today&apos;s workout is done 🎉</h1>}
          {doneToday ? <h2>Next workout - {workout.name}</h2> : <h1>{workout.name}</h1>}
          <p>{workout.exercises.length} exercises</p>
          <ul className="next-workout-list">
            {workout.exercises.map(ex => {
              const def = getAllExercises().find(e => e.id === ex.exercise);
              const last = def ? findMostRecentExerciseResult(data.workoutHistory, def.id, def.name) : null;
              const text = def && formatSuggestion(def.trackingType, suggestSet(def.trackingType, last?.sets[0] ?? null, true));
              return <li key={ex.id}>{def?.name ?? 'Unknown'}{text && `: ${text}`}</li>;
            })}
          </ul>
          <button className="btn btn-primary btn-large" onClick={startWorkout}>
            Start Workout
          </button>
        </div>
      </div>
    );
  }

  const incompleteExercises = active.exercises.filter(e => !e.completed);
  const allComplete = incompleteExercises.length === 0;
  const allExercises = getAllExercises();

  function handleFinish() {
    if (!allComplete) {
      setShowModal(true);
      return;
    }
    finishWorkout();
    setShowModal(true);
  }

  function handleFinishAnyway() {
    setShowModal(false);
    finishWorkout();
    setShowModal(true);
  }

  function handleSkip() {
    skipWorkout();
    setShowSkipConfirm(false);
  }

  return (
    <div className="today-page">
      <WorkoutHeader activeWorkout={active} />
      <div className="exercise-list">
        {active.exercises.map(exercise => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            workoutHistory={data.workoutHistory}
            allExercises={allExercises}
            onSetDone={(done) => setExerciseDone(exercise.id, done)}
            onUpdateSet={(setId, updates) => updateSet(exercise.id, setId, updates)}
            onAddSet={() => addSet(exercise.id)}
            onRemoveSet={(setId) => removeSet(exercise.id, setId)}
            onSwapExercise={(newExerciseId) => swapExerciseForToday(exercise.id, newExerciseId)}
          />
        ))}
      </div>
      <div className="workout-actions">
        <button className="btn btn-primary btn-large" onClick={handleFinish}>
          Finish Workout
        </button>
        <button className="btn btn-secondary" onClick={() => setShowSkipConfirm(true)}>
          Skip Workout
        </button>
      </div>
      {showSkipConfirm && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Skip workout confirmation">
          <div className="modal">
            <p>Skip {active.workoutName}? No exercise records will be saved.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowSkipConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleSkip}>Skip Workout</button>
            </div>
          </div>
        </div>
      )}
      {showModal && (
        <WorkoutCompletionModal
          nextWorkout={getNextWorkout()}
          allComplete={allComplete}
          incompleteCount={incompleteExercises.length}
          onFinishAnyway={handleFinishAnyway}
          onReturn={() => setShowModal(false)}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
