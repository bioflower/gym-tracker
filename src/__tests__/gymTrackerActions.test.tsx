import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { type ReactNode } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Navigation } from '../components/Navigation';
import { TodayPage } from '../pages/TodayPage';

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

const mockUser = { id: 'test-id', email: 'test@test.com', created_at: '2025-01-01T00:00:00Z' };

function MockAuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider value={{ user: mockUser, loading: false, login: async () => {}, register: async () => {}, logout: () => {} }}>
      {children}
    </AuthContext.Provider>
  );
}

function renderApp() {
  return render(
    <MockAuthProvider>
      <MemoryRouter initialEntries={['/']}>
        <div className="app">
          <Navigation />
          <main className="main-content">
            <TodayPage />
          </main>
        </div>
      </MemoryRouter>
    </MockAuthProvider>
  );
}

describe('useGymTracker actions', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts a workout with zero pre-created sets per exercise (one idle Start button each)', async () => {
    renderApp();
    await act(async () => {
      fireEvent.click(screen.getByText('Start Workout'));
    });
    document.querySelectorAll('.exercise-card-header').forEach(header => fireEvent.click(header));
    expect(screen.getAllByText('Start')).toHaveLength(4);
  });

  it('marks the exercise In Progress once its first set is started', async () => {
    renderApp();
    await act(async () => {
      fireEvent.click(screen.getByText('Start Workout'));
    });
    document.querySelectorAll('.exercise-card-header').forEach(header => fireEvent.click(header));
    await act(async () => {
      fireEvent.click(screen.getAllByText('Start')[0]);
    });
    expect(screen.getAllByText('In Progress')).toHaveLength(1);
  });

  it('marks an exercise done via "Mark exercise done" and shows a Resume link', async () => {
    renderApp();
    await act(async () => {
      fireEvent.click(screen.getByText('Start Workout'));
    });
    document.querySelectorAll('.exercise-card-header').forEach(header => fireEvent.click(header));
    const firstCard = within(document.querySelectorAll('.exercise-card-body')[0] as HTMLElement);
    await act(async () => {
      fireEvent.click(firstCard.getByText('Start'));
    });
    await act(async () => {
      fireEvent.click(firstCard.getByText('Stop'));
    });
    await act(async () => {
      fireEvent.change(firstCard.getByPlaceholderText('Reps'), { target: { value: '10' } });
    });
    await act(async () => {
      fireEvent.click(firstCard.getByText('Mark exercise done'));
    });
    expect(firstCard.getByText('Resume / log another set')).toBeInTheDocument();
  });

  it('swaps today\'s exercise before any set is logged, without touching the saved plan', async () => {
    renderApp();
    await act(async () => {
      fireEvent.click(screen.getByText('Start Workout'));
    });
    document.querySelectorAll('.exercise-card-header').forEach(header => fireEvent.click(header));
    const firstCard = within(document.querySelectorAll('.exercise-card-body')[0] as HTMLElement);
    const select = firstCard.getByLabelText('Change exercise') as HTMLSelectElement;
    const otherOption = Array.from(select.options).find(o => o.value !== select.value)!;
    await act(async () => {
      fireEvent.change(select, { target: { value: otherOption.value } });
    });
    expect(screen.getByText(otherOption.text, { selector: 'h3' })).toBeInTheDocument();
  });
});
