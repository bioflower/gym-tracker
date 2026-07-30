import { useState } from 'react';
import type { ActiveExercise, ExerciseSet } from '../types/gym';
import { ExerciseSetRow } from './ExerciseSetRow';

interface ExerciseCardProps {
  exercise: ActiveExercise;
  onUpdateSet: (setId: string, updates: Partial<ExerciseSet>) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
}

export function ExerciseCard({ exercise, onUpdateSet, onAddSet, onRemoveSet }: ExerciseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const allSetsDone = exercise.sets.length > 0 && exercise.sets.every(s => s.completed);

  const categoryLabels: Record<string, string> = {
    'lower-body': 'Lower Body', chest: 'Chest', back: 'Back',
    shoulders: 'Shoulders', arms: 'Arms', core: 'Core', cardio: 'Cardio', other: 'Other',
  };

  return (
    <div className={`exercise-card ${allSetsDone ? 'completed' : ''}`}>
      <div className="exercise-card-header" onClick={() => setExpanded(!expanded)}>
        <div>
          <h3 className="exercise-name">{exercise.exerciseName}</h3>
          <span className="exercise-meta">{trackingLabel(exercise.trackingType)}</span>
        </div>
        <div className="exercise-status">
          {allSetsDone ? (
            <span className="badge badge-success">Done</span>
          ) : exercise.sets.some(s => s.startedAt) ? (
            <span className="badge badge-active">In Progress</span>
          ) : (
            <span className="badge badge-pending">Not Started</span>
          )}
        </div>
      </div>
      {expanded && (
        <div className="exercise-card-body">
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
