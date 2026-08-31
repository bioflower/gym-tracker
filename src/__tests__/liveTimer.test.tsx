import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LiveTimer } from '../components/LiveTimer';

describe('LiveTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders 0:00 immediately when started now', () => {
    render(<LiveTimer startAt="2026-01-01T00:00:00.000Z" />);
    expect(screen.getByText('0:00')).toBeInTheDocument();
  });

  it('ticks up every second', () => {
    render(<LiveTimer startAt="2026-01-01T00:00:00.000Z" />);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('0:03')).toBeInTheDocument();
  });
});
