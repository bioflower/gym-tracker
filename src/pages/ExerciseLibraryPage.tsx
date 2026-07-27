import { useState } from 'react';
import { useGymTracker } from '../hooks/useGymTracker';
import { CustomExerciseForm } from '../components/CustomExerciseForm';
import type { ExerciseCategory } from '../types/gym';

export function ExerciseLibraryPage() {
  const { getAllExercises, removeCustomExercise } = useGymTracker();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<ExerciseCategory | 'all'>('all');

  const allExercises = getAllExercises();

  const categories: { value: ExerciseCategory | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'lower-body', label: 'Lower Body' },
    { value: 'chest', label: 'Chest' },
    { value: 'back', label: 'Back' },
    { value: 'shoulders', label: 'Shoulders' },
    { value: 'arms', label: 'Arms' },
    { value: 'core', label: 'Core' },
    { value: 'cardio', label: 'Cardio' },
    { value: 'other', label: 'Other' },
  ];

  const filtered = filter === 'all'
    ? allExercises
    : allExercises.filter(e => e.category === filter);

  return (
    <div className="exercise-library-page">
      <h1>Exercise Library</h1>
      <div className="filter-bar">
        {categories.map(cat => (
          <button
            key={cat.value}
            className={`btn btn-small ${filter === cat.value ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter(cat.value)}
          >
            {cat.label}
          </button>
        ))}
      </div>
      <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Custom Exercise</button>
      {showForm && <CustomExerciseForm onClose={() => setShowForm(false)} />}
      <div className="exercise-grid">
        {filtered.map(ex => (
          <div key={ex.id} className="exercise-item">
            <div className="exercise-item-info">
              <strong>{ex.name}</strong>
              <span className="exercise-item-meta">{ex.category} · {ex.trackingType}</span>
              {ex.equipment && <span className="exercise-item-meta">Equipment: {ex.equipment}</span>}
              {!ex.isPreset && <span className="badge badge-custom">Custom</span>}
            </div>
            {!ex.isPreset && (
              <button
                className="btn btn-small btn-danger-outline"
                onClick={() => removeCustomExercise(ex.id)}
                aria-label={`Remove ${ex.name}`}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
