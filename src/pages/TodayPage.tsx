import { useGymTracker } from '../hooks/useGymTracker';
import { WorkoutHeader } from '../components/WorkoutHeader';
import { ExerciseCard } from '../components/ExerciseCard';
import { WorkoutCompletionModal } from '../components/WorkoutCompletionModal';
import { useState } from 'react';

export function TodayPage() {
  const {
    data, startWorkout, getCurrentWorkoutDay,
    finishWorkout, skipWorkout, startExercise,
    completeExercise, updateSet, addSet, removeSet,
    getNextWorkout,
  } = useGymTracker();
  const [showModal, setShowModal] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  const workout = getCurrentWorkoutDay();
  const active = data.activeWorkout;

  if (!workout) {
    return <div className="today-page"><p>No workouts defined. Go to Plan to add one.</p></div>;
  }

  if (!active) {
    return (
      <div className="today-page">
        <div className="workout-preview">
          <h1>{workout.name}</h1>
          <p>{workout.exercises.length} exercises</p>
          <button className="btn btn-primary btn-large" onClick={startWorkout}>
            Start Workout
          </button>
        </div>
      </div>
    );
  }

  const incompleteExercises = active.exercises.filter(e => !e.completed);
  const allComplete = incompleteExercises.length === 0;

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
            onStart={() => startExercise(exercise.id)}
            onComplete={() => completeExercise(exercise.id)}
            onUpdateSet={(setId, updates) => updateSet(exercise.id, setId, updates)}
            onAddSet={() => addSet(exercise.id)}
            onRemoveSet={(setId) => removeSet(exercise.id, setId)}
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
