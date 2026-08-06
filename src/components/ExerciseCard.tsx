import { useState } from 'react';
import type { ActiveExercise, ExerciseSet, WorkoutSession } from '../types/gym';
import { ExerciseSetRow } from './ExerciseSetRow';
import { findMostRecentExerciseResult } from '../utils/exerciseHistory';

interface ExerciseCardProps {
  exercise: ActiveExercise;
  workoutHistory: WorkoutSession[];
  onStart: () => void;
  onComplete: () => void;
  onUpdateSet: (setId: string, updates: Partial<ExerciseSet>) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
}

export function ExerciseCard({ exercise, workoutHistory, onStart, onComplete, onUpdateSet, onAddSet, onRemoveSet }: ExerciseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const previousResult = findMostRecentExerciseResult(workoutHistory, exercise.exerciseId);

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
            {exercise.sets.map((set, i) => (
              <ExerciseSetRow
                key={set.id}
                set={set}
                trackingType={exercise.trackingType}
                onUpdate={onUpdateSet}
                onRemove={onRemoveSet}
                setIndex={i}
              />
            ))}
          </div>
          <button className="btn btn-small btn-outline" onClick={onAddSet}>+ Add Set</button>
          <div className="exercise-card-actions">
            {!exercise.startedAt && !exercise.completed && (
              <button className="btn btn-primary" onClick={onStart}>Start Exercise</button>
            )}
            {exercise.startedAt && !exercise.completed && (
              <button className="btn btn-success" onClick={onComplete}>Complete Exercise</button>
            )}
          </div>
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