import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { ReactNode } from 'react';

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
