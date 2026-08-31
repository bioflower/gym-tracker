import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { type ReactNode } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Navigation } from '../components/Navigation';
import { TodayPage } from '../pages/TodayPage';
import { BUTTON_LABELS } from '../constants/workout';

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

describe('Gym Tracker', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('displays Workout A by default', () => {
    renderApp();
    expect(screen.getByText('Workout A')).toBeInTheDocument();
  });

  it('advances to Workout B after finishing Workout A', async () => {
    renderApp();
    await act(async () => {
      fireEvent.click(screen.getByText('Start Workout'));
    });
    document.querySelectorAll('.exercise-card-header').forEach(header => {
      fireEvent.click(header);
    });

    const cards = Array.from(document.querySelectorAll('.exercise-card-body'));
    for (const card of cards) {
      const scoped = within(card as HTMLElement);
      for (let setNum = 0; setNum < 3; setNum++) {
        const startLabel = setNum === 0 ? 'Start' : 'Start Next Set';
        await act(async () => {
          fireEvent.click(scoped.getByText(startLabel));
        });
        await act(async () => {
          fireEvent.click(scoped.getByText('Stop'));
        });
        await act(async () => {
          fireEvent.change(scoped.getByPlaceholderText('Reps'), { target: { value: '10' } });
        });
      }
      await act(async () => {
        fireEvent.click(scoped.getByText(BUTTON_LABELS.COMPLETE_EXERCISE));
      });
    }

    await act(async () => {
      fireEvent.click(screen.getByText('Finish Workout'));
    });
    expect(screen.getByText('Workout B')).toBeInTheDocument();
  });
});
