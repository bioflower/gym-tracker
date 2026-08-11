import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupSyncListener, enqueue } from '../api/sync';

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));

import { apiRequest } from '../api/client';
const mockedApiRequest = vi.mocked(apiRequest);

describe('sync queue auto-flush', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    mockedApiRequest.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flushes pending queued items while online without waiting for an online event', async () => {
    const attempt = vi.fn().mockResolvedValue({});
    mockedApiRequest.mockImplementation(((endpoint: string) => {
      attempt(endpoint);
      return Promise.resolve({});
    }) as never);

    enqueue({ endpoint: '/workouts/sessions/', method: 'POST', body: { day: 'day-1' } });
    enqueue({ endpoint: '/workouts/sessions/', method: 'POST', body: { day: 'day-2' } });

    const cleanup = setupSyncListener();
    await vi.advanceTimersByTimeAsync(20000);

    expect(attempt).toHaveBeenCalledTimes(2);
    cleanup();
  });

  it('keeps failed items in the queue for a later retry', async () => {
    mockedApiRequest.mockResolvedValueOnce({});
    mockedApiRequest.mockRejectedValue(new Error('server down'));

    enqueue({ endpoint: '/workouts/sessions/', method: 'POST', body: { day: 'ok' } });
    enqueue({ endpoint: '/workouts/sessions/', method: 'POST', body: { day: 'fail' } });

    const cleanup = setupSyncListener();
    await vi.advanceTimersByTimeAsync(20000);

    // the failing item is retried across ticks but never dropped
    expect(mockedApiRequest.mock.calls.map(c => c[0])).toContain('/workouts/sessions/');
    const remaining = JSON.parse(localStorage.getItem('gym-tracker-sync-queue') || '[]');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].body.day).toBe('fail');
    cleanup();
  });
});