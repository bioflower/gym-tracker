import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ExerciseCard } from '../components/ExerciseCard';
import type { ActiveExercise, Exercise } from '../types/gym';

const exerciseDef: Exercise = { id: 'ex-1', name: 'Bench Press', category: 'chest', trackingType: 'weight-reps', isPreset: true };
const otherDef: Exercise = { id: 'ex-2', name: 'Push-up', category: 'chest', trackingType: 'reps', isPreset: true };

function makeExercise(overrides: Partial<ActiveExercise> = {}): ActiveExercise {
  return {
    id: 'active-1',
    exerciseId: 'ex-1',
    exerciseName: 'Bench Press',
    trackingType: 'weight-reps',
    sets: [],
    notes: '',
    startedAt: null,
    completedAt: null,
    completed: false,
    ...overrides,
  };
}

function renderCard(exercise: ActiveExercise, overrides: Partial<React.ComponentProps<typeof ExerciseCard>> = {}) {
  return render(
    <ExerciseCard
      exercise={exercise}
      workoutHistory={[]}
      allExercises={[exerciseDef, otherDef]}
      onSetDone={() => {}}
      onUpdateSet={() => {}}
      onAddSet={() => {}}
      onRemoveSet={() => {}}
      onSwapExercise={() => {}}
      {...overrides}
    />
  );
}

describe('ExerciseCard', () => {
  it('shows an idle Start button when no sets have been logged yet', () => {
    renderCard(makeExercise());
    fireEvent.click(document.querySelector('.exercise-card-header')!);
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('Not Started')).toBeInTheDocument();
  });

  it('does not start a timer when the exercise header is clicked', () => {
    const onAddSet = vi.fn();
    renderCard(makeExercise(), { onAddSet });
    fireEvent.click(document.querySelector('.exercise-card-header')!);
    expect(onAddSet).not.toHaveBeenCalled();
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(document.querySelector('.live-timer')).not.toBeInTheDocument();
  });

  it('shows Start, not a running timer, when sets exist but have not been started', () => {
    const exercise = makeExercise({
      sets: [{ id: 'set-1', weight: null, weightUnit: 'kg', reps: null, startedAt: null, completedAt: null, completed: false }],
    });
    renderCard(exercise);
    fireEvent.click(document.querySelector('.exercise-card-header')!);
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.queryByText('Stop')).not.toBeInTheDocument();
    expect(document.querySelector('.live-timer')).not.toBeInTheDocument();
  });

  it('shows the active timer and Stop button, and In Progress badge, once a set is in progress', () => {
    const exercise = makeExercise({
      startedAt: '2026-01-01T00:00:00.000Z',
      sets: [{ id: 'set-1', weight: null, weightUnit: 'kg', reps: null, startedAt: '2026-01-01T00:00:00.000Z', completedAt: null, completed: false }],
    });
    renderCard(exercise);
    fireEvent.click(document.querySelector('.exercise-card-header')!);
    expect(screen.getByText('Stop')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('shows a rest timer and "Mark exercise done" link once a set has been completed', () => {
    const exercise = makeExercise({
      startedAt: '2026-01-01T00:00:00.000Z',
      sets: [{ id: 'set-1', weight: 80, weightUnit: 'kg', reps: 8, startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:01:00.000Z', completed: true }],
    });
    renderCard(exercise);
    fireEvent.click(document.querySelector('.exercise-card-header')!);
    expect(screen.getByText('Rest')).toBeInTheDocument();
    expect(screen.getByText('Start Next Set')).toBeInTheDocument();
    expect(screen.getByText('Mark exercise done')).toBeInTheDocument();
    expect(screen.getByText('80 kg × 8 reps')).toBeInTheDocument();
  });

  it('calls onSetDone(true) when "Mark exercise done" is pressed', () => {
    const onSetDone = vi.fn();
    const exercise = makeExercise({
      sets: [{ id: 'set-1', weight: 80, weightUnit: 'kg', reps: 8, startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:01:00.000Z', completed: true }],
    });
    renderCard(exercise, { onSetDone });
    fireEvent.click(document.querySelector('.exercise-card-header')!);
    fireEvent.click(screen.getByText('Mark exercise done'));
    expect(onSetDone).toHaveBeenCalledWith(true);
  });

  it('shows Done badge and a Resume link, and hides the swap control, once completed', () => {
    const exercise = makeExercise({
      completed: true,
      sets: [{ id: 'set-1', weight: 80, weightUnit: 'kg', reps: 8, startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:01:00.000Z', completed: true }],
    });
    renderCard(exercise);
    fireEvent.click(document.querySelector('.exercise-card-header')!);
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Resume / log another set')).toBeInTheDocument();
    expect(screen.queryByLabelText('Change exercise')).not.toBeInTheDocument();
  });

  it('hides the exercise swap control once any set has been logged', () => {
    const exercise = makeExercise({
      sets: [{ id: 'set-1', weight: 80, weightUnit: 'kg', reps: 8, startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:01:00.000Z', completed: true }],
    });
    renderCard(exercise);
    fireEvent.click(document.querySelector('.exercise-card-header')!);
    expect(screen.queryByLabelText('Change exercise')).not.toBeInTheDocument();
  });

  it('shows the exercise swap control before any set is logged', () => {
    renderCard(makeExercise());
    fireEvent.click(document.querySelector('.exercise-card-header')!);
    expect(screen.getByLabelText('Change exercise')).toBeInTheDocument();
  });
});
