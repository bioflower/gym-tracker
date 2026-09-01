import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { type ReactNode } from 'react';
import { AuthContext } from '../context/AuthContext';
import { TodayPage } from '../pages/TodayPage';
import { HistoryPage } from '../pages/HistoryPage';

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

async function finishWorkout() {
  render(
    <MockAuthProvider>
      <MemoryRouter initialEntries={['/']}>
        <TodayPage />
      </MemoryRouter>
    </MockAuthProvider>
  );
  await act(async () => {
    fireEvent.click(screen.getByText('Start Workout'));
  });
  // Exercises are not completed — click "Finish Workout" → modal → "Finish Anyway"
  await act(async () => {
    fireEvent.click(screen.getByText('Finish Workout'));
  });
  await act(async () => {
    fireEvent.click(screen.getByText('Finish Anyway'));
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
    expect(screen.getByText('Workout A')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });
});
