import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SetInProgress } from '../components/SetInProgress';
import type { DistanceDurationSet, ExerciseSet, RepsOnlySet, TrackingType, WeightRepSet } from '../types/gym';

const timing = {
  id: 'set-1', startedAt: '2026-01-01T00:00:00.000Z',
  completedAt: '2026-01-01T00:00:05.000Z', completed: false,
};
const weightSet: WeightRepSet = { ...timing, weight: null, weightUnit: 'kg', reps: null };
const repsSet: RepsOnlySet = { ...timing, reps: null };
const distanceSet: DistanceDurationSet = { ...timing, distance: null, distanceUnit: 'km', durationSeconds: 5, notes: '' };
const cases: [TrackingType, ExerciseSet, string, Partial<ExerciseSet>][] = [
  ['weight-reps', weightSet, 'Reps', { reps: 12 }],
  ['reps', repsSet, 'Reps', { reps: 12 }],
  ['distance-duration', distanceSet, 'Distance', { distance: 12 }],
];

afterEach(() => vi.useRealTimers());

function inputProps(set: ExerciseSet, trackingType: TrackingType, onUpdate = vi.fn()) {
  return {
    mode: 'awaiting-input' as const, set, trackingType, setIndex: 0,
    defaultWeight: 36, defaultWeightUnit: 'lb' as const,
    onStart: vi.fn(), onUpdate,
  };
}

function Harness({ initialSet, trackingType, defaultWeight = 36 }: { initialSet: ExerciseSet; trackingType: TrackingType; defaultWeight?: number | null }) {
  const [set, setSet] = useState(initialSet);
  const [mounted, setMounted] = useState(true);
  return <>
    {mounted && <SetInProgress {...inputProps(set, trackingType)}
      defaultWeight={defaultWeight}
      onUpdate={(_id, updates) => setSet(previous => ({ ...previous, ...updates }))} />}
    <button onClick={() => setMounted(!mounted)}>Toggle inputs</button>
    <output aria-label="Saved set">{JSON.stringify(set)}</output>
  </>;
}

describe('set result state', () => {
  it.each(cases)('%s resets drafts when the set id changes', (trackingType, set, label, values) => {
    const props = inputProps({ ...set, ...values }, trackingType);
    const view = render(<SetInProgress {...props} />);
    expect(screen.getByLabelText(label)).toHaveValue(12);
    view.rerender(<SetInProgress {...props} set={{ ...set, id: 'set-2' }} />);
    expect(screen.getByLabelText(label)).toHaveValue(null);
  });

  it.each(cases)('%s follows parent changes and resets for the same set', (trackingType, set, label, values) => {
    const props = inputProps(set, trackingType);
    const view = render(<SetInProgress {...props} />);
    view.rerender(<SetInProgress {...props} set={{ ...set, ...values }} />);
    expect(screen.getByLabelText(label)).toHaveValue(12);
    view.rerender(<SetInProgress {...props} set={{ ...set }} />);
    expect(screen.getByLabelText(label)).toHaveValue(null);
  });

  it('follows restored weight and unit rather than overwriting them when reps change', () => {
    const props = inputProps(weightSet, 'weight-reps');
    const view = render(<SetInProgress {...props} />);
    view.rerender(<SetInProgress {...props} set={{ ...weightSet, weight: 20, weightUnit: 'kg' }} />);
    expect(screen.getByLabelText('Weight')).toHaveValue(20);
    expect(screen.getByLabelText('Weight unit')).toHaveValue('kg');
    props.onUpdate.mockClear();
    fireEvent.change(screen.getByLabelText('Reps'), { target: { value: '10' } });
    expect(props.onUpdate).toHaveBeenCalledExactlyOnceWith('set-1', { reps: 10 });
  });

  it('uses the historical unit for restored sets with an undefined weight', () => {
    // Older cached data can lack fields even though the current TypeScript type requires them.
    const restored = JSON.parse(JSON.stringify({ ...weightSet, weight: undefined }));
    render(<SetInProgress {...inputProps(restored, 'weight-reps')} />);
    expect(screen.getByLabelText('Weight')).toHaveValue(36);
    expect(screen.getByLabelText('Weight unit')).toHaveValue('lb');
    expect(screen.getByLabelText('Reps')).toHaveValue(null);
  });

  it('preserves a cleared weight and selected unit across remounts and completion', async () => {
    const user = userEvent.setup();
    render(<Harness initialSet={weightSet} trackingType="weight-reps" />);
    await user.clear(screen.getByLabelText('Weight'));
    await user.selectOptions(screen.getByLabelText('Weight unit'), 'kg');
    await user.click(screen.getByText('Toggle inputs'));
    await user.click(screen.getByText('Toggle inputs'));
    expect(screen.getByLabelText('Weight')).toHaveValue(null);
    expect(screen.getByLabelText('Weight unit')).toHaveValue('kg');
    await user.type(screen.getByLabelText('Reps'), '0');
    await user.click(screen.getByRole('button', { name: 'Complete Set' }));
    expect(JSON.parse(screen.getByLabelText('Saved set').textContent!)).toMatchObject({
      weight: null, weightUnit: 'kg', reps: 0, completed: true,
    });
  });

  it('preserves an explicit blank when history supplies a default after clearing an invalid draft', async () => {
    const user = userEvent.setup();
    const view = render(<Harness initialSet={weightSet} trackingType="weight-reps" defaultWeight={null} />);
    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '-1' } });
    await user.clear(screen.getByLabelText('Weight'));
    expect(JSON.parse(screen.getByLabelText('Saved set').textContent!)).toMatchObject({ weight: null, weightCleared: true });
    view.rerender(<Harness initialSet={weightSet} trackingType="weight-reps" defaultWeight={36} />);
    expect(screen.getByLabelText('Weight')).toHaveValue(null);
    await user.type(screen.getByLabelText('Reps'), '10{Enter}');
    expect(JSON.parse(screen.getByLabelText('Saved set').textContent!)).toMatchObject({ weight: null, reps: 10, completed: true });
  });

  it('saves untouched default weight and unit only when completing, not on reps edits or blur', () => {
    const props = inputProps(weightSet, 'weight-reps');
    render(<SetInProgress {...props} />);
    fireEvent.change(screen.getByLabelText('Reps'), { target: { value: '10' } });
    expect(props.onUpdate).toHaveBeenCalledExactlyOnceWith('set-1', { reps: 10 });
    fireEvent.blur(screen.getByLabelText('Reps'));
    expect(props.onUpdate).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByLabelText('Reps'), { key: 'Enter' });
    expect(props.onUpdate).toHaveBeenLastCalledWith('set-1', {
      reps: 10, weight: 36, weightUnit: 'lb', completed: true,
    });
  });

  it.each(cases)('%s preserves an invalid draft through ordinary parent rerenders', (trackingType, set, label) => {
    const props = inputProps(set, trackingType);
    const view = render(<SetInProgress {...props} />);
    fireEvent.change(screen.getByLabelText(label), { target: { value: '-2' } });
    view.rerender(<SetInProgress {...props} set={{ ...set }} />);
    expect(screen.getByLabelText(label)).toHaveValue(-2);
    expect(props.onUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ['weight-reps', weightSet, 'Weight', '-1'],
    ['weight-reps', weightSet, 'Reps', '-1'],
    ['weight-reps', weightSet, 'Reps', '1.5'],
    ['reps', repsSet, 'Reps', '-1'],
    ['reps', repsSet, 'Reps', '1.5'],
    ['distance-duration', distanceSet, 'Distance', '-0.1'],
  ] as const)('rejects invalid input case %# without saving or completing', (trackingType, set, label, value) => {
    const props = inputProps(set, trackingType);
    render(<SetInProgress {...props} />);
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.keyDown(screen.getByLabelText(label), { key: 'Enter' });
    expect(props.onUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Complete Set' })).toBeDisabled();
    expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not complete using the previous valid weight while a negative draft is displayed', () => {
    const props = inputProps({ ...weightSet, weight: 20, reps: 10 }, 'weight-reps');
    render(<SetInProgress {...props} />);
    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '-1' } });
    fireEvent.keyDown(screen.getByLabelText('Reps'), { key: 'Enter' });
    expect(props.onUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ['weight-reps', weightSet, 'Weight', '20.25', { weight: 20.25, weightUnit: 'lb' }],
    ['reps', repsSet, 'Reps', '0', { reps: 0 }],
    ['distance-duration', distanceSet, 'Distance', '0.125', { distance: 0.125 }],
  ] as const)('accepts nonnegative numeric input case %#', (trackingType, set, label, value, updates) => {
    const props = inputProps(set, trackingType);
    render(<SetInProgress {...props} />);
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    expect(props.onUpdate).toHaveBeenCalledExactlyOnceWith('set-1', expect.objectContaining(updates));
  });

  it.each(cases)('%s clears saved reps/distance but cannot complete empty results', (trackingType, set, label, values) => {
    render(<Harness initialSet={{ ...set, ...values }} trackingType={trackingType} />);
    fireEvent.change(screen.getByLabelText(label), { target: { value: '' } });
    expect(screen.getByLabelText(label)).toHaveValue(null);
    expect(JSON.parse(screen.getByLabelText('Saved set').textContent!)).toMatchObject(
      trackingType === 'distance-duration' ? { distance: null } : { reps: null },
    );
    expect(screen.getByRole('button', { name: 'Complete Set' })).toBeDisabled();
  });

  it('relabels distance before and after entry without conversion or stale distance writes', async () => {
    const user = userEvent.setup();
    render(<Harness initialSet={distanceSet} trackingType="distance-duration" />);
    await user.selectOptions(screen.getByLabelText('Distance unit'), 'mi');
    await user.type(screen.getByLabelText('Distance'), '2.5');
    await user.selectOptions(screen.getByLabelText('Distance unit'), 'm');
    expect(screen.getByLabelText('Distance')).toHaveValue(2.5);
    expect(JSON.parse(screen.getByLabelText('Saved set').textContent!)).toMatchObject({ distance: 2.5, distanceUnit: 'm' });
  });

  it('relabels an entered weight without conversion and saves only the unit', () => {
    const props = inputProps({ ...weightSet, weight: 20 }, 'weight-reps');
    render(<SetInProgress {...props} />);
    fireEvent.change(screen.getByLabelText('Weight unit'), { target: { value: 'lb' } });
    expect(props.onUpdate).toHaveBeenCalledExactlyOnceWith('set-1', { weightUnit: 'lb' });
  });

  it('keeps a unit change while an invalid weight draft is being corrected', async () => {
    const user = userEvent.setup();
    render(<Harness initialSet={weightSet} trackingType="weight-reps" />);
    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '-1' } });
    await user.selectOptions(screen.getByLabelText('Weight unit'), 'kg');
    expect(screen.getByLabelText('Weight unit')).toHaveValue('kg');
    expect(screen.getByLabelText('Weight')).toHaveValue(-1);
    expect(JSON.parse(screen.getByLabelText('Saved set').textContent!)).toMatchObject({ weight: 36, weightUnit: 'kg' });
    expect(screen.getByRole('button', { name: 'Complete Set' })).toBeDisabled();
  });

  it('recovers completion after the parent restores a previously completed set', () => {
    const props = inputProps({ ...repsSet, reps: 10 }, 'reps');
    const view = render(<SetInProgress {...props} />);
    fireEvent.keyDown(screen.getByLabelText('Reps'), { key: 'Enter' });
    view.rerender(<SetInProgress {...props} set={{ ...repsSet, reps: 10, completed: true }} />);
    expect(screen.getByRole('button', { name: 'Complete Set' })).toBeDisabled();
    view.rerender(<SetInProgress {...props} set={{ ...repsSet, reps: 8 }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Complete Set' }));
    expect(props.onUpdate).toHaveBeenCalledTimes(2);
    expect(props.onUpdate).toHaveBeenLastCalledWith('set-1', { reps: 8, completed: true });
  });

  it('blocks completion with a missing distance duration', () => {
    const props = inputProps({ ...distanceSet, distance: 2, durationSeconds: null }, 'distance-duration');
    render(<SetInProgress {...props} />);
    fireEvent.keyDown(screen.getByLabelText('Distance'), { key: 'Enter' });
    expect(props.onUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Complete Set' })).toBeDisabled();
  });

  it.each(cases)('%s prevents submission, repeated Enter, blur writes, and duplicate completion', (trackingType, set, label, values) => {
    const props = inputProps({ ...set, ...values }, trackingType);
    const submit = vi.fn(e => e.preventDefault());
    render(<form onSubmit={submit}><SetInProgress {...props} /></form>);
    const input = screen.getByLabelText(label);
    expect(fireEvent.keyDown(input, { key: 'Enter', repeat: true })).toBe(false);
    expect(props.onUpdate).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false);
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    fireEvent.click(screen.getByRole('button', { name: 'Complete Set' }));
    expect(props.onUpdate).toHaveBeenCalledTimes(1);
    expect(props.onUpdate).toHaveBeenCalledWith('set-1', expect.objectContaining({ completed: true }));
    expect(submit).not.toHaveBeenCalled();
  });

  it.each(['weight-reps', 'reps', 'distance-duration'] as const)('%s rejects non-finite restored results', trackingType => {
    const set = trackingType === 'weight-reps' ? { ...weightSet, weight: Infinity, reps: 10 }
      : trackingType === 'reps' ? { ...repsSet, reps: NaN }
        : { ...distanceSet, distance: Infinity };
    const props = inputProps(set, trackingType);
    render(<SetInProgress {...props} />);
    fireEvent.keyDown(screen.getByPlaceholderText(trackingType === 'distance-duration' ? 'Distance' : 'Reps'), { key: 'Enter' });
    expect(props.onUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Complete Set' })).toBeDisabled();
  });
});

describe('set lifecycle safety', () => {
  it.each(['duration', 'distance-duration'] as const)('%s rejects missing, invalid, and future start times', trackingType => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:10.000Z'));
    const props = inputProps({ ...distanceSet, completedAt: null }, trackingType);
    const view = render(<SetInProgress {...props} mode="active" set={{ ...distanceSet, startedAt: null, completedAt: null }} />);
    for (const startedAt of [null, 'invalid-date', '2026-01-01T00:00:20.000Z']) {
      view.rerender(<SetInProgress {...props} mode="active" set={{ ...distanceSet, startedAt, completedAt: null }} />);
      fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
      expect(props.onUpdate).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    }
  });

  it('stops distance timing without completing until valid distance is provided', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:10.000Z'));
    const props = inputProps({ ...distanceSet, completedAt: null }, 'distance-duration');
    const view = render(<SetInProgress {...props} mode="active" />);
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(props.onUpdate).toHaveBeenCalledExactlyOnceWith('set-1', {
      completedAt: '2026-01-01T00:00:10.000Z', durationSeconds: 10,
    });
    view.rerender(<SetInProgress {...props} set={{ ...distanceSet, durationSeconds: 10 }} />);
    expect(screen.getByRole('button', { name: 'Complete Set' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Distance'), { target: { value: '2.5' } });
    fireEvent.keyDown(screen.getByLabelText('Distance'), { key: 'Enter' });
    expect(props.onUpdate).toHaveBeenLastCalledWith('set-1', { distance: 2.5, completed: true });
  });

  it('handles idle → active → awaiting-input → next set with fresh reps and defaults', () => {
    const props = inputProps(weightSet, 'weight-reps');
    const view = render(<SetInProgress {...props} mode="idle" set={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(props.onStart).toHaveBeenCalledTimes(1);
    view.rerender(<SetInProgress {...props} mode="active" set={{ ...weightSet, completedAt: null }} />);
    expect(screen.queryByLabelText('Reps')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(props.onUpdate).toHaveBeenLastCalledWith('set-1', { completedAt: expect.any(String) });
    view.rerender(<SetInProgress {...props} />);
    fireEvent.change(screen.getByLabelText('Reps'), { target: { value: '10' } });
    fireEvent.keyDown(screen.getByLabelText('Reps'), { key: 'Enter' });
    expect(props.onUpdate).toHaveBeenLastCalledWith('set-1', {
      reps: 10, weight: 36, weightUnit: 'lb', completed: true,
    });
    view.rerender(<SetInProgress {...props} mode="idle" set={null} />);
    view.rerender(<SetInProgress {...props} mode="active" set={{ ...weightSet, id: 'set-2', completedAt: null }} />);
    view.rerender(<SetInProgress {...props} set={{ ...weightSet, id: 'set-2' }} />);
    expect(screen.getByLabelText('Weight')).toHaveValue(36);
    expect(screen.getByLabelText('Weight unit')).toHaveValue('lb');
    expect(screen.getByLabelText('Reps')).toHaveValue(null);
    fireEvent.change(screen.getByLabelText('Reps'), { target: { value: '8' } });
    fireEvent.keyDown(screen.getByLabelText('Reps'), { key: 'Enter' });
    expect(props.onUpdate).toHaveBeenLastCalledWith('set-2', expect.objectContaining({ reps: 8, completed: true }));
  });
});
