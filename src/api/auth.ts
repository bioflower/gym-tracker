import { apiRequest, setTokens, clearTokens, getTokens } from './client';

interface User {
  id: string;
  email: string;
  created_at: string;
}

export async function register(email: string, password: string): Promise<User> {
  return apiRequest<User>('/auth/register/', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email: string, password: string): Promise<void> {
  const data = await apiRequest<{ access: string; refresh: string }>('/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setTokens(data);
}

export async function getMe(): Promise<User> {
  return apiRequest<User>('/auth/me/');
}

export function logout(): void {
  clearTokens();
}

export function isAuthenticated(): boolean {
  return getTokens() !== null;
}
