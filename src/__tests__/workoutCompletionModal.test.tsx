import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkoutCompletionModal } from '../components/WorkoutCompletionModal';
import { getDefaultWorkoutPlan } from '../data/defaultWorkoutPlan';

vi.mock('../api/sync', () => ({
  isOnline: () => false,
  enqueue: vi.fn(),
  processQueue: vi.fn(),
  setupSyncListener: () => () => {},
}));

describe('WorkoutCompletionModal', () => {
  it('renders the next workout exercise names', () => {
    const plan = getDefaultWorkoutPlan();
    render(
      <WorkoutCompletionModal
        nextWorkout={plan[0]}
        allComplete={true}
        incompleteCount={0}
        onFinishAnyway={() => {}}
        onReturn={() => {}}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Dumbbell Lunge')).toBeInTheDocument();
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText('Lat Pulldown')).toBeInTheDocument();
  });
});