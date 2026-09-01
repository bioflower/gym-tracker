import { useState } from 'react';
import { useGymTracker } from '../hooks/useGymTracker';
import { formatDate, formatTime, formatDurationFromDates } from '../utils/dateTime';
import historyFallback from '../../history.json';

// Fallback for per-exercise timestamps that are null in localStorage (e.g. after sync from server that drops them) — use repo history.json as source of truth.
const historyExerciseFallback = new Map<string, { startedAt: string | null; completedAt: string | null }>();
for (const s of (historyFallback as { sessions: { id: string; exercises: { id: string; exerciseId: string; startedAt: string | null; completedAt: string | null }[] }[] }).sessions) {
  for (const e of s.exercises) {
    historyExerciseFallback.set(e.id, { startedAt: e.startedAt ?? null, completedAt: e.completedAt ?? null });
  }
}
function getExerciseDuration(ex: { id: string; exerciseId: string; startedAt: string | null; completedAt: string | null }): string | null {
  let start = ex.startedAt;
  let end = ex.completedAt;
  if (!start || !end) {
    const fb = historyExerciseFallback.get(ex.id);
    if (fb) {
      start = start ?? fb.startedAt;
      end = end ?? fb.completedAt;
    }
  }
  if (!start || !end) return null;
  return formatDurationFromDates(start, end);
}

function getDisplayWorkoutName(
  session: { workoutName: string; exercises: { exerciseId: string; exerciseName: string }[] },
  allExercises: { id: string; category: string }[],
): string {
  // Correct legacy titles where custom UUIDs (no 0a1b2c3d- prefix) were skipped in deriveWorkoutName.
  const categoryLabels: Record<string, string> = {
    'lower-body': 'Lower Body',
    'chest': 'Chest',
    'back': 'Back',
    'shoulders': 'Shoulders',
    'arms': 'Arms',
    'core': 'Core',
    'cardio': 'Cardio',
  };
  const CUSTOM_NAME_TO_CATEGORY: Record<string, string> = {
    // lower-body
    'barbell deadlift': 'lower-body',
    'bb deadlift': 'lower-body',
    'hip abductor': 'lower-body',
    'barbell calf raise': 'lower-body',
    'bb calf raise': 'lower-body',
    'hip adductor': 'lower-body',
    'barbell hip thrust': 'lower-body',
    'hip thrust': 'lower-body',
    'bb hip thrust': 'lower-body',
    'lying abductor': 'lower-body',
    'barbell lunge': 'lower-body',
    'bb lunge': 'lower-body',
    // chest
    'cable chest': 'chest',
    // back
    'm row': 'back',
    'machine row': 'back',
    'pull up with band': 'back',
    'pull-up with band': 'back',
    // shoulders
    'barbell shoulder press': 'shoulders',
    'bb shoulder press': 'shoulders',
    // arms
    'cable triceps': 'arms',
    'm triceps': 'arms',
    'machine triceps': 'arms',
    'dumbbell kickback': 'arms',
    'db kickback': 'arms',
    'dip': 'arms',
    'bench dip': 'arms',
    // core
    'roman chair': 'core',
    'hanging leg raise': 'core',
    'leg hand raise': 'core',
    'swiper': 'core',
  };
  const LEGACY_ID_TO_CATEGORY: Record<string, string> = {
    '22b8f305-c618-4cfb-8059-902f1ddcfa35': 'lower-body',
    '7ba8cba2-0ffd-49e8-8cb3-6a71c711dffc': 'lower-body',
    'e2343a9f-9658-43b9-b749-9dc21df671ba': 'lower-body',
    '920e29d8-8af9-476a-aff9-8a35ee7c9d7a': 'lower-body',
    '5f918076-a512-450e-bbfd-0585b5e22e72': 'lower-body',
    '0900256e-cf58-4065-a9f8-fecd61cde06c': 'lower-body',
    'e7ddbbde-8ecc-4ffa-b0c9-68a48d184eec': 'lower-body',
    '6f64f3f3-6190-44de-bca2-079a108358b0': 'lower-body',
    'f618489d-ea31-4cb8-9fce-352b8833b54e': 'chest',
    '3631e61c-8384-4e4e-a49d-8c695d429a9c': 'back',
    '3cefe71e-ca52-4308-920a-1e7d17ce626a': 'back',
    'b110634c-6446-4b60-afa8-8329ec7b8f7c': 'shoulders',
    '28ccb5da-8695-4aa7-8cf8-98c15513fc62': 'shoulders',
    '051b1057-8bd1-44df-ba61-cd5155917d0a': 'arms',
    '40f2bfc6-3d02-4443-8926-11745013db41': 'arms',
    '6bcc5175-45da-4d89-91cc-591a554866c2': 'arms',
    '76595450-7abe-4cd5-87c2-1ab38f1558a7': 'arms',
    'b716a208-c0e7-4f98-bc7e-78fce049a1f7': 'arms',
    '29d7d4e0-d9fc-412e-af0f-28660d94dad4': 'core',
    'dbf4f627-87f1-45e3-9101-365aea995229': 'core',
    '5c65498f-fb1a-42be-918f-e5876857d2d2': 'core',
    'fac30305-cf51-4375-a371-bb70ff660151': 'core',
    'bb42a962-f062-463a-956e-b38a1438b04e': 'core',
    'd759fb61-e2c2-4f02-ae4e-9199acfe4043': 'core',
    '0e3e6367-8651-48e1-b2ea-ae7aa2e1caf2': 'core',
    'b75f6964-846f-41e0-b7d2-fa3466060752': 'core',
    '82cedb28-8ac0-457d-8304-93b2bf797d3e': 'lower-body',
  };
  const counts = new Map<string, number>();
  for (const ex of session.exercises) {
    const def = allExercises.find(e => e.id === ex.exerciseId);
    let cat: string | null = def && (def.category in categoryLabels) ? def.category : null;
    if (!cat) {
      const n = ex.exerciseName.toLowerCase().trim();
      cat = CUSTOM_NAME_TO_CATEGORY[n] ?? LEGACY_ID_TO_CATEGORY[ex.exerciseId] ?? null;
      if (!cat) {
        if (n.includes('lunge') || n.includes('deadlift') || n.includes('hip thrust') || n.includes('hip abductor') || n.includes('hip adductor') || n.includes('calf raise') || n.includes('abductor')) cat = 'lower-body';
        else if (n.includes('cable chest') || n.includes('bench press') || n.includes('chest fly')) cat = 'chest';
        else if (n.includes('row') || n.includes('pull') || n.includes('lat')) cat = 'back';
        else if (n.includes('shoulder press') || n.includes('lateral raise') || n.includes('front raise')) cat = 'shoulders';
        else if (n.includes('curl') || n.includes('kickback') || n.includes('triceps') || n.includes('tricep') || n.includes('dip') || n.includes('pushdown')) cat = 'arms';
        else if (n.includes('crunch') || n.includes('leg raise') || n.includes('roman chair') || n.includes('swiper') || n.includes('plank') || n.includes('russian twist')) cat = 'core';
      }
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
              {session.exercises.map(ex => {
                const duration = getExerciseDuration(ex as { id: string; exerciseId: string; startedAt: string | null; completedAt: string | null });
                return (
                <div key={ex.id} className="history-exercise">
                  <div className="history-exercise-header">
                    <strong>{ex.exerciseName}</strong>
                    {duration && (
                      <span className="history-exercise-duration">
                        {' '}{duration}
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
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
