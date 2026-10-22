import { act, render, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as auth from '../api/auth';
import { AuthProvider } from '../context/AuthProvider';
import { useAuth } from '../hooks/useAuth';

vi.mock('../api/auth', () => ({
  isAuthenticated: vi.fn(), getMe: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn(),
}));

const user = { id: 'user-1', email: 'test@example.com', created_at: '2026-01-01T00:00:00Z' };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(auth.isAuthenticated).mockReturnValue(false);
  vi.mocked(auth.getMe).mockResolvedValue(user);
  vi.mocked(auth.login).mockResolvedValue(undefined);
  vi.mocked(auth.register).mockResolvedValue(user);
});

describe('AuthProvider', () => {
  it('starts signed-out consumers without an unnecessary loading render or profile request', () => {
    const loadingStates: boolean[] = [];
    function Consumer() {
      loadingStates.push(useAuth().loading);
      return null;
    }
    render(<AuthProvider><Consumer /></AuthProvider>);
    expect(loadingStates).toEqual([false]);
    expect(auth.getMe).not.toHaveBeenCalled();
  });

  it('loads the profile before finishing authenticated initialization', async () => {
    vi.mocked(auth.isAuthenticated).mockReturnValue(true);
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toEqual(user);
    expect(auth.getMe).toHaveBeenCalledTimes(1);
  });

  it('clears tokens and finishes loading when profile initialization fails', async () => {
    vi.mocked(auth.isAuthenticated).mockReturnValue(true);
    vi.mocked(auth.getMe).mockRejectedValue(new Error('Expired token'));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  it.each(['login', 'register'] as const)('%s populates the user and logout clears it', async action => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => result.current[action](user.email, 'password'));
    expect(auth[action]).toHaveBeenCalledWith(user.email, 'password');
    expect(result.current.user).toEqual(user);
    act(() => result.current.logout());
    expect(result.current.user).toBeNull();
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });
});
