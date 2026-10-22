import { useState } from 'react';
import { changePassword } from '../api/auth';

export function AccountPage() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSubmitting(true);
    try {
      await changePassword(oldPassword, newPassword);
      setOldPassword('');
      setNewPassword('');
      setSuccess(true);
    } catch {
      setError('Could not change password. Check your current password; the new one needs 8+ characters.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <h1>Change Password</h1>
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-field">
          <label htmlFor="old-password">Current password</label>
          <input id="old-password" className="input" type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} required />
        </div>
        <div className="form-field">
          <label htmlFor="new-password">New password</label>
          <input id="new-password" className="input" type="password" minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
        </div>
        {error && <p className="error-message">{error}</p>}
        {success && <p>Password changed.</p>}
        <button className="btn btn-primary btn-large" type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Change Password'}
        </button>
      </form>
    </div>
  );
}
