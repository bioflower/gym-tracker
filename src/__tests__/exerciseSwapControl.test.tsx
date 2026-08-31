import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ExerciseSwapControl } from '../components/ExerciseSwapControl';
import type { Exercise } from '../types/gym';

const exercises: Exercise[] = [
  { id: 'ex-1', name: 'Bench Press', category: 'chest', trackingType: 'weight-reps', isPreset: true },
  { id: 'ex-2', name: 'Push-up', category: 'chest', trackingType: 'reps', isPreset: true },
];

describe('ExerciseSwapControl', () => {
  it('renders a select with all exercise names when not disabled', () => {
    render(
      <ExerciseSwapControl currentExerciseId="ex-1" allExercises={exercises} disabled={false} onSwap={() => {}} />
    );
    expect(screen.getByLabelText('Change exercise')).toBeInTheDocument();
    expect(screen.getByText('Push-up')).toBeInTheDocument();
  });

  it('renders nothing when disabled', () => {
    render(
      <ExerciseSwapControl currentExerciseId="ex-1" allExercises={exercises} disabled={true} onSwap={() => {}} />
    );
    expect(screen.queryByLabelText('Change exercise')).not.toBeInTheDocument();
  });

  it('calls onSwap with the newly selected exercise id', () => {
    const onSwap = vi.fn();
    render(
      <ExerciseSwapControl currentExerciseId="ex-1" allExercises={exercises} disabled={false} onSwap={onSwap} />
    );
    fireEvent.change(screen.getByLabelText('Change exercise'), { target: { value: 'ex-2' } });
    expect(onSwap).toHaveBeenCalledWith('ex-2');
  });
});
