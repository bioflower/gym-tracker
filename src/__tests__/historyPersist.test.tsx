import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { type ReactNode } from 'react';
import { AuthContext } from '../context/AuthContext';
import { TodayPage } from '../pages/TodayPage';
import { HistoryPage } from '../pages/HistoryPage';
import { getDefaultAppData } from '../utils/storage';

vi.mock('../api/sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/sync')>();
  return {
    ...actual,
    isOnline: () => false,
    enqueue: vi.fn(),
    processQueue: vi.fn(),
    setupSyncListener: () => () => {},
  };
});

vi.mock('../api/client', () => ({
  apiRequest: vi.fn(),
}));

const mockUser = { id: 'test-id', email: 'test@test.com', created_at: '2025-01-01T00:00:00Z' };

function MockAuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider value={{ user: mockUser, loading: false, login: async () => {}, register: async () => {}, logout: () => {} }}>
      {children}
    </AuthContext.Provider>
  );
}

function seedFinishedExercise(done: boolean) {
  const data = getDefaultAppData();
  data.activeWorkout = {
    id: 'w1', workoutDayId: 'workout-a', workoutName: 'Workout A', date: '2026-10-22',
    startedAt: '2026-10-22T10:00:00Z', completedAt: null, status: 'in-progress',
    exercises: [{
      id: 'e1', exerciseId: '0a1b2c3d-0001-4000-8000-000000000003', exerciseName: 'Barbell Lunge',
      trackingType: 'weight-reps', sets: [], notes: '', startedAt: null, completedAt: null, completed: done,
    }],
  };
  window.localStorage.setItem('gym-tracker-data-v1', JSON.stringify(data));
}

async function finishWorkout() {
  seedFinishedExercise(true);
  render(
    <MockAuthProvider>
      <MemoryRouter initialEntries={['/']}>
        <TodayPage />
      </MemoryRouter>
    </MockAuthProvider>
  );
  await act(async () => {
    fireEvent.click(screen.getByText('Finish Workout'));
  });
  // Flush the localStorage persist effect
  await act(async () => {});
}

describe('Workout history persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows the finished workout in history immediately after finishing', async () => {
    await finishWorkout();

    render(
      <MockAuthProvider>
        <MemoryRouter initialEntries={['/history']}>
          <HistoryPage />
        </MemoryRouter>
      </MockAuthProvider>
    );

    expect(screen.queryByText('No workouts yet.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Workout name')).toHaveValue('Lower Body');
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('lets the user rename a workout in history and keeps the new name', async () => {
    await finishWorkout();

    render(
      <MockAuthProvider>
        <MemoryRouter initialEntries={['/history']}>
          <HistoryPage />
        </MemoryRouter>
      </MockAuthProvider>
    );

    const input = screen.getByLabelText('Workout name');
    fireEvent.change(input, { target: { value: 'Leg day' } });
    await act(async () => {
      fireEvent.blur(input);
    });
    await act(async () => {});

    expect(screen.getByLabelText('Workout name')).toHaveValue('Leg day');
    expect(window.localStorage.getItem('gym-tracker-data-v1')).toContain('Leg day');
  });
});
