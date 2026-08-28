import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlanPage } from '../pages/PlanPage';
import { getDefaultWorkoutPlan } from '../data/defaultWorkoutPlan';

const { savePlanMock, fetchExercisesMock, fetchPlanMock, fetchSessionsMock } = vi.hoisted(() => ({
  savePlanMock: vi.fn(),
  fetchExercisesMock: vi.fn(),
  fetchPlanMock: vi.fn(),
  fetchSessionsMock: vi.fn(),
}));

vi.mock('../api/sync', () => ({
  isOnline: () => true,
  enqueue: vi.fn(),
  processQueue: vi.fn(),
  setupSyncListener: () => () => {},
}));

vi.mock('../api/workouts', () => ({
  fetchExercises: fetchExercisesMock,
  fetchPlan: fetchPlanMock,
  fetchSessions: fetchSessionsMock,
  savePlan: savePlanMock,
}));

const serverExercises = [
  { id: 'uuid-preset-crunch', name: 'Crunch', category: 'core', tracking_type: 'reps', equipment: '', is_preset: true },
  { id: 'uuid-custom-1', name: 'My Custom', category: 'other', tracking_type: 'reps', equipment: '', is_preset: false },
];

const serverPlan = [
  {
    id: 'day-1',
    name: 'Push Day',
    position: 0,
    exercises: [{ id: 'pe-1', exercise: 'uuid-preset-crunch', position: 0, target_sets: 3 }],
  },
];

describe('default workout plan contract', () => {
  it('uses backend field names: exercise, target_sets, and day-level position', () => {
    const plan = getDefaultWorkoutPlan();
    expect(plan.length).toBeGreaterThan(0);
    for (const day of plan) {
      expect(day).toHaveProperty('position');
      for (const ex of day.exercises) {
        expect(ex).toHaveProperty('exercise');
        expect(ex).toHaveProperty('target_sets');
        expect(ex).not.toHaveProperty('exerciseId');
        expect(ex).not.toHaveProperty('targetSets');
      }
    }
  });
});

describe('PlanPage with a server-backed plan', () => {
  beforeEach(() => {
    window.localStorage.clear();
    savePlanMock.mockReset();
    fetchExercisesMock.mockReset().mockResolvedValue(serverExercises);
    fetchPlanMock.mockReset().mockResolvedValue(serverPlan);
    fetchSessionsMock.mockReset().mockResolvedValue([]);
  });

  it('resolves exercise names from a server plan that references exercise IDs', async () => {
    render(<PlanPage />);

    await screen.findByText('Push Day');
    expect(screen.getByText('Crunch')).toBeInTheDocument();
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
  });

  it('saves added exercises using the backend contract (exercise, target_sets)', async () => {
    render(<PlanPage />);

    await screen.findByText('Push Day');
    fireEvent.click(screen.getByText('+ Add Exercise'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'uuid-custom-1' } });

    await waitFor(() => {
      expect(screen.getByText('My Custom')).toBeInTheDocument();
    });

    expect(savePlanMock).toHaveBeenCalled();
    const savedBody = savePlanMock.mock.calls[0][0];
    expect(savedBody[0].exercises[0]).toEqual(
      expect.objectContaining({ exercise: 'uuid-preset-crunch', target_sets: 3 })
    );
    const added = savedBody[0].exercises[1];
    expect(added).toMatchObject({ exercise: 'uuid-custom-1', target_sets: 3, position: 1 });
    expect(added).not.toHaveProperty('exerciseId');
    expect(added).not.toHaveProperty('targetSets');
  });

  it('allows changing an existing exercise in place by clicking its name', async () => {
    render(<PlanPage />);

    await screen.findByText('Push Day');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Crunch'));

    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('uuid-preset-crunch');

    fireEvent.change(select, { target: { value: 'uuid-custom-1' } });

    await waitFor(() => {
      expect(screen.getByText('My Custom')).toBeInTheDocument();
    });
    expect(screen.queryByText('Crunch')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    expect(savePlanMock).toHaveBeenCalled();
    const savedBody = savePlanMock.mock.calls[savePlanMock.mock.calls.length - 1][0];
    expect(savedBody[0].exercises).toHaveLength(1);
    expect(savedBody[0].exercises[0]).toMatchObject({
      id: 'pe-1',
      exercise: 'uuid-custom-1',
      position: 0,
      target_sets: 3,
    });
  });

  it('closes edit mode without changing the plan when clicking away', async () => {
    render(<PlanPage />);

    await screen.findByText('Push Day');
    fireEvent.click(screen.getByText('Crunch'));

    const select = screen.getByRole('combobox');
    fireEvent.blur(select);

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('Crunch')).toBeInTheDocument();
    expect(savePlanMock).not.toHaveBeenCalled();
  });
});