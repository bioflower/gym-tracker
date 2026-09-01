import { useState } from 'react';
import { useGymTracker } from '../hooks/useGymTracker';
import { formatDate, formatTime, formatDurationFromDates } from '../utils/dateTime';

export function HistoryPage() {
  const { data } = useGymTracker();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="history-page">
      <h1>Workout History</h1>
      {data.workoutHistory.length === 0 && <p>No workouts yet.</p>}
      {data.workoutHistory.map(session => (
        <div key={session.id} className="history-card">
          <div className="history-card-header" onClick={() => setExpandedId(expandedId === session.id ? null : session.id)}>
            <div>
              <strong>{session.workoutName}</strong>
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
                        {formatDurationFromDates(ex.startedAt, ex.completedAt)}
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
