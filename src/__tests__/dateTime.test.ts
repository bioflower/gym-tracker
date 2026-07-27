import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatDate, getTodayISO } from '../utils/dateTime';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getTodayISO', () => {
  it('returns today date in YYYY-MM-DD format', () => {
    vi.setSystemTime(new Date('2026-07-27T12:00:00'));
    expect(getTodayISO()).toBe('2026-07-27');
  });

  it('uses local timezone, not UTC', () => {
    vi.setSystemTime(new Date('2026-07-27T23:00:00+10:00'));
    const result = getTodayISO();
    expect(result).toBe('2026-07-27');
  });

  it('works on the first day of the month', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00'));
    expect(getTodayISO()).toBe('2026-01-01');
  });

  it('works on the last day of the year', () => {
    vi.setSystemTime(new Date('2026-12-31T23:59:59'));
    expect(getTodayISO()).toBe('2026-12-31');
  });
});

describe('formatDate', () => {
  it('formats a date string correctly', () => {
    const result = formatDate('2026-07-27');
    expect(result).toContain('Jul');
    expect(result).toContain('27');
    expect(result).toContain('2026');
  });

  it('treats the date as local time', () => {
    const result = formatDate('2026-01-01');
    expect(result).toContain('Jan');
    expect(result).toContain('1');
    expect(result).toContain('2026');
  });

  it('handles single-digit months and days', () => {
    const result = formatDate('2026-03-05');
    expect(result).toContain('Mar');
    expect(result).toContain('5');
    expect(result).toContain('2026');
  });
});
