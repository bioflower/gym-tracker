import { useState } from 'react';
import type { ExerciseSet, TrackingType, WeightRepSet, WeightUnit, RepsOnlySet, DistanceDurationSet, DistanceUnit } from '../types/gym';
import { diffSeconds } from '../utils/dateTime';
import { LiveTimer } from './LiveTimer';
import { BUTTON_LABELS } from '../constants/workout';

interface SetInProgressProps {
  mode: 'idle' | 'active' | 'awaiting-input';
  set: ExerciseSet | null;
  trackingType: TrackingType;
  setIndex: number;
  defaultWeight: number | null;
  defaultWeightUnit: WeightUnit;
  onStart: () => void;
  onUpdate: (setId: string, updates: Partial<ExerciseSet>) => void;
}

export function SetInProgress({
  mode, set, trackingType, setIndex, defaultWeight, defaultWeightUnit, onStart, onUpdate,
}: SetInProgressProps) {
  if (mode === 'idle' || !set) {
    return (
      <div className="current-set-card">
        <span className="set-label">Set {setIndex + 1}</span>
        <button className="btn btn-primary btn-small" onClick={onStart}>Start</button>
      </div>
    );
  }

  if (mode === 'active') {
    return (
      <div className="current-set-card">
        <span className="set-label">Set {setIndex + 1}</span>
        {set.startedAt && <LiveTimer startAt={set.startedAt} />}
        <button className="btn btn-primary btn-small stop-button" onClick={() => handleStop(set, trackingType, onUpdate)}>
          {BUTTON_LABELS.STOP_SET}
        </button>
      </div>
    );
  }

  return (
    <div className="current-set-card">
      <span className="set-label">Set {setIndex + 1}</span>
      {trackingType === 'weight-reps' && <WeightRepsInput set={set as WeightRepSet} defaultWeight={defaultWeight} defaultWeightUnit={defaultWeightUnit} onUpdate={onUpdate} />}
      {trackingType === 'reps' && <RepsInput set={set} onUpdate={onUpdate} />}
      {trackingType === 'distance-duration' && <DistanceInput set={set} onUpdate={onUpdate} />}
    </div>
  );
}

function handleStop(set: ExerciseSet, trackingType: TrackingType, onUpdate: (id: string, u: Partial<ExerciseSet>) => void) {
  const now = new Date().toISOString();
  if (trackingType === 'duration') {
    const durationSeconds = diffSeconds(set.startedAt!, now);
    onUpdate(set.id, { completedAt: now, completed: true, durationSeconds });
  } else if (trackingType === 'distance-duration') {
    const durationSeconds = diffSeconds(set.startedAt!, now);
    onUpdate(set.id, { completedAt: now, durationSeconds });
  } else {
    onUpdate(set.id, { completedAt: now });
  }
}

function WeightRepsInput({
  set, defaultWeight, defaultWeightUnit, onUpdate,
}: {
  set: WeightRepSet;
  defaultWeight: number | null;
  defaultWeightUnit: WeightUnit;
  onUpdate: (id: string, u: Partial<ExerciseSet>) => void;
}) {
  const weightValue = set.weight ?? defaultWeight;
  const weightUnit = set.weight !== null ? set.weightUnit : defaultWeightUnit;
  const [repsDraft, setRepsDraft] = useState(set.reps != null ? String(set.reps) : '');
  return (
    <>
      <div className="set-input-group">
        <label htmlFor={`weight-${set.id}`} className="sr-only">Weight</label>
        <input
          id={`weight-${set.id}`} className="input input-small" type="number" min="0" step="0.5" placeholder="Weight"
          value={weightValue ?? ''}
          onChange={e => onUpdate(set.id, { weight: e.target.value ? parseFloat(e.target.value) : null })}
        />
        <select
          className="input input-small input-unit" value={weightUnit}
          onChange={e => onUpdate(set.id, { weightUnit: e.target.value as WeightUnit })}
          aria-label="Weight unit"
        >
          <option value="kg">kg</option><option value="lb">lb</option>
        </select>
      </div>
      <div className="set-input-group">
        <label htmlFor={`reps-${set.id}`} className="sr-only">Reps</label>
        <input
          id={`reps-${set.id}`} className="input input-small" type="number" min="0" step="1" placeholder="Reps" autoFocus
          value={repsDraft}
          onChange={e => {
            setRepsDraft(e.target.value);
            const reps = e.target.value ? parseInt(e.target.value, 10) : null;
            onUpdate(set.id, { reps, weight: set.weight ?? defaultWeight, weightUnit });
          }}
          onBlur={() => {
            const reps = repsDraft ? parseInt(repsDraft, 10) : null;
            if (reps !== null) onUpdate(set.id, { reps, weight: set.weight ?? defaultWeight, weightUnit });
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const reps = repsDraft ? parseInt(repsDraft, 10) : null;
              if (reps !== null) onUpdate(set.id, { reps, weight: set.weight ?? defaultWeight, weightUnit, completed: true });
            }
          }}
        />
      </div>
    </>
  );
}

function RepsInput({ set, onUpdate }: { set: ExerciseSet; onUpdate: (id: string, u: Partial<ExerciseSet>) => void }) {
  const s = set as RepsOnlySet;
  const [draft, setDraft] = useState(s.reps != null ? String(s.reps) : '');
  return (
    <div className="set-input-group">
      <label htmlFor={`reps-${s.id}`} className="sr-only">Reps</label>
      <input
        id={`reps-${s.id}`} className="input input-small" type="number" min="0" step="1" placeholder="Reps" autoFocus
        value={draft}
        onChange={e => {
          setDraft(e.target.value);
          const reps = e.target.value ? parseInt(e.target.value, 10) : null;
          onUpdate(s.id, { reps });
        }}
        onBlur={() => {
          const reps = draft ? parseInt(draft, 10) : null;
          if (reps !== null) onUpdate(s.id, { reps });
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            const reps = draft ? parseInt(draft, 10) : null;
            if (reps !== null) onUpdate(s.id, { reps, completed: true });
          }
        }}
      />
    </div>
  );
}

function DistanceInput({ set, onUpdate }: { set: ExerciseSet; onUpdate: (id: string, u: Partial<ExerciseSet>) => void }) {
  const s = set as DistanceDurationSet;
  const [draft, setDraft] = useState(s.distance != null ? String(s.distance) : '');
  return (
    <div className="set-input-group">
      <label htmlFor={`dist-${s.id}`} className="sr-only">Distance</label>
      <input
        id={`dist-${s.id}`} className="input input-small" type="number" min="0" step="0.1" placeholder="Distance" autoFocus
        value={draft}
        onChange={e => {
          setDraft(e.target.value);
          const distance = e.target.value ? parseFloat(e.target.value) : null;
          onUpdate(s.id, { distance });
        }}
        onBlur={() => {
          const distance = draft ? parseFloat(draft) : null;
          if (distance !== null) onUpdate(s.id, { distance });
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            const distance = draft ? parseFloat(draft) : null;
            if (distance !== null) onUpdate(s.id, { distance, completed: true });
          }
        }}
      />
      <select
        className="input input-small input-unit" value={s.distanceUnit}
        onChange={e => onUpdate(s.id, { distanceUnit: e.target.value as DistanceUnit })}
        aria-label="Distance unit"
      >
        <option value="km">km</option><option value="m">m</option><option value="mi">mi</option>
      </select>
    </div>
  );
}
