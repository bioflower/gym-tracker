import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await register(email, password);
      navigate('/');
    } catch {
      setError('Registration failed. Email may already be in use.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <h1>Register</h1>
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="form-field">
          <label htmlFor="password">Password</label>
          <input id="password" className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
        </div>
        <div className="form-field">
          <label htmlFor="confirm">Confirm Password</label>
          <input id="confirm" className="input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
        </div>
        {error && <p className="error-message">{error}</p>}
        <button className="btn btn-primary btn-large" type="submit" disabled={submitting}>
          {submitting ? 'Registering…' : 'Register'}
        </button>
      </form>
      <p className="auth-alt">Already have an account? <Link to="/login">Log In</Link></p>
    </div>
  );
}
