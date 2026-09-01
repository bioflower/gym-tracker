import { useState } from 'react';
import { useGymTracker } from '../hooks/useGymTracker';
import { formatDate, formatTime, formatDurationFromDates } from '../utils/dateTime';

function getDisplayWorkoutName(
  session: { workoutName: string; exercises: { exerciseId: string; exerciseName: string }[] },
  allExercises: { id: string; category: string }[],
): string {
  // Correct legacy title where Barbell Lunge (Lower Body) was missed and session was labeled only "Back"
  // Derive categories from exercise definitions with name fallback for legacy custom IDs.
  const categoryLabels: Record<string, string> = {
    'lower-body': 'Lower Body',
    'chest': 'Chest',
    'back': 'Back',
    'shoulders': 'Shoulders',
    'arms': 'Arms',
    'core': 'Core',
    'cardio': 'Cardio',
  };
  const counts = new Map<string, number>();
  for (const ex of session.exercises) {
    const def = allExercises.find(e => e.id === ex.exerciseId);
    let cat: string | null = def?.category ?? null;
    if (!cat) {
      const n = ex.exerciseName.toLowerCase().trim();
      if (n === 'barbell lunge' || n === 'bb lunge' || n.includes('lunge')) cat = 'lower-body';
      else if (n === 'lat pulldown') cat = 'back';
    }
    if (!cat || !categoryLabels[cat]) continue;
    const label = categoryLabels[cat];
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const derived = sorted.slice(0, 2).map(([label]) => label).join(' + ');
  // Only override the known buggy case: stored "Back" but derived is "Back + Lower Body" (or "Lower Body + Back")
  if (derived && session.workoutName === 'Back' && derived.includes('Lower Body') && derived.includes('Back')) {
    return 'Back + Lower Body';
  }
  return session.workoutName;
}

export function HistoryPage() {
  const { data } = useGymTracker();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const allExercises = [...data.presetExercises, ...data.customExercises];

  return (
    <div className="history-page">
      <h1>Workout History</h1>
      {data.workoutHistory.length === 0 && <p>No workouts yet.</p>}
      {data.workoutHistory.map(session => (
        <div key={session.id} className="history-card">
          <div className="history-card-header" onClick={() => setExpandedId(expandedId === session.id ? null : session.id)}>
            <div>
              <strong>{getDisplayWorkoutName(session, allExercises)}</strong>
              <span className="history-date">{formatDate(session.date)}</span>
            </div>
            <div className="history-meta">
              <span className={`badge ${session.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                {session.status === 'completed' ? 'Completed' : 'Skipped'}
              </span>
              <span>{formatTime(session.startedAt)} – {formatTime(session.completedAt)}</span>
            </div>
          </div>
          {expandedId === session.id && session.status === 'completed' && (
            <div className="history-card-body">
              <p>Duration: {formatDurationFromDates(session.startedAt, session.completedAt)}</p>
              <p>Exercises: {session.exercises.length}</p>
              {session.exercises.map(ex => (
                <div key={ex.id} className="history-exercise">
                  <div className="history-exercise-header">
                    <strong>{ex.exerciseName}</strong>
                    {ex.startedAt && ex.completedAt && (
                      <span className="history-exercise-duration">
                        {' '}{formatDurationFromDates(ex.startedAt, ex.completedAt)}
                      </span>
                    )}
                  </div>
                  {ex.sets.map((set, i) => (
                    <div key={set.id} className="history-set">
                      Set {i + 1}: {
                        set.type === 'weight-reps' ? `${set.weight} ${set.weightUnit} × ${set.reps} reps` :
                        set.type === 'reps' ? `${set.reps} reps` :
                        set.type === 'duration' ? `${set.durationSeconds}s` :
                        `${set.distance} ${set.distanceUnit} in ${set.durationSeconds}s`
                      }
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
