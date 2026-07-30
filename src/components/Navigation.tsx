import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function Navigation() {
  const { logout } = useAuth();

  return (
    <nav className="navigation" aria-label="Main navigation">
      <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        Today
      </NavLink>
      <NavLink to="/plan" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        Plan
      </NavLink>
      <NavLink to="/exercises" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        Exercises
      </NavLink>
      <NavLink to="/history" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        History
      </NavLink>
      <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        Settings
      </NavLink>
      <button className="nav-link logout-btn" onClick={logout}>
        Logout
      </button>
    </nav>
  );
}
