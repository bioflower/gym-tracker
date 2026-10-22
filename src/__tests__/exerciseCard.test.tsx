import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ExerciseCard } from '../components/ExerciseCard';
import type { ActiveExercise, Exercise, ExerciseSet } from '../types/gym';
import { BUTTON_LABELS } from '../constants/workout';

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

describe('ExerciseCard prefill', () => {
  const prevSet = (reps: number): ExerciseSet => ({ id: 'p1', type: 'weight-reps', weight: 85, weightUnit: 'lb', reps, startedAt: null, completedAt: null, completed: true } as ExerciseSet);
  const history = (reps: number) => [{
    id: 'h', workoutDayId: 'd', workoutName: 'W', date: '2026-01-01', startedAt: null, completedAt: null, status: 'completed' as const,
    exercises: [{ id: 'ce', exerciseId: 'ex-1', exerciseName: 'Bench Press', trackingType: 'weight-reps' as const, sets: [prevSet(reps)] }],
  }] as unknown as React.ComponentProps<typeof ExerciseCard>['workoutHistory'];
  const awaiting = (id: string, extra: ExerciseSet[] = []) => makeExercise({
    sets: [...extra, { id, weight: null, weightUnit: 'kg', reps: null, startedAt: '2026-01-02T00:00:00.000Z', completedAt: '2026-01-02T00:00:05.000Z', completed: false } as ExerciseSet],
  });
  const open = () => fireEvent.click(document.querySelector('.exercise-card-header')!);

  it('Last time follows the exercise after a swap', () => {
    const session = (exerciseId: string, name: string, reps: number) => ({
      id: 'h-' + exerciseId, workoutDayId: 'd', workoutName: 'W', date: exerciseId === 'ex-1' ? '2026-01-01' : '2026-01-02', startedAt: null, completedAt: null, status: 'completed' as const,
      exercises: [{ id: 'ce-' + exerciseId, exerciseId, exerciseName: name, trackingType: 'weight-reps' as const,
        sets: [{ id: 'p', type: 'weight-reps', weight: 50, weightUnit: 'kg', reps, completed: true }] }],
    });
    const workoutHistory = [session('ex-1', 'Bench Press', 7), session('ex-2', 'Push-up', 15)] as unknown as React.ComponentProps<typeof ExerciseCard>['workoutHistory'];
    const props = { workoutHistory, allExercises: [exerciseDef, otherDef], onSetDone: () => {}, onUpdateSet: () => {}, onAddSet: () => {}, onRemoveSet: () => {}, onSwapExercise: () => {} };
    const view = render(<ExerciseCard exercise={makeExercise()} {...props} />);
    fireEvent.click(document.querySelector('.exercise-card-header')!);
    expect(screen.getByText('50 kg × 7')).toBeInTheDocument();
    view.rerender(<ExerciseCard exercise={makeExercise({ exerciseId: 'ex-2', exerciseName: 'Push-up' })} {...props} />);
    expect(screen.getByText('50 kg × 15')).toBeInTheDocument();
    expect(screen.queryByText('50 kg × 7')).not.toBeInTheDocument();
  });

  it('set 1 prefills last time weight and reps + 1', () => {
    renderCard(awaiting('s1'), { workoutHistory: history(11) });
    open();
    expect(screen.getByDisplayValue('85')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Reps')).toHaveValue(12);
    expect(screen.getByText('Suggested for today: 85 lb × 12')).toBeInTheDocument();
  });

  it('shows the suggestion before the set is started', () => {
    renderCard(makeExercise(), { workoutHistory: history(11) });
    open();
    expect(screen.getByText('Suggested for today: 85 lb × 12')).toBeInTheDocument();
  });

  it('set 1 at 12 reps moves to 8 reps at the Epley-equivalent weight (85x12 -> 95x8)', () => {
    renderCard(awaiting('s1'), { workoutHistory: history(12) });
    open();
    expect(screen.getByDisplayValue('95')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Reps')).toHaveValue(8);
  });

  it('set 2 copies weight and reps from completed set 1', () => {
    const first = { id: 's1', weight: 90, weightUnit: 'kg', reps: 10, startedAt: 'x', completedAt: 'y', completed: true } as ExerciseSet;
    renderCard(awaiting('s2', [first]), { workoutHistory: history(11) });
    open();
    expect(screen.getByDisplayValue('90')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Reps')).toHaveValue(10);
  });
});

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

  it('labels the in-progress set as Set 1 even when placeholder sets already exist', () => {
    const empty = { weight: null as number | null, weightUnit: 'kg' as const, reps: null as number | null, completedAt: null, completed: false };
    const exercise = makeExercise({
      startedAt: '2026-01-01T00:00:00.000Z',
      sets: [
        { id: 'set-1', ...empty, startedAt: '2026-01-01T00:00:00.000Z' },
        { id: 'set-2', ...empty, startedAt: null },
        { id: 'set-3', ...empty, startedAt: null },
      ],
    });
    renderCard(exercise);
    fireEvent.click(document.querySelector('.exercise-card-header')!);
    expect(screen.getByText('Set 1')).toBeInTheDocument();
    expect(screen.queryByText('Set 3')).not.toBeInTheDocument();
  });

  it('shows a rest timer and "Mark exercise done" link once a set has been completed', () => {
    const exercise = makeExercise({
      startedAt: '2026-01-01T00:00:00.000Z',
      sets: [{ id: 'set-1', weight: 80, weightUnit: 'kg', reps: 8, startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:01:00.000Z', completed: true }],
    });
    renderCard(exercise);
    fireEvent.click(document.querySelector('.exercise-card-header')!);
    expect(screen.getByText('Rest')).toBeInTheDocument();
    expect(screen.getByText(BUTTON_LABELS.START_NEXT_SET)).toBeInTheDocument();
    expect(screen.getByText(BUTTON_LABELS.COMPLETE_EXERCISE)).toBeInTheDocument();
    expect(screen.getByText('80 kg × 8 reps')).toBeInTheDocument();
  });

  it('calls onSetDone(true) when "Mark exercise done" is pressed', () => {
    const onSetDone = vi.fn();
    const exercise = makeExercise({
      sets: [{ id: 'set-1', weight: 80, weightUnit: 'kg', reps: 8, startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:01:00.000Z', completed: true }],
    });
    renderCard(exercise, { onSetDone });
    fireEvent.click(document.querySelector('.exercise-card-header')!);
    fireEvent.click(screen.getByText(BUTTON_LABELS.COMPLETE_EXERCISE));
    expect(onSetDone).toHaveBeenCalledWith(true);
  });

  it('shows Done badge and a Resume link, and hides the swap control, once completed', () => {
    const exercise = makeExercise({
      completed: true,
      sets: [{ id: 'set-1', weight: 80, weightUnit: 'kg', reps: 8, startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:01:00.000Z', completed: true }],
    });
    renderCard(exercise);
    fireEvent.click(document.querySelector('.exercise-card-header')!);
    expect(screen.getByText(BUTTON_LABELS.RESUME_EXERCISE)).toBeInTheDocument();
    expect(screen.queryByText(BUTTON_LABELS.COMPLETE_EXERCISE)).not.toBeInTheDocument();
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

  it('keeps the reps field open after the first digit so values like 13 can be typed', () => {
    function StatefulCard() {
      const [exercise, setExercise] = useState<ActiveExercise>(makeExercise({
        exerciseName: 'Crunch',
        trackingType: 'reps',
        startedAt: '2026-01-01T00:00:00.000Z',
        sets: [{
          id: 'set-1',
          reps: null,
          startedAt: '2026-01-01T00:00:00.000Z',
          completedAt: '2026-01-01T00:00:05.000Z',
          completed: false,
        }],
      }));
      return (
        <ExerciseCard
          exercise={exercise}
          workoutHistory={[]}
          allExercises={[exerciseDef, otherDef]}
          onSetDone={() => {}}
          onUpdateSet={(setId, updates) => {
            setExercise(e => ({
              ...e,
              sets: e.sets.map(s => (s.id === setId ? { ...s, ...updates } as ExerciseSet : s)),
            }));
          }}
          onAddSet={() => {}}
          onRemoveSet={() => {}}
          onSwapExercise={() => {}}
        />
      );
    }

    render(<StatefulCard />);
    fireEvent.click(document.querySelector('.exercise-card-header')!);
    const input = screen.getByPlaceholderText('Reps');
    fireEvent.change(input, { target: { value: '1' } });
    expect(screen.getByPlaceholderText('Reps')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Reps'), { target: { value: '13' } });
    expect(screen.getByPlaceholderText('Reps')).toHaveValue(13);
  });
});
