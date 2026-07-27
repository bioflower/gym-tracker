import { useState } from 'react';
import { useGymTracker } from '../hooks/useGymTracker';

export function SettingsPage() {
  const { resetAll } = useGymTracker();
  const [showConfirm, setShowConfirm] = useState(false);

  function handleReset() {
    resetAll();
    setShowConfirm(false);
  }

  return (
    <div className="settings-page">
      <h1>Settings</h1>
      <div className="settings-section">
        <h2>Data</h2>
        <button className="btn btn-danger" onClick={() => setShowConfirm(true)}>
          Reset Demo Data
        </button>
        {showConfirm && (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Reset confirmation">
            <div className="modal">
              <p>Reset all data? This will delete your workout history, custom exercises, and plan changes.</p>
              <div className="modal-actions">
                <button className="btn btn-danger" onClick={handleReset}>Reset All Data</button>
                <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
