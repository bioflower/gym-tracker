import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SetInProgress } from '../components/SetInProgress';
import type { DurationSet, WeightRepSet, WeightUnit } from '../types/gym';

function WeightInputHarness({ defaultWeightUnit = 'kg' }: { defaultWeightUnit?: WeightUnit }) {
  const [set, setSet] = useState<WeightRepSet>({
    id: 'set-1', weight: null, weightUnit: 'kg', reps: null,
    startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:00:05.000Z', completed: false,
  });
  return (
    <>
      <SetInProgress
        mode="awaiting-input" set={set} trackingType="weight-reps" setIndex={0}
        defaultWeight={36} defaultWeightUnit={defaultWeightUnit} onStart={() => {}}
        onUpdate={(_id, updates) => setSet(previous => ({ ...previous, ...updates }))}
      />
      <output aria-label="Saved set">{JSON.stringify(set)}</output>
    </>
  );
}

describe('SetInProgress', () => {
  it('allows deleting all digits of the default weight and replacing it with 20', async () => {
    const user = userEvent.setup();
    render(<WeightInputHarness />);
    const weight = screen.getByLabelText('Weight');
    await user.click(weight);
    await user.keyboard('{Backspace}{Backspace}');
    expect(weight).toHaveValue(null);
    await user.type(weight, '20');
    await user.type(screen.getByLabelText('Reps'), '10{Enter}');
    expect(weight).toHaveValue(20);
    expect(JSON.parse(screen.getByLabelText('Saved set').textContent!)).toMatchObject({
      weight: 20, weightUnit: 'kg', reps: 10, completed: true,
    });
  });

  it('keeps a unit change made before entering weight when completing the set', async () => {
    const user = userEvent.setup();
    render(<WeightInputHarness />);
    await user.selectOptions(screen.getByLabelText('Weight unit'), 'lb');
    expect(screen.getByLabelText('Weight unit')).toHaveValue('lb');
    await user.type(screen.getByLabelText('Reps'), '10{Enter}');
    expect(JSON.parse(screen.getByLabelText('Saved set').textContent!)).toMatchObject({
      weight: 36, weightUnit: 'lb', reps: 10, completed: true,
    });
  });

  it('does not restore the default weight when reps are entered after clearing weight', async () => {
    const user = userEvent.setup();
    render(<WeightInputHarness />);
    await user.clear(screen.getByLabelText('Weight'));
    await user.type(screen.getByLabelText('Reps'), '10{Enter}');
    expect(screen.getByLabelText('Weight')).toHaveValue(null);
    expect(JSON.parse(screen.getByLabelText('Saved set').textContent!)).toMatchObject({
      weight: null, reps: 10, completed: true,
    });
  });

  it('preserves the historical unit when editing the default weight down to zero', async () => {
    const user = userEvent.setup();
    render(<WeightInputHarness defaultWeightUnit="lb" />);
    await user.clear(screen.getByLabelText('Weight'));
    await user.type(screen.getByLabelText('Weight'), '0');
    expect(screen.getByLabelText('Weight unit')).toHaveValue('lb');
    await user.type(screen.getByLabelText('Reps'), '10{Enter}');
    expect(JSON.parse(screen.getByLabelText('Saved set').textContent!)).toMatchObject({
      weight: 0, weightUnit: 'lb', reps: 10, completed: true,
    });
  });

  it('idle mode renders a Start button and calls onStart', () => {
    const onStart = vi.fn();
    render(
      <SetInProgress
        mode="idle" set={null} trackingType="weight-reps" setIndex={0}
        defaultWeight={null} defaultWeightUnit="kg" onStart={onStart} onUpdate={() => {}}
      />
    );
    fireEvent.click(screen.getByText('Start'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('active mode renders a Stop button that, for weight-reps, only stamps completedAt (no reps yet)', () => {
    const onUpdate = vi.fn();
    const set: WeightRepSet = {
      id: 'set-1', weight: null, weightUnit: 'kg', reps: null,
      startedAt: '2026-01-01T00:00:00.000Z', completedAt: null, completed: false,
    };
    render(
      <SetInProgress
        mode="active" set={set} trackingType="weight-reps" setIndex={0}
        defaultWeight={null} defaultWeightUnit="kg" onStart={() => {}} onUpdate={onUpdate}
      />
    );
    fireEvent.click(screen.getByText('Stop'));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    const [setId, updates] = onUpdate.mock.calls[0];
    expect(setId).toBe('set-1');
    expect(updates.completedAt).toBeTruthy();
    expect(updates.completed).toBeUndefined();
    expect(updates.durationSeconds).toBeUndefined();
  });

  it('active mode Stop auto-captures elapsed time as duration for duration tracking type', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:10.000Z'));
    const onUpdate = vi.fn();
    const set: DurationSet = {
      id: 'set-1', durationSeconds: null,
      startedAt: '2026-01-01T00:00:00.000Z', completedAt: null, completed: false,
    };
    render(
      <SetInProgress
        mode="active" set={set} trackingType="duration" setIndex={0}
        defaultWeight={null} defaultWeightUnit="kg" onStart={() => {}} onUpdate={onUpdate}
      />
    );
    fireEvent.click(screen.getByText('Stop'));
    expect(onUpdate).toHaveBeenCalledWith('set-1', { completedAt: '2026-01-01T00:00:10.000Z', completed: true, durationSeconds: 10 });
    vi.useRealTimers();
  });

  it('awaiting-input mode for weight-reps pre-fills weight from defaultWeight and completes on Enter key', () => {
    const onUpdate = vi.fn();
    const set: WeightRepSet = {
      id: 'set-1', weight: null, weightUnit: 'kg', reps: null,
      startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:00:05.000Z', completed: false,
    };
    render(
      <SetInProgress
        mode="awaiting-input" set={set} trackingType="weight-reps" setIndex={0}
        defaultWeight={80} defaultWeightUnit="kg" onStart={() => {}} onUpdate={onUpdate}
      />
    );
    expect(screen.getByDisplayValue('80')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Reps'), { target: { value: '134' } });
    expect(onUpdate).toHaveBeenCalledExactlyOnceWith('set-1', { reps: 134 });
    // blur alone must NOT complete the set (the bug: typing "1" then blurring should not complete)
    fireEvent.blur(screen.getByPlaceholderText('Reps'));
    expect(onUpdate).not.toHaveBeenCalledWith('set-1', expect.objectContaining({ completed: true }));
    // pressing Enter must complete the set
    fireEvent.keyDown(screen.getByPlaceholderText('Reps'), { key: 'Enter' });
    expect(onUpdate).toHaveBeenCalledWith('set-1', { reps: 134, weight: 80, weightUnit: 'kg', completed: true });
  });

  it('awaiting-input mode for reps-only completes on Enter key with no weight field', () => {
    const onUpdate = vi.fn();
    const set = { id: 'set-1', reps: null, startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:00:05.000Z', completed: false };
    render(
      <SetInProgress
        mode="awaiting-input" set={set} trackingType="reps" setIndex={0}
        defaultWeight={null} defaultWeightUnit="kg" onStart={() => {}} onUpdate={onUpdate}
      />
    );
    expect(screen.queryByLabelText('Weight unit')).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Reps'), { target: { value: '12' } });
    expect(onUpdate).toHaveBeenCalledWith('set-1', { reps: 12 });
    // blur alone must NOT complete the set
    fireEvent.blur(screen.getByPlaceholderText('Reps'));
    expect(onUpdate).not.toHaveBeenCalledWith('set-1', expect.objectContaining({ completed: true }));
    // pressing Enter must complete the set
    fireEvent.keyDown(screen.getByPlaceholderText('Reps'), { key: 'Enter' });
    expect(onUpdate).toHaveBeenCalledWith('set-1', { reps: 12, completed: true });
  });

  it('awaiting-input mode for distance-duration shows only a distance field and completes on Enter', () => {
    const onUpdate = vi.fn();
    const set = {
      id: 'set-1', distance: null, distanceUnit: 'km' as const, durationSeconds: 30, notes: '',
      startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:00:30.000Z', completed: false,
    };
    render(
      <SetInProgress
        mode="awaiting-input" set={set} trackingType="distance-duration" setIndex={0}
        defaultWeight={null} defaultWeightUnit="kg" onStart={() => {}} onUpdate={onUpdate}
      />
    );
    fireEvent.change(screen.getByPlaceholderText('Distance'), { target: { value: '5' } });
    expect(onUpdate).toHaveBeenCalledWith('set-1', { distance: 5 });
    // blur alone must NOT complete the set
    fireEvent.blur(screen.getByPlaceholderText('Distance'));
    expect(onUpdate).not.toHaveBeenCalledWith('set-1', expect.objectContaining({ completed: true }));
    // pressing Enter must complete the set
    fireEvent.keyDown(screen.getByPlaceholderText('Distance'), { key: 'Enter' });
    expect(onUpdate).toHaveBeenCalledWith('set-1', { distance: 5, completed: true });
  });
});
