import { render, screen, fireEvent, act, within, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { type ReactNode } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Navigation } from '../components/Navigation';
import { TodayPage } from '../pages/TodayPage';
import { BUTTON_LABELS } from '../constants/workout';
import { useGymTracker } from '../hooks/useGymTracker';
import { loadAppData } from '../utils/storage';

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
      // Enter key is now required to mark a set as completed (prevents premature completion on blur)
      fireEvent.keyDown(firstCard.getByPlaceholderText('Reps'), { key: 'Enter' });
    });
    await act(async () => {
      fireEvent.click(firstCard.getByText(BUTTON_LABELS.COMPLETE_EXERCISE));
    });
    expect(firstCard.getByText(BUTTON_LABELS.RESUME_EXERCISE)).toBeInTheDocument();
  });

  it('workoutHistory is updated immediately after finishWorkout without a page reload', async () => {
    const { result } = renderHook(() => useGymTracker());

    // Start a workout (uses default plan from getDefaultAppData)
    act(() => {
      result.current.startWorkout();
    });
    expect(result.current.data.activeWorkout).not.toBeNull();

    // Finish the workout
    await act(async () => {
      await result.current.finishWorkout();
    });

    // Active workout should be cleared
    expect(result.current.data.activeWorkout).toBeNull();

    // History must update immediately — no page reload or syncFromServer required
    expect(result.current.data.workoutHistory).toHaveLength(1);
    expect(result.current.data.workoutHistory[0].status).toBe('completed');
  });

  it('merges batched field updates immutably and restores intentionally cleared weights from the cache', () => {
    const { result, unmount } = renderHook(() => useGymTracker());
    act(() => result.current.startWorkout());
    const exerciseId = result.current.data.activeWorkout!.exercises[0].id;
    act(() => result.current.addSet(exerciseId));
    const before = result.current.data.activeWorkout!;
    const originalSet = before.exercises[0].sets[0];
    act(() => {
      result.current.updateSet(exerciseId, originalSet.id, { weight: 20, weightUnit: 'lb' });
      result.current.updateSet(exerciseId, originalSet.id, { reps: 10 });
    });
    expect(result.current.data.activeWorkout!.exercises[0].sets[0]).toMatchObject({ weight: 20, weightUnit: 'lb', reps: 10 });
    expect(originalSet).toMatchObject({ weight: null, weightUnit: 'kg', reps: null });
    expect(result.current.data.activeWorkout).not.toBe(before);
    expect(result.current.data.activeWorkout!.exercises[1]).toBe(before.exercises[1]);
    act(() => result.current.updateSet(exerciseId, originalSet.id, { weight: null, weightCleared: true }));
    const expected = { weight: null, weightCleared: true, weightUnit: 'lb', reps: 10 };
    expect(loadAppData().activeWorkout!.exercises[0].sets[0]).toMatchObject(expected);
    unmount();
    const restored = renderHook(() => useGymTracker());
    expect(restored.result.current.data.activeWorkout!.exercises[0].sets[0]).toMatchObject(expected);
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
