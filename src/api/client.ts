const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

interface Tokens {
  access: string;
  refresh: string;
}

function getTokens(): Tokens | null {
  const raw = localStorage.getItem('gym-tracker-tokens');
  if (!raw) return null;
  return JSON.parse(raw);
}

function setTokens(tokens: Tokens): void {
  localStorage.setItem('gym-tracker-tokens', JSON.stringify(tokens));
}

function clearTokens(): void {
  localStorage.removeItem('gym-tracker-tokens');
}

async function refreshAccessToken(refresh: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    setTokens({ access: data.access, refresh });
    return data.access;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const tokens = getTokens();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (tokens) {
    headers['Authorization'] = `Bearer ${tokens.access}`;
  }

  let res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  if (res.status === 401 && tokens) {
    const newAccess = await refreshAccessToken(tokens.refresh);
    if (newAccess) {
      headers['Authorization'] = `Bearer ${newAccess}`;
      res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    } else {
      clearTokens();
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export { getTokens, setTokens, clearTokens, API_BASE };
