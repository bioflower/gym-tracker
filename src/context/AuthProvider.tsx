import { useState, useEffect, useCallback, type ReactNode } from 'react';
import * as auth from '../api/auth';
import { AuthContext, type User } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(auth.isAuthenticated);

  useEffect(() => {
    if (!loading) return;
    auth.getMe()
      .then(setUser)
      .catch(() => auth.logout())
      .finally(() => setLoading(false));
  }, [loading]);

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
