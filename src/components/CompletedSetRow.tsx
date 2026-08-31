import { useState } from 'react';
import type { ExerciseSet, TrackingType, WeightRepSet, RepsOnlySet, DurationSet, DistanceDurationSet } from '../types/gym';

interface CompletedSetRowProps {
  set: ExerciseSet;
  trackingType: TrackingType;
  setIndex: number;
  onUpdate: (setId: string, updates: Partial<ExerciseSet>) => void;
  onRemove: (setId: string) => void;
}

export function CompletedSetRow({ set, trackingType, setIndex, onUpdate, onRemove }: CompletedSetRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="completed-set-row">
      <button
        type="button"
        className="completed-set-summary"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="set-label">Set {setIndex + 1}</span>
        <span className="set-summary-text">{summarizeSet(set, trackingType)}</span>
      </button>
      {expanded && (
        <div className="completed-set-edit">
          {trackingType === 'weight-reps' && renderWeightRepsEdit(set as WeightRepSet, onUpdate)}
          {trackingType === 'reps' && renderRepsEdit(set as RepsOnlySet, onUpdate)}
          {trackingType === 'duration' && renderDurationEdit(set as DurationSet, onUpdate)}
          {trackingType === 'distance-duration' && renderDistanceDurationEdit(set as DistanceDurationSet, onUpdate)}
          <button
            className="btn btn-small btn-danger-outline"
            onClick={() => onRemove(set.id)}
            aria-label={`Remove set ${setIndex + 1}`}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export function summarizeSet(set: ExerciseSet, trackingType: TrackingType): string {
  if (trackingType === 'weight-reps') {
    const s = set as WeightRepSet;
    return `${s.weight ?? '--'} ${s.weightUnit} × ${s.reps ?? '--'} reps`;
  }
  if (trackingType === 'reps') {
    const s = set as RepsOnlySet;
    return `${s.reps ?? '--'} reps`;
  }
  if (trackingType === 'duration') {
    const s = set as DurationSet;
    return `${s.durationSeconds ?? 0}s`;
  }
  const s = set as DistanceDurationSet;
  return `${s.distance ?? '--'} ${s.distanceUnit} in ${s.durationSeconds ?? 0}s`;
}

function renderWeightRepsEdit(set: WeightRepSet, onUpdate: (id: string, u: Partial<ExerciseSet>) => void) {
  return (
    <>
      <div className="set-input-group">
        <label htmlFor={`weight-${set.id}`} className="sr-only">Weight</label>
        <input
          id={`weight-${set.id}`} className="input input-small" type="number" min="0" step="0.5"
          value={set.weight ?? ''}
          onChange={e => onUpdate(set.id, { weight: e.target.value ? parseFloat(e.target.value) : null })}
        />
        <select
          className="input input-small input-unit" value={set.weightUnit}
          onChange={e => onUpdate(set.id, { weightUnit: e.target.value as 'kg' | 'lb' })}
          aria-label="Weight unit"
        >
          <option value="kg">kg</option><option value="lb">lb</option>
        </select>
      </div>
      <div className="set-input-group">
        <label htmlFor={`reps-${set.id}`} className="sr-only">Reps</label>
        <input
          id={`reps-${set.id}`} className="input input-small" type="number" min="0" step="1"
          value={set.reps ?? ''}
          onChange={e => onUpdate(set.id, { reps: e.target.value ? parseInt(e.target.value, 10) : null })}
        />
      </div>
    </>
  );
}

function renderRepsEdit(set: RepsOnlySet, onUpdate: (id: string, u: Partial<ExerciseSet>) => void) {
  return (
    <div className="set-input-group">
      <label htmlFor={`reps-${set.id}`} className="sr-only">Reps</label>
      <input
        id={`reps-${set.id}`} className="input input-small" type="number" min="0" step="1"
        value={set.reps ?? ''}
        onChange={e => onUpdate(set.id, { reps: e.target.value ? parseInt(e.target.value, 10) : null })}
      />
    </div>
  );
}

function renderDurationEdit(set: DurationSet, onUpdate: (id: string, u: Partial<ExerciseSet>) => void) {
  return (
    <div className="set-input-group">
      <label htmlFor={`duration-${set.id}`} className="sr-only">Duration (seconds)</label>
      <input
        id={`duration-${set.id}`} className="input input-small" type="number" min="0" step="1"
        value={set.durationSeconds ?? ''}
        onChange={e => onUpdate(set.id, { durationSeconds: e.target.value ? parseInt(e.target.value, 10) : null })}
      />
    </div>
  );
}

function renderDistanceDurationEdit(set: DistanceDurationSet, onUpdate: (id: string, u: Partial<ExerciseSet>) => void) {
  return (
    <>
      <div className="set-input-group">
        <label htmlFor={`dist-${set.id}`} className="sr-only">Distance</label>
        <input
          id={`dist-${set.id}`} className="input input-small" type="number" min="0" step="0.1"
          value={set.distance ?? ''}
          onChange={e => onUpdate(set.id, { distance: e.target.value ? parseFloat(e.target.value) : null })}
        />
        <select
          className="input input-small input-unit" value={set.distanceUnit}
          onChange={e => onUpdate(set.id, { distanceUnit: e.target.value as 'km' | 'm' | 'mi' })}
          aria-label="Distance unit"
        >
          <option value="km">km</option><option value="m">m</option><option value="mi">mi</option>
        </select>
      </div>
      <div className="set-input-group">
        <label htmlFor={`dur-${set.id}`} className="sr-only">Duration (seconds)</label>
        <input
          id={`dur-${set.id}`} className="input input-small" type="number" min="0" step="1"
          value={set.durationSeconds ?? ''}
          onChange={e => onUpdate(set.id, { durationSeconds: e.target.value ? parseInt(e.target.value, 10) : null })}
        />
      </div>
    </>
  );
}
