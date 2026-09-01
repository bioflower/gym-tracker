import { useState } from 'react';
import type { ActiveExercise, Exercise, ExerciseSet, WorkoutSession } from '../types/gym';
import { CompletedSetRow } from './CompletedSetRow';
import { SetInProgress } from './SetInProgress';
import { RestTimer } from './RestTimer';
import { ExerciseSwapControl } from './ExerciseSwapControl';
import { findMostRecentExerciseResult } from '../utils/exerciseHistory';
import { BUTTON_LABELS } from '../constants/workout';

interface ExerciseCardProps {
  exercise: ActiveExercise;
  workoutHistory: WorkoutSession[];
  allExercises: Exercise[];
  onSetDone: (done: boolean) => void;
  onUpdateSet: (setId: string, updates: Partial<ExerciseSet>) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onSwapExercise: (newExerciseId: string) => void;
}

export function ExerciseCard({
  exercise, workoutHistory, allExercises, onSetDone, onUpdateSet, onAddSet, onRemoveSet, onSwapExercise,
}: ExerciseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const previousResult = findMostRecentExerciseResult(workoutHistory, exercise.exerciseId);
  const lastPreviousSet = previousResult?.sets[previousResult.sets.length - 1] ?? null;
  const defaultWeight = lastPreviousSet?.type === 'weight-reps' ? (lastPreviousSet.weight ?? null) : null;
  const defaultWeightUnit = lastPreviousSet?.type === 'weight-reps' ? (lastPreviousSet.weightUnit ?? 'kg') : 'kg';

  const completedSets = exercise.sets.filter(s => s.completed);
  const activeSet = exercise.sets.find(s => !s.completed && s.startedAt) ?? null;
  const lastCompletedSet = completedSets.length > 0 ? completedSets[completedSets.length - 1] : null;

  return (
    <div className={`exercise-card ${exercise.completed ? 'completed' : ''}`}>
      <div className="exercise-card-header" onClick={() => setExpanded(!expanded)}>
        <div>
          <h3 className="exercise-name">{exercise.exerciseName}</h3>
          <span className="exercise-meta">{trackingLabel(exercise.trackingType)}</span>
        </div>
        <div className="exercise-status">
          {exercise.completed ? (
            <span className="badge badge-success">Done</span>
          ) : exercise.startedAt ? (
            <span className="badge badge-active">In Progress</span>
          ) : (
            <span className="badge badge-pending">Not Started</span>
          )}
        </div>
      </div>
      {expanded && (
        <div className="exercise-card-body">
          <ExerciseSwapControl
            currentExerciseId={exercise.exerciseId}
            allExercises={allExercises}
            disabled={exercise.sets.length > 0}
            onSwap={onSwapExercise}
          />
          {previousResult && (
            <div className="previous-result">
              <strong>Last time:</strong>
              {previousResult.sets.map(set => (
                <div key={set.id} className="previous-set">
                  {set.type === 'weight-reps' && `${set.weight} ${set.weightUnit} × ${set.reps}`}
                  {set.type === 'reps' && `${set.reps} reps`}
                  {set.type === 'duration' && `${set.durationSeconds}s`}
                  {set.type === 'distance-duration' && `${set.distance} ${set.distanceUnit} in ${set.durationSeconds}s`}
                </div>
              ))}
            </div>
          )}
          <div className="sets-list">
            {completedSets.map((set, i) => (
              <CompletedSetRow
                key={set.id}
                set={set}
                trackingType={exercise.trackingType}
                setIndex={i}
                onUpdate={onUpdateSet}
                onRemove={onRemoveSet}
              />
            ))}
          </div>
          {exercise.completed ? (
            <button className="btn btn-small btn-outline" onClick={() => onSetDone(false)}>
              {BUTTON_LABELS.RESUME_EXERCISE}
            </button>
          ) : (
            <>
              {activeSet ? (
                <SetInProgress
                  mode={activeSet.completedAt ? 'awaiting-input' : 'active'}
                  set={activeSet}
                  trackingType={exercise.trackingType}
                  setIndex={exercise.sets.findIndex(s => s.id === activeSet.id)}
                  defaultWeight={defaultWeight}
                  defaultWeightUnit={defaultWeightUnit}
                  onStart={onAddSet}
                  onUpdate={onUpdateSet}
                />
              ) : lastCompletedSet ? (
                <>
                  <RestTimer previousCompletedAt={lastCompletedSet.completedAt!} />
                  <div className='exercise-actions'>
                    <button 
                      className='btn btn-primary btn-small'
                      onClick={onAddSet}
                    >
                      {BUTTON_LABELS.START_NEXT_SET}
                    </button>

                    <button
                      className='btn btn-success btn-small'
                      onClick={() => onSetDone(true)}
                    >
                      {BUTTON_LABELS.COMPLETE_EXERCISE}
                    </button>
                  </div>
                </>
              ): (
                <SetInProgress
                  mode="idle"
                  set={null}
                  trackingType={exercise.trackingType}
                  setIndex={0}
                  defaultWeight={defaultWeight}
                  defaultWeightUnit={defaultWeightUnit}
                  onStart={onAddSet}
                  onUpdate={onUpdateSet}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function trackingLabel(type: string): string {
  switch (type) {
    case 'weight-reps': return 'Weight × Reps';
    case 'reps': return 'Reps';
    case 'duration': return 'Duration';
    case 'distance-duration': return 'Distance + Duration';
    default: return '';
  }
}
