import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import type { ExerciseSet, TrackingType, WeightRepSet, WeightUnit, RepsOnlySet, DistanceDurationSet } from '../types/gym';
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
  const stopPending = useRef(false);
  useEffect(() => { stopPending.current = false; }, [set?.id, set?.startedAt, mode]);

  if (mode === 'idle' || !set) {
    return (
      <div className="current-set-card">
        <span className="set-label">Set {setIndex + 1}</span>
        <button type="button" className="btn btn-primary btn-small" onClick={onStart}>Start</button>
      </div>
    );
  }

  if (mode === 'active') {
    const validStart = hasValidStart(set.startedAt);
    const needsDuration = trackingType === 'duration' || trackingType === 'distance-duration';
    return (
      <div className="current-set-card">
        <span className="set-label">Set {setIndex + 1}</span>
        {validStart && set.startedAt && <LiveTimer startAt={set.startedAt} />}
        {needsDuration && !validStart && <span role="alert">Cannot stop timing: the start time is missing or invalid.</span>}
        <button type="button" className="btn btn-primary btn-small stop-button"
          disabled={set.completed || !!set.completedAt || (needsDuration && !validStart)}
          onClick={() => {
            if (stopPending.current) return;
            stopPending.current = handleStop(set, trackingType, onUpdate);
          }}>
          {BUTTON_LABELS.STOP_SET}
        </button>
      </div>
    );
  }

  return (
    <div className="current-set-card">
      <span className="set-label">Set {setIndex + 1}</span>
      {trackingType === 'weight-reps' && 'weightUnit' in set && <WeightRepsInput key={set.id} set={set} defaultWeight={defaultWeight} defaultWeightUnit={defaultWeightUnit} onUpdate={onUpdate} />}
      {trackingType === 'reps' && 'reps' in set && <RepsInput key={set.id} set={set} onUpdate={onUpdate} />}
      {trackingType === 'distance-duration' && 'distanceUnit' in set && <DistanceInput key={set.id} set={set} onUpdate={onUpdate} />}
    </div>
  );
}

function hasValidStart(startedAt: string | null): boolean {
  return startedAt != null && Number.isFinite(Date.parse(startedAt)) && Date.parse(startedAt) <= Date.now();
}

function handleStop(set: ExerciseSet, trackingType: TrackingType, onUpdate: (id: string, u: Partial<ExerciseSet>) => void): boolean {
  if (set.completed || set.completedAt) return false;
  const now = new Date().toISOString();
  if (trackingType === 'duration' || trackingType === 'distance-duration') {
    if (!set.startedAt || !hasValidStart(set.startedAt)) return false;
    const durationSeconds = diffSeconds(set.startedAt, now);
    onUpdate(set.id, {
      completedAt: now, durationSeconds,
      ...(trackingType === 'duration' ? { completed: true } : {}),
    });
  } else {
    onUpdate(set.id, { completedAt: now });
  }
  return true;
}

function isValidNumber(value: number | null, integer = false): boolean {
  return value === null || (Number.isFinite(value) && value >= 0 && (!integer || Number.isSafeInteger(value)));
}

function useNumericDraft(value: number | null | undefined, onChange: (value: number | null) => void, integer = false) {
  const source = value ?? null;
  const [state, setState] = useState({ source, draft: String(source ?? ''), badInput: false });
  let current = state;
  if (!Object.is(state.source, source)) {
    // Preserve formatting on our own update's acknowledgement; replace drafts on external changes.
    const acknowledged = !state.badInput && Object.is(state.draft === '' ? null : Number(state.draft), source);
    current = { source, draft: acknowledged ? state.draft : String(source ?? ''), badInput: false };
    setState(current);
  }
  const number = current.draft === '' ? null : Number(current.draft);
  const valid = !current.badInput && isValidNumber(number, integer);
  return {
    number, valid,
    input: {
      value: current.draft,
      'aria-invalid': !valid,
      onChange: (e: ChangeEvent<HTMLInputElement>) => {
        const draft = e.currentTarget.value;
        const badInput = e.currentTarget.validity.badInput;
        setState({ source, draft, badInput });
        const next = draft === '' ? null : Number(draft);
        if (!badInput && isValidNumber(next, integer) && (next === null || !Object.is(next, source))) onChange(next);
      },
    },
  };
}

function useSetCompletion(set: ExerciseSet, onUpdate: SetInProgressProps['onUpdate'], valid: boolean, updates: Partial<ExerciseSet>) {
  const pending = useRef(false);
  useEffect(() => { if (!set.completed) pending.current = false; }, [set.completed]);
  const complete = () => {
    if (!valid || set.completed || pending.current) return;
    pending.current = true;
    onUpdate(set.id, { ...updates, completed: true });
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (!e.repeat && !e.nativeEvent.isComposing) complete();
  };
  return { complete, onKeyDown, disabled: !valid || set.completed };
}

function WeightRepsInput({
  set, defaultWeight, defaultWeightUnit, onUpdate,
}: {
  set: WeightRepSet;
  defaultWeight: number | null;
  defaultWeightUnit: WeightUnit;
  onUpdate: (id: string, u: Partial<ExerciseSet>) => void;
}) {
  const useDefault = set.weight == null && !set.weightCleared;
  const weightValue = (useDefault ? defaultWeight : set.weight) ?? null;
  const weightUnit = set.weight != null || set.weightCleared ? set.weightUnit : defaultWeightUnit;
  const weight = useNumericDraft(weightValue, value => onUpdate(set.id, {
    weight: value, weightCleared: value === null,
    ...(useDefault ? { weightUnit } : {}),
  }));
  const reps = useNumericDraft(set.reps, value => onUpdate(set.id, { reps: value }), true);
  const completion = useSetCompletion(set, onUpdate, weight.valid && reps.valid && reps.number !== null, {
    reps: reps.number,
    ...(useDefault ? { weight: weight.number, weightUnit } : {}),
  });
  return (
    <>
      <div className="set-input-group">
        <label htmlFor={`weight-${set.id}`} className="sr-only">Weight</label>
        <input
          id={`weight-${set.id}`} className="input input-small" type="number" min="0" step="any" placeholder="Weight"
          {...weight.input} onKeyDown={completion.onKeyDown}
        />
        <select
          className="input input-small input-unit" value={weightUnit}
          disabled={!isValidNumber(weightValue)}
          onChange={e => {
            const unit = e.target.value;
            if (unit !== 'kg' && unit !== 'lb') return;
            onUpdate(set.id, {
              weightUnit: unit,
              ...(useDefault ? { weight: weightValue, weightCleared: weightValue === null } : {}),
            });
          }}
          aria-label="Weight unit"
        >
          <option value="kg">kg</option><option value="lb">lb</option>
        </select>
      </div>
      <div className="set-input-group">
        <label htmlFor={`reps-${set.id}`} className="sr-only">Reps</label>
        <input
          id={`reps-${set.id}`} className="input input-small" type="number" min="0" step="1" placeholder="Reps" autoFocus
          {...reps.input} onKeyDown={completion.onKeyDown}
        />
      </div>
      <button type="button" className="btn btn-primary btn-small" disabled={completion.disabled} onClick={completion.complete}>Complete Set</button>
    </>
  );
}

function RepsInput({ set, onUpdate }: { set: RepsOnlySet; onUpdate: SetInProgressProps['onUpdate'] }) {
  const reps = useNumericDraft(set.reps, value => onUpdate(set.id, { reps: value }), true);
  const completion = useSetCompletion(set, onUpdate, reps.valid && reps.number !== null, { reps: reps.number });
  return (
    <>
      <div className="set-input-group">
        <label htmlFor={`reps-${set.id}`} className="sr-only">Reps</label>
        <input
          id={`reps-${set.id}`} className="input input-small" type="number" min="0" step="1" placeholder="Reps" autoFocus
          {...reps.input} onKeyDown={completion.onKeyDown}
        />
      </div>
      <button type="button" className="btn btn-primary btn-small" disabled={completion.disabled} onClick={completion.complete}>Complete Set</button>
    </>
  );
}

function DistanceInput({ set, onUpdate }: { set: DistanceDurationSet; onUpdate: SetInProgressProps['onUpdate'] }) {
  const distance = useNumericDraft(set.distance, value => onUpdate(set.id, { distance: value }));
  const validDuration = set.durationSeconds != null && Number.isFinite(set.durationSeconds) && set.durationSeconds >= 0;
  const completion = useSetCompletion(set, onUpdate, distance.valid && distance.number !== null && validDuration, { distance: distance.number });
  return (
    <>
      <div className="set-input-group">
        <label htmlFor={`dist-${set.id}`} className="sr-only">Distance</label>
        <input
          id={`dist-${set.id}`} className="input input-small" type="number" min="0" step="any" placeholder="Distance" autoFocus
          {...distance.input} onKeyDown={completion.onKeyDown}
        />
        <select
          className="input input-small input-unit" value={set.distanceUnit}
          onChange={e => {
            const unit = e.target.value;
            if (unit === 'km' || unit === 'm' || unit === 'mi') onUpdate(set.id, { distanceUnit: unit });
          }}
          aria-label="Distance unit"
        >
          <option value="km">km</option><option value="m">m</option><option value="mi">mi</option>
        </select>
      </div>
      <button type="button" className="btn btn-primary btn-small" disabled={completion.disabled} onClick={completion.complete}>Complete Set</button>
    </>
  );
}
