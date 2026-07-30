import type { ExerciseSet, TrackingType, WeightRepSet, RepsOnlySet, DurationSet, DistanceDurationSet } from '../types/gym';

interface ExerciseSetRowProps {
  set: ExerciseSet;
  trackingType: TrackingType;
  onUpdate: (setId: string, updates: Partial<ExerciseSet>) => void;
  onRemove: (setId: string) => void;
  setIndex: number;
}

export function ExerciseSetRow({ set, trackingType, onUpdate, onRemove, setIndex }: ExerciseSetRowProps) {
  function handleToggleDone() {
    const now = new Date().toISOString();
    if (set.completed) {
      onUpdate(set.id, { completed: false, completedAt: null });
    } else {
      onUpdate(set.id, {
        completed: true,
        completedAt: now,
        startedAt: set.startedAt || now,
      });
    }
  }

  function handleStart() {
    onUpdate(set.id, { startedAt: new Date().toISOString() });
  }

  return (
    <div className={`set-row ${set.completed ? 'completed' : ''}`}>
      <span className="set-label">Set {setIndex + 1}</span>
      {trackingType === 'weight-reps' && renderWeightReps(set as WeightRepSet, onUpdate)}
      {trackingType === 'reps' && renderRepsOnly(set as RepsOnlySet, onUpdate)}
      {trackingType === 'duration' && renderDuration(set as DurationSet, onUpdate)}
      {trackingType === 'distance-duration' && renderDistanceDuration(set as DistanceDurationSet, onUpdate)}
      <div className="set-actions">
        {!set.startedAt && !set.completed && (
          <button className="btn btn-small btn-primary" onClick={handleStart}>Start</button>
        )}
        {(set.startedAt || set.completed) && (
          <button className={`btn btn-small ${set.completed ? 'btn-success' : 'btn-outline'}`} onClick={handleToggleDone}>
            {set.completed ? 'Done' : 'Mark Done'}
          </button>
        )}
        <button className="btn btn-small btn-danger-outline" onClick={() => onRemove(set.id)} aria-label={`Remove set ${setIndex + 1}`}>✕</button>
      </div>
    </div>
  );
}

function renderWeightReps(set: WeightRepSet, onUpdate: (id: string, u: Partial<ExerciseSet>) => void) {
  return (
    <>
      <div className="set-input-group">
        <label htmlFor={`weight-${set.id}`} className="sr-only">Weight</label>
        <input id={`weight-${set.id}`} className="input input-small" type="number" min="0" step="0.5" placeholder="Weight"
          value={set.weight ?? ''}
          onChange={e => onUpdate(set.id, { weight: e.target.value ? parseFloat(e.target.value) : null })} />
        <select className="input input-small input-unit" value={set.weightUnit}
          onChange={e => onUpdate(set.id, { weightUnit: e.target.value as 'kg' | 'lb' })}
          aria-label="Weight unit">
          <option value="kg">kg</option><option value="lb">lb</option>
        </select>
      </div>
      <div className="set-input-group">
        <label htmlFor={`reps-${set.id}`} className="sr-only">Reps</label>
        <input id={`reps-${set.id}`} className="input input-small" type="number" min="0" step="1" placeholder="Reps"
          value={set.reps ?? ''}
          onChange={e => onUpdate(set.id, { reps: e.target.value ? parseInt(e.target.value, 10) : null })} />
      </div>
    </>
  );
}

function renderRepsOnly(set: RepsOnlySet, onUpdate: (id: string, u: Partial<ExerciseSet>) => void) {
  return (
    <div className="set-input-group">
      <label htmlFor={`reps-${set.id}`} className="sr-only">Reps</label>
      <input id={`reps-${set.id}`} className="input input-small" type="number" min="0" step="1" placeholder="Reps"
        value={set.reps ?? ''}
        onChange={e => onUpdate(set.id, { reps: e.target.value ? parseInt(e.target.value, 10) : null })} />
    </div>
  );
}

function renderDuration(set: DurationSet, onUpdate: (id: string, u: Partial<ExerciseSet>) => void) {
  return (
    <div className="set-input-group">
      <label htmlFor={`duration-${set.id}`} className="sr-only">Duration (seconds)</label>
      <input id={`duration-${set.id}`} className="input input-small" type="number" min="0" step="1" placeholder="Seconds"
        value={set.durationSeconds ?? ''}
        onChange={e => onUpdate(set.id, { durationSeconds: e.target.value ? parseInt(e.target.value, 10) : null })} />
    </div>
  );
}

function renderDistanceDuration(set: DistanceDurationSet, onUpdate: (id: string, u: Partial<ExerciseSet>) => void) {
  return (
    <>
      <div className="set-input-group">
        <label htmlFor={`dist-${set.id}`} className="sr-only">Distance</label>
        <input id={`dist-${set.id}`} className="input input-small" type="number" min="0" step="0.1" placeholder="Distance"
          value={set.distance ?? ''}
          onChange={e => onUpdate(set.id, { distance: e.target.value ? parseFloat(e.target.value) : null })} />
        <select className="input input-small input-unit" value={set.distanceUnit}
          onChange={e => onUpdate(set.id, { distanceUnit: e.target.value as 'km' | 'm' | 'mi' })}
          aria-label="Distance unit">
          <option value="km">km</option><option value="m">m</option><option value="mi">mi</option>
        </select>
      </div>
      <div className="set-input-group">
        <label htmlFor={`dur-${set.id}`} className="sr-only">Duration (seconds)</label>
        <input id={`dur-${set.id}`} className="input input-small" type="number" min="0" step="1" placeholder="Seconds"
          value={set.durationSeconds ?? ''}
          onChange={e => onUpdate(set.id, { durationSeconds: e.target.value ? parseInt(e.target.value, 10) : null })} />
      </div>
    </>
  );
}
