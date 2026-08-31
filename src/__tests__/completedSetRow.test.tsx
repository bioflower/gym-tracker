import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CompletedSetRow } from '../components/CompletedSetRow';
import type { WeightRepSet } from '../types/gym';

const baseSet: WeightRepSet = {
  id: 'set-1',
  weight: 80,
  weightUnit: 'kg',
  reps: 8,
  startedAt: '2026-01-01T00:00:00.000Z',
  completedAt: '2026-01-01T00:01:00.000Z',
  completed: true,
};

describe('CompletedSetRow', () => {
  it('renders a summary line for a weight-reps set', () => {
    render(
      <CompletedSetRow set={baseSet} trackingType="weight-reps" setIndex={0} onUpdate={() => {}} onRemove={() => {}} />
    );
    expect(screen.getByText('Set 1')).toBeInTheDocument();
    expect(screen.getByText('80 kg × 8 reps')).toBeInTheDocument();
  });

  it('expands to show editable weight and reps inputs on click', () => {
    render(
      <CompletedSetRow set={baseSet} trackingType="weight-reps" setIndex={0} onUpdate={() => {}} onRemove={() => {}} />
    );
    fireEvent.click(screen.getByText('80 kg × 8 reps'));
    expect(screen.getByDisplayValue('80')).toBeInTheDocument();
    expect(screen.getByDisplayValue('8')).toBeInTheDocument();
  });

  it('calls onUpdate when the expanded reps input changes', () => {
    const onUpdate = vi.fn();
    render(
      <CompletedSetRow set={baseSet} trackingType="weight-reps" setIndex={0} onUpdate={onUpdate} onRemove={() => {}} />
    );
    fireEvent.click(screen.getByText('80 kg × 8 reps'));
    fireEvent.change(screen.getByDisplayValue('8'), { target: { value: '9' } });
    expect(onUpdate).toHaveBeenCalledWith('set-1', { reps: 9 });
  });

  it('calls onRemove when the remove button is pressed', () => {
    const onRemove = vi.fn();
    render(
      <CompletedSetRow set={baseSet} trackingType="weight-reps" setIndex={0} onUpdate={() => {}} onRemove={onRemove} />
    );
    fireEvent.click(screen.getByText('80 kg × 8 reps'));
    fireEvent.click(screen.getByLabelText('Remove set 1'));
    expect(onRemove).toHaveBeenCalledWith('set-1');
  });
});
