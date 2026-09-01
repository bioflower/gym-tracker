/**
 * Import historical workout data from a Google Sheets TSV export.
 *
 * Usage:
 *   npx tsx scripts/import-history.ts workout.tsv          # write to stdout
 *   npx tsx scripts/import-history.ts workout.tsv -o history.json
 *
 * The output JSON can be loaded into the app via the browser console:
 *   const sessions = JSON.parse('<paste JSON here>');
 *   const key = 'gym-tracker-data-v1';
 *   const data = JSON.parse(localStorage.getItem(key));
 *   data.workoutHistory = [...sessions, ...data.workoutHistory];
 *   localStorage.setItem(key, JSON.stringify(data));
 *   location.reload();
 *
 * Expected TSV columns (tab-separated, first row = header):
 *   date  exercise  weight  reps  done  start  end  max_rep  weight_kg  1rm_kg  ratio  vol_kg  time
 */

import { readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Types (mirrors src/types/gym.ts — kept inline so script is self-contained)
// ---------------------------------------------------------------------------

interface CompletedSet {
  id: string;
  type: 'weight-reps' | 'reps' | 'duration' | 'distance-duration';
  weight?: number | null;
  weightUnit?: 'kg' | 'lb';
  reps?: number | null;
  durationSeconds?: number | null;
  distance?: number | null;
  distanceUnit?: 'km' | 'm' | 'mi';
  startedAt?: string | null;
  completedAt?: string | null;
}

interface CompletedExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  trackingType: 'weight-reps' | 'reps' | 'duration' | 'distance-duration';
  startedAt?: string | null;
  completedAt?: string | null;
  sets: CompletedSet[];
}

interface WorkoutSession {
  id: string;
  workoutDayId: string;
  workoutName: string;
  date: string;         // YYYY-MM-DD
  startedAt: string | null;
  completedAt: string | null;
  status: 'completed' | 'skipped';
  exercises: CompletedExercise[];
}

// ---------------------------------------------------------------------------
// Exercise name → preset exercise ID mapping
// Keys are lowercased spreadsheet names (partial matches welcome).
// ---------------------------------------------------------------------------

const PRESET_MAP: Record<string, { id: string; name: string; trackingType: CompletedSet['type'] }> = {
  // Lower body
  'db deadlift':            { id: '0a1b2c3d-0001-4000-8000-000000000001', name: 'Dumbbell Deadlift',      trackingType: 'weight-reps' },
  'dumbbell deadlift':      { id: '0a1b2c3d-0001-4000-8000-000000000001', name: 'Dumbbell Deadlift',      trackingType: 'weight-reps' },
  'bb deadlift': {id: '9226f74f-8c3f-43e5-b789-2829be6d2344', name: 'Barbell Deadlift', trackingType: 'weight-reps'},
  'hip abductor': {id: '16a24225-bb6b-41f9-9d87-7630ab9ca8d9', name: 'Hip Abductor', trackingType: 'weight-reps'},
  'db goblet squat':        { id: '0a1b2c3d-0001-4000-8000-000000000002', name: 'Goblet Squat',           trackingType: 'weight-reps' },
  'goblet squat':           { id: '0a1b2c3d-0001-4000-8000-000000000002', name: 'Goblet Squat',           trackingType: 'weight-reps' },
  'db lunge':               { id: '0a1b2c3d-0001-4000-8000-000000000003', name: 'Dumbbell Lunge',         trackingType: 'weight-reps' },
  'bb lunge': {id: '0a1b2c3d-0001-4000-8000-000000000009', name: 'Barbell Lunge', trackingType: 'weight-reps'},
  'barbell lunge':          { id: '0a1b2c3d-0001-4000-8000-000000000009', name: 'Barbell Lunge',          trackingType: 'weight-reps' },
  'dumbbell lunge':         { id: '0a1b2c3d-0001-4000-8000-000000000003', name: 'Dumbbell Lunge',         trackingType: 'weight-reps' },
  'db romanian deadlift':   { id: '0a1b2c3d-0001-4000-8000-000000000004', name: 'Romanian Deadlift',      trackingType: 'weight-reps' },
  'romanian deadlift':      { id: '0a1b2c3d-0001-4000-8000-000000000004', name: 'Romanian Deadlift',      trackingType: 'weight-reps' },
  'bb squat':               { id: '0a1b2c3d-0001-4000-8000-000000000005', name: 'Barbell Squat',          trackingType: 'weight-reps' },
  'barbell squat':          { id: '0a1b2c3d-0001-4000-8000-000000000005', name: 'Barbell Squat',          trackingType: 'weight-reps' },
  'leg press':              { id: '0a1b2c3d-0001-4000-8000-000000000006', name: 'Leg Press',              trackingType: 'weight-reps' },
  'hip thrust':             { id: '0a1b2c3d-0001-4000-8000-000000000007', name: 'Hip Thrust',             trackingType: 'weight-reps' },
  'bb hip thrust': {id: '0a1b2c3d-0001-4000-8000-000000000007', name: 'Hip Thrust',             trackingType: 'weight-reps' }, 
  'calf raise':             { id: '0a1b2c3d-0001-4000-8000-000000000008', name: 'Calf Raise',             trackingType: 'weight-reps' },
  'bb calf raise': {id: 'd846748e-8a7a-48c1-939e-74688aff4ce5', name: 'Barbell Calf Raise', trackingType: 'weight-reps'},
  'hip adductor': {id: '8915d078-a1ce-40c5-ad0f-5f69188f9bf9', name: 'Hip Adductor', trackingType: 'weight-reps'},
  // Chest
  'push up':                { id: '0a1b2c3d-0002-4000-8000-000000000001', name: 'Push-up',                trackingType: 'reps' },
  'push-up':                { id: '0a1b2c3d-0002-4000-8000-000000000001', name: 'Push-up',                trackingType: 'reps' },
  'pushup':                 { id: '0a1b2c3d-0002-4000-8000-000000000001', name: 'Push-up',                trackingType: 'reps' },
  'bb bench press':         { id: '0a1b2c3d-0002-4000-8000-000000000002', name: 'Bench Press',            trackingType: 'weight-reps' },
  'barbell bench press':    { id: '0a1b2c3d-0002-4000-8000-000000000002', name: 'Bench Press',            trackingType: 'weight-reps' },
  'db bench press':         { id: '0a1b2c3d-0002-4000-8000-000000000003', name: 'Dumbbell Bench Press',   trackingType: 'weight-reps' },
  'dumbbell bench press':   { id: '0a1b2c3d-0002-4000-8000-000000000003', name: 'Dumbbell Bench Press',   trackingType: 'weight-reps' },
  'incline db press':       { id: '0a1b2c3d-0002-4000-8000-000000000004', name: 'Incline Dumbbell Press', trackingType: 'weight-reps' },
  'incline dumbbell press': { id: '0a1b2c3d-0002-4000-8000-000000000004', name: 'Incline Dumbbell Press', trackingType: 'weight-reps' },
  'chest fly':              { id: '0a1b2c3d-0002-4000-8000-000000000005', name: 'Chest Fly',              trackingType: 'weight-reps' },
  'db fly':                 { id: '0a1b2c3d-0002-4000-8000-000000000005', name: 'Chest Fly',              trackingType: 'weight-reps' },
  // Back
  'db row':                 { id: '0a1b2c3d-0003-4000-8000-000000000001', name: 'Dumbbell Row',           trackingType: 'weight-reps' },
  'dumbbell row':           { id: '0a1b2c3d-0003-4000-8000-000000000001', name: 'Dumbbell Row',           trackingType: 'weight-reps' },
  'bb row':                 { id: '0a1b2c3d-0003-4000-8000-000000000002', name: 'Barbell Row',            trackingType: 'weight-reps' },
  'barbell row':            { id: '0a1b2c3d-0003-4000-8000-000000000002', name: 'Barbell Row',            trackingType: 'weight-reps' },
  'lat pulldown':           { id: '0a1b2c3d-0003-4000-8000-000000000003', name: 'Lat Pulldown',           trackingType: 'weight-reps' },
  'pull down':              { id: '0a1b2c3d-0003-4000-8000-000000000003', name: 'Lat Pulldown',           trackingType: 'weight-reps' },
  'pulldown':               { id: '0a1b2c3d-0003-4000-8000-000000000003', name: 'Lat Pulldown',           trackingType: 'weight-reps' },
  'pull-up':                { id: '0a1b2c3d-0003-4000-8000-000000000004', name: 'Pull-up',                trackingType: 'reps' },
  'pull up':                { id: '0a1b2c3d-0003-4000-8000-000000000004', name: 'Pull-up',                trackingType: 'reps' },
  'pull up with band': {id: '5f2c413b-ede0-4a1d-963a-80b1af80fd2c', name: 'Pull-up with Band', trackingType: 'reps'},
  'seated cable row':       { id: '0a1b2c3d-0003-4000-8000-000000000005', name: 'Seated Cable Row',       trackingType: 'weight-reps' },
  // Shoulders
  'db shoulder press':      { id: '0a1b2c3d-0004-4000-8000-000000000001', name: 'Shoulder Press',         trackingType: 'weight-reps' },
  'bb shoulder press': {id: '28ccb5da-8695-4aa7-8cf8-98c15513fc62', name: 'Barbell Shoulder Press', trackingType: 'weight-reps'},
  'shoulder press':         { id: '0a1b2c3d-0004-4000-8000-000000000001', name: 'Shoulder Press',         trackingType: 'weight-reps' },
  'lateral raise':          { id: '0a1b2c3d-0004-4000-8000-000000000002', name: 'Lateral Raise',          trackingType: 'weight-reps' },
  'db lateral raise':       { id: '0a1b2c3d-0004-4000-8000-000000000002', name: 'Lateral Raise',          trackingType: 'weight-reps' },
  'front raise':            { id: '0a1b2c3d-0004-4000-8000-000000000003', name: 'Front Raise',            trackingType: 'weight-reps' },
  'db front raise':         { id: '0a1b2c3d-0004-4000-8000-000000000003', name: 'Front Raise',            trackingType: 'weight-reps' },
  // Arms
  'db curl':                { id: '0a1b2c3d-0005-4000-8000-000000000001', name: 'Dumbbell Curl',          trackingType: 'weight-reps' },
  'dumbbell curl':          { id: '0a1b2c3d-0005-4000-8000-000000000001', name: 'Dumbbell Curl',          trackingType: 'weight-reps' },
  'bicep curl':             { id: '0a1b2c3d-0005-4000-8000-000000000001', name: 'Dumbbell Curl',          trackingType: 'weight-reps' },
  'hammer curl':            { id: '0a1b2c3d-0005-4000-8000-000000000002', name: 'Hammer Curl',            trackingType: 'weight-reps' },
  'triceps extension':      { id: '0a1b2c3d-0005-4000-8000-000000000003', name: 'Triceps Extension',      trackingType: 'weight-reps' },
  'tricep extension':       { id: '0a1b2c3d-0005-4000-8000-000000000003', name: 'Triceps Extension',      trackingType: 'weight-reps' },
  'triceps pushdown':       { id: '0a1b2c3d-0005-4000-8000-000000000004', name: 'Triceps Pushdown',       trackingType: 'weight-reps' },
  'tricep pushdown':        { id: '0a1b2c3d-0005-4000-8000-000000000004', name: 'Triceps Pushdown',       trackingType: 'weight-reps' },
  'db kickback': {id: '785ca6b9-306d-4a1e-9902-d3274457c94c', name: 'Dumbbell Kickback', trackingType: 'weight-reps'},
  'm triceps': {id: 'dbbfd113-32ea-4e51-9d6e-68e0928c40e3', name: 'Machine Triceps', trackingType: 'weight-reps'},
  'm row': {id: '6e3a473e-f1cf-4376-b8ad-45361acc8df4', name: 'Machine Row', trackingType: 'weight-reps'},
  'cable chest': {id: 'b463cf31-f11f-4c43-99f1-213bcc1bd530', name: 'Cable Chest', trackingType: 'weight-reps'},
  'cable triceps': {id: '9ce4dcfa-a18c-4f65-90db-d4910c8ffecf', name: 'Cable Triceps', trackingType: 'weight-reps'},
  'bench dip': {id: '7ef897a1-d558-486a-88d2-f026fb65b5fc', name: 'Bench Dip', trackingType: 'reps'},
  'dip': {id: '722c635f-e2f6-4750-8700-35f058df58e9', name: 'Dip', trackingType: 'reps'},
  // Core
  'crunch':                 { id: '0a1b2c3d-0006-4000-8000-000000000001', name: 'Crunch',                 trackingType: 'reps' },
  'crunches':               { id: '0a1b2c3d-0006-4000-8000-000000000001', name: 'Crunch',                 trackingType: 'reps' },
  'plank':                  { id: '0a1b2c3d-0006-4000-8000-000000000002', name: 'Plank',                  trackingType: 'duration' },
  'side plank':             { id: '0a1b2c3d-0006-4000-8000-000000000003', name: 'Side Plank',             trackingType: 'duration' },
  'lying leg raise':        { id: '0a1b2c3d-0006-4000-8000-000000000004', name: 'Lying Leg Raise',        trackingType: 'reps' },
  'leg raise':              { id: '0a1b2c3d-0006-4000-8000-000000000004', name: 'Lying Leg Raise',        trackingType: 'reps' },
  'russian twist':          { id: '0a1b2c3d-0006-4000-8000-000000000005', name: 'Russian Twist',          trackingType: 'reps' },
  'leg hand raise': {id: '0e3e6367-8651-48e1-b2ea-ae7aa2e1caf2', name: 'Leg Hand Raise', trackingType: 'reps'},
  'swiper': {id: 'b75f6964-846f-41e0-b7d2-fa3466060752', name: 'Swiper', trackingType: 'reps'},
  'hanging leg raise': {id: 'd759fb61-e2c2-4f02-ae4e-9199acfe4043', name: 'Hanging Leg Raise', trackingType: 'reps'},
  'roman chair': {id: 'bb42a962-f062-463a-956e-b38a1438b04e', name: 'Roman Chair', trackingType: 'weight-reps'},
  'lying abductor': {id: '82cedb28-8ac0-457d-8304-93b2bf797d3e', name: 'Lying Abductor', trackingType: 'reps'}
};

// ---------------------------------------------------------------------------
// Custom exercise registry — populated for any unmapped exercise name.
// Each unique unmapped name gets a stable generated ID within this run.
// ---------------------------------------------------------------------------

const customExerciseRegistry = new Map<
  string,
  { id: string; name: string; trackingType: CompletedSet['type'] }
>();

function resolveExercise(rawName: string, weightKg: number): {
  id: string;
  name: string;
  trackingType: CompletedSet['type'];
  isCustom: boolean;
} {
  const key = rawName.toLowerCase().trim();
  const preset = PRESET_MAP[key];
  if (preset) return { ...preset, isCustom: false };

  // Fall back to custom exercise
  if (!customExerciseRegistry.has(key)) {
    const trackingType: CompletedSet['type'] = weightKg > 0 ? 'weight-reps' : 'reps';
    // Expand common abbreviations then capitalise
    const expanded = rawName
      .replace(/\bdb\b/gi, 'Dumbbell')
      .replace(/\bbb\b/gi, 'Barbell');
    const displayName = expanded
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    customExerciseRegistry.set(key, {
      id: randomUUID(),
      name: displayName,
      trackingType,
    });
  }
  return { ...customExerciseRegistry.get(key)!, isCustom: true };
}

// ---------------------------------------------------------------------------
// TSV parsing
// ---------------------------------------------------------------------------

interface RawRow {
  date: string;        // YYYY-MM-DD
  exercise: string;
  weight: string;      // e.g. "6kg" or ""
  reps: string;        // e.g. "10,10,10"
  done: string;        // "1" or "0"
  start: string;       // e.g. "6:45" or ""
  end: string;         // e.g. "6:52" or ""
  weight_kg: string;   // numeric string
  // remaining columns ignored
}

function parseTime(date: string, hhmm: string): string | null {
  if (!hhmm.trim()) return null;
  // hhmm might be "6:45" or "06:45"
  const [h, m] = hhmm.trim().split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  const [year, month, day] = date.split('-').map(Number);
  // Construct using local date parts so the time is treated as the user's
  // local workout time, not UTC. .toISOString() then gives the correct UTC
  // representation, which the browser converts back to local time on display.
  return new Date(year, month - 1, day, h, m, 0).toISOString();
}

function parseTsv(content: string): RawRow[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('File must have a header row and at least one data row');

  const headers = lines[0].split('\t').map(h => h.trim().toLowerCase());
  const idx = (name: string) => {
    const i = headers.indexOf(name);
    if (i === -1) throw new Error(`Missing column: "${name}". Found: ${headers.join(', ')}`);
    return i;
  };

  const col = {
    date:      idx('date'),
    exercise:  idx('exercise'),
    weight:    idx('weight'),
    reps:      idx('reps'),
    done:      idx('done'),
    start:     idx('start'),
    end:       idx('end'),
    weight_kg: idx('weight_kg'),
  };

  return lines.slice(1).map((line, i) => {
    const cells = line.split('\t');
    return {
      date:      cells[col.date]?.trim() ?? '',
      exercise:  cells[col.exercise]?.trim() ?? '',
      weight:    cells[col.weight]?.trim() ?? '',
      reps:      cells[col.reps]?.trim() ?? '',
      done:      cells[col.done]?.trim() ?? '0',
      start:     cells[col.start]?.trim() ?? '',
      end:       cells[col.end]?.trim() ?? '',
      weight_kg: cells[col.weight_kg]?.trim() ?? '0',
    };
  }).filter((r, i) => {
    if (!r.date || !r.exercise) {
      console.warn(`  Row ${i + 2}: skipped (missing date or exercise)`);
      return false;
    }
    if (r.done !== '1') {
      console.warn(`  Row ${i + 2}: skipped (done=${r.done}, exercise="${r.exercise}")`);
      return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Weight parsing
// ---------------------------------------------------------------------------

/**
 * Resolve numeric weight and unit from a row.
 *
 * Priority:
 *   1. weight_kg column (already numeric, always in kg) — used when non-zero
 *   2. weight column string (e.g. "80lb", "6kg") — fallback when weight_kg is
 *      absent or zero, preserves the original unit
 */
function resolveWeight(row: RawRow): { value: number; unit: 'kg' | 'lb' } {
  const kg = parseFloat(row.weight_kg);
  if (!isNaN(kg) && kg > 0) return { value: kg, unit: 'kg' };

  // Parse the raw weight string, e.g. "80lb", "6kg", "6 kg", "80 lb"
  const match = row.weight.trim().match(/^([\d.]+)\s*(lb|kg)?$/i);
  if (match) {
    const value = parseFloat(match[1]);
    const unit: 'kg' | 'lb' = match[2]?.toLowerCase() === 'lb' ? 'lb' : 'kg';
    return { value, unit };
  }

  return { value: 0, unit: 'kg' };
}

// ---------------------------------------------------------------------------
// Row → sets
// ---------------------------------------------------------------------------

function buildSets(row: RawRow, trackingType: CompletedSet['type']): CompletedSet[] {
  const repsList = row.reps
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n));

  const { value: weight, unit: weightUnit } = resolveWeight(row);

  return repsList.map(repCount => {
    const base: CompletedSet = { id: randomUUID(), type: trackingType };
    if (trackingType === 'weight-reps') {
      return { ...base, weight, weightUnit, reps: repCount };
    }
    if (trackingType === 'reps') {
      return { ...base, reps: repCount };
    }
    // duration / distance-duration rows in the spreadsheet won't normally reach here
    // (they don't have comma-separated reps) — treat as reps fallback
    return { ...base, reps: repCount };
  });
}

// ---------------------------------------------------------------------------
// Group rows into WorkoutSessions (one per date)
// ---------------------------------------------------------------------------

function buildSessions(rows: RawRow[]): WorkoutSession[] {
  // Group by date preserving order
  const byDate = new Map<string, RawRow[]>();
  for (const row of rows) {
    const existing = byDate.get(row.date) ?? [];
    existing.push(row);
    byDate.set(row.date, existing);
  }

  const sessions: WorkoutSession[] = [];

  for (const [date, dateRows] of byDate) {
    const exercises: CompletedExercise[] = [];

    for (const row of dateRows) {
      const { value: weightValue } = resolveWeight(row);
      const resolved = resolveExercise(row.exercise, weightValue);
      const sets = buildSets(row, resolved.trackingType);

      const startedAt  = parseTime(date, row.start);
      const completedAt = parseTime(date, row.end);

      exercises.push({
        id: randomUUID(),
        exerciseId:   resolved.id,
        exerciseName: resolved.name,
        trackingType: resolved.trackingType,
        startedAt,
        completedAt,
        sets,
      });
    }

    // Session timestamps: first exercise start → last exercise end
    const allStarts = exercises.map(e => e.startedAt).filter(Boolean) as string[];
    const allEnds   = exercises.map(e => e.completedAt).filter(Boolean) as string[];
    const sessionStart = allStarts.length ? allStarts[0] : null;
    const sessionEnd   = allEnds.length   ? allEnds[allEnds.length - 1] : null;

    // Derive a workout name from the dominant muscle groups
    const workoutName = deriveWorkoutName(exercises);

    sessions.push({
      id:            randomUUID(),
      workoutDayId:  randomUUID(),   // no plan linkage for historical data
      workoutName,
      date,
      startedAt:    sessionStart ?? `${date}T00:00:00.000Z`,
      completedAt:  sessionEnd   ?? `${date}T00:00:00.000Z`,
      status:       'completed',
      exercises,
    });
  }

  // Return newest-first (matches app convention)
  return sessions.sort((a, b) => b.date.localeCompare(a.date));
}

// ---------------------------------------------------------------------------
// Derive a human-readable workout name from the exercises present
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  '0a1b2c3d-0001': 'Lower Body',
  '0a1b2c3d-0002': 'Chest',
  '0a1b2c3d-0003': 'Back',
  '0a1b2c3d-0004': 'Shoulders',
  '0a1b2c3d-0005': 'Arms',
  '0a1b2c3d-0006': 'Core',
  '0a1b2c3d-0007': 'Cardio',
};

function deriveWorkoutName(exercises: CompletedExercise[]): string {
  const counts = new Map<string, number>();
  for (const ex of exercises) {
    let prefix = ex.exerciseId.slice(0, 13); // e.g. "0a1b2c3d-0001"
    if (!CATEGORY_LABELS[prefix]) {
      // Fallback for known custom IDs or name-based categories (e.g. Barbell Lunge was previously a custom UUID)
      const nameKey = ex.exerciseName.toLowerCase().trim();
      // Explicit custom-ID fallback (legacy Barbell Lunge UUIDs)
      const LEGACY_LUNGE_IDS = new Set(['e7ddbbde-8ecc-4ffa-b0c9-68a48d184eec', '6f64f3f3-6190-44de-bca2-079a108358b0']);
      if (LEGACY_LUNGE_IDS.has(ex.exerciseId) || nameKey === 'barbell lunge' || nameKey === 'bb lunge') {
        prefix = '0a1b2c3d-0001'; // Lower Body
      } else if (nameKey.includes('lunge')) {
        prefix = '0a1b2c3d-0001';
      } else {
        continue; // skip truly custom/other exercises
      }
    }
    counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const labels = sorted
    .slice(0, 2)
    .map(([prefix]) => CATEGORY_LABELS[prefix]);
  return labels.length ? labels.join(' + ') : 'Imported Workout';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('Usage: npx tsx scripts/import-history.ts <input.tsv> [-o output.json]');
    process.exit(1);
  }

  const inputPath  = args[0];
  const outputFlag = args.indexOf('-o');
  const outputPath = outputFlag !== -1 ? args[outputFlag + 1] : null;

  console.error(`Reading: ${inputPath}`);
  const content = readFileSync(inputPath, 'utf-8');

  console.error('Parsing rows…');
  const rows = parseTsv(content);
  console.error(`  ${rows.length} valid rows`);

  console.error('Building sessions…');
  const sessions = buildSessions(rows);
  console.error(`  ${sessions.length} sessions`);

  // Report custom (unmapped) exercises
  if (customExerciseRegistry.size > 0) {
    console.error('\nUnmapped exercises (created as custom):');
    for (const [key, val] of customExerciseRegistry) {
      console.error(`  "${key}" → "${val.name}" (${val.trackingType}) id=${val.id}`);
    }
    console.error(
      '\nIf you want these to match preset exercises, add them to PRESET_MAP in the script\n' +
      'and re-run. Otherwise they will appear as custom exercises in the app.\n'
    );
  }

  // Build the custom exercises array so the app can look them up by ID
  const customExercises = [...customExerciseRegistry.values()].map(e => ({
    id: e.id,
    name: e.name,
    category: 'other' as const,
    trackingType: e.trackingType,
    isPreset: false,
  }));

  const output = {
    sessions,       // import into data.workoutHistory
    customExercises // merge into data.customExercises
  };

  const json = JSON.stringify(output, null, 2);

  if (outputPath) {
    writeFileSync(outputPath, json, 'utf-8');
    console.error(`\nWritten to: ${outputPath}`);
  } else {
    process.stdout.write(json + '\n');
  }

  console.error(`
=== How to import into the app ===

1. Open the app in your browser and open DevTools console (F12).
2. Paste and run:

const imported = <paste the JSON here>;
const KEY = 'gym-tracker-data-v1';
const data = JSON.parse(localStorage.getItem(KEY) || '{}');
// Merge sessions (avoid duplicates by date)
const existingDates = new Set((data.workoutHistory || []).map(s => s.date));
const newSessions = imported.sessions.filter(s => !existingDates.has(s.date));
data.workoutHistory = [...newSessions, ...(data.workoutHistory || [])];
// Merge custom exercises
const existingIds = new Set((data.customExercises || []).map(e => e.id));
const newCustom = imported.customExercises.filter(e => !existingIds.has(e.id));
data.customExercises = [...(data.customExercises || []), ...newCustom];
localStorage.setItem(KEY, JSON.stringify(data));
console.log('Imported', newSessions.length, 'sessions and', newCustom.length, 'custom exercises.');
location.reload();
`);
}

main();
