import { useState } from 'react';
import { useGymTracker } from '../hooks/useGymTracker';
import type { Exercise, ExerciseCategory, TrackingType } from '../types/gym';
import { generateId, normalizeName } from '../utils/validation';

interface CustomExerciseFormProps {
  onClose: () => void;
}

export function CustomExerciseForm({ onClose }: CustomExerciseFormProps) {
  const { addCustomExercise, getAllExercises } = useGymTracker();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExerciseCategory>('other');
  const [trackingType, setTrackingType] = useState<TrackingType>('weight-reps');
  const [equipment, setEquipment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showDuplicate, setShowDuplicate] = useState(false);

  const existingExercises = getAllExercises();

  function handleSubmit() {
    const normalized = normalizeName(name);
    if (!normalized) {
      setError('Exercise name is required.');
      return;
    }
    const dup = existingExercises.find(e => normalizeName(e.name) === normalized);
    if (dup && !showDuplicate) {
      setError(`"${dup.name}" already exists. Click submit again to use this name.`);
      setShowDuplicate(true);
      return;
    }
    const exercise: Exercise = {
      id: generateId(),
      name: name.trim(),
      category,
      trackingType,
      equipment: equipment.trim() || undefined,
      isPreset: false,
    };
    addCustomExercise(exercise);
    onClose();
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Custom exercise form">
      <div className="modal">
        <h2>New Custom Exercise</h2>
        <div className="form-group">
          <label htmlFor="ex-name">Exercise Name</label>
          <input id="ex-name" className="input" value={name} onChange={e => { setName(e.target.value); setError(null); setShowDuplicate(false); }} />
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
        <div className="form-group">
          <label htmlFor="ex-category">Category</label>
          <select id="ex-category" className="input" value={category} onChange={e => setCategory(e.target.value as ExerciseCategory)}>
            <option value="lower-body">Lower Body</option>
            <option value="chest">Chest</option>
            <option value="back">Back</option>
            <option value="shoulders">Shoulders</option>
            <option value="arms">Arms</option>
            <option value="core">Core</option>
            <option value="cardio">Cardio</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="ex-tracking">Tracking Type</label>
          <select id="ex-tracking" className="input" value={trackingType} onChange={e => setTrackingType(e.target.value as TrackingType)}>
            <option value="weight-reps">Weight × Reps</option>
            <option value="reps">Reps Only</option>
            <option value="duration">Duration</option>
            <option value="distance-duration">Distance + Duration</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="ex-equipment">Equipment (optional)</label>
          <input id="ex-equipment" className="input" value={equipment} onChange={e => setEquipment(e.target.value)} />
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={handleSubmit}>Save Exercise</button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
