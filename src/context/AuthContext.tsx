import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import * as auth from '../api/auth';

interface User {
  id: string;
  email: string;
  created_at: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (auth.isAuthenticated()) {
      auth.getMe()
        .then(setUser)
        .catch(() => auth.logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await auth.login(email, password);
    const me = await auth.getMe();
    setUser(me);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    await auth.register(email, password);
    await auth.login(email, password);
    const me = await auth.getMe();
    setUser(me);
  }, []);

  const logout = useCallback(() => {
    auth.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
