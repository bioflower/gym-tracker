/**
 * Upload pre-parsed workout history JSON directly to the backend API.
 *
 * Run the parser first:
 *   npx tsx scripts/import-history.ts workout.tsv -o history.json
 *
 * Then upload:
 *   npx tsx scripts/upload-history.ts history.json \
 *     --url http://localhost:8000 \
 *     --email you@example.com \
 *     --password yourpassword
 *
 * Environment variables (alternative to flags):
 *   API_URL      base URL, default http://localhost:8000
 *   API_EMAIL    account email
 *   API_PASSWORD account password
 *
 * The script is idempotent: it skips sessions whose date already exists on the server.
 */

import { readFileSync } from 'fs';
import * as readline from 'readline';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function arg(name: string, envVar: string, fallback?: string): string {
  const flagIdx = process.argv.indexOf(`--${name}`);
  if (flagIdx !== -1 && process.argv[flagIdx + 1]) return process.argv[flagIdx + 1];
  if (process.env[envVar]) return process.env[envVar]!;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required argument --${name} (or env ${envVar})`);
}

async function prompt(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    if (hidden) process.stdout.write(question);
    rl.question(hidden ? '' : question, answer => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

class ApiClient {
  private accessToken = '';

  constructor(private base: string) {
    this.base = base.replace(/\/$/, '');
  }

  async login(email: string, password: string): Promise<void> {
    const res = await fetch(`${this.base}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Login failed (${res.status}): ${body}`);
    }
    const data = await res.json() as { access: string };
    this.accessToken = data.access;
    console.error('  Logged in successfully.');
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${method} ${path} failed (${res.status}): ${text}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as T;
  }

  /** Fetch all pages of a paginated list endpoint. */
  private async fetchAll<T>(path: string): Promise<T[]> {
    const results: T[] = [];
    let url: string | null = `${this.base}${path}`;
    while (url) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (!res.ok) throw new Error(`GET ${url} failed (${res.status})`);
      const data = await res.json() as { results?: T[]; next?: string | null } | T[];
      if (Array.isArray(data)) {
        results.push(...data);
        url = null;
      } else {
        results.push(...(data.results ?? []));
        url = data.next ?? null;
      }
    }
    return results;
  }

  async getExercises(): Promise<Array<{ id: string; name: string }>> {
    return this.fetchAll('/api/workouts/exercises/');
  }

  async createExercise(data: {
    name: string;
    category: string;
    tracking_type: string;
  }): Promise<{ id: string }> {
    return this.request('POST', '/api/workouts/exercises/', data);
  }

  async getSessions(): Promise<Array<{ date: string }>> {
    return this.fetchAll('/api/workouts/sessions/');
  }

  async createSession(data: unknown): Promise<{ id: string }> {
    return this.request('POST', '/api/workouts/sessions/', data);
  }
}

// ---------------------------------------------------------------------------
// Types (matches import-history.ts output)
// ---------------------------------------------------------------------------

interface ImportedSet {
  id: string;
  type: string;
  weight?: number | null;
  weightUnit?: string;
  reps?: number | null;
  durationSeconds?: number | null;
  distance?: number | null;
  distanceUnit?: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

interface ImportedExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  trackingType: string;
  startedAt?: string | null;
  completedAt?: string | null;
  sets: ImportedSet[];
}

interface ImportedSession {
  id: string;
  workoutDayId: string;
  workoutName: string;
  date: string;
  startedAt: string | null;
  completedAt: string | null;
  status: string;
  exercises: ImportedExercise[];
}

interface ImportFile {
  sessions: ImportedSession[];
  customExercises: Array<{
    id: string;
    name: string;
    category: string;
    trackingType: string;
    isPreset: boolean;
  }>;
}

// ---------------------------------------------------------------------------
// Build the API payload for a session
// ---------------------------------------------------------------------------

function buildSessionPayload(session: ImportedSession, exerciseIdMap: Map<string, string>) {
  return {
    workout_day: null,
    workout_name: session.workoutName,
    date: session.date,
    started_at: session.startedAt,
    completed_at: session.completedAt,
    status: session.status,
      exercises: session.exercises.map(ex => ({
      // Prefer server ID from map (covers both custom and preset lookups by name),
      // fall back to the local UUID from import-history.ts (last resort)
      exercise: exerciseIdMap.get(ex.exerciseName.toLowerCase()) ?? exerciseIdMap.get(ex.exerciseId) ?? ex.exerciseId,
      exercise_name: ex.exerciseName,
      tracking_type: ex.trackingType,
      started_at: ex.startedAt ?? null,
      completed_at: ex.completedAt ?? null,
      sets: ex.sets.map(s => ({
        type: s.type,
        weight: s.weight ?? null,
        weight_unit: s.weightUnit ?? null,
        reps: s.reps ?? null,
        duration_seconds: s.durationSeconds ?? null,
        distance: s.distance ?? null,
        distance_unit: s.distanceUnit ?? null,
        started_at: s.startedAt ?? null,
        completed_at: s.completedAt ?? null,
        completed: true,
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // -- Parse arguments -------------------------------------------------------
  const inputArgs = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (!inputArgs.length) {
    console.error('Usage: npx tsx scripts/upload-history.ts history.json [--url URL] [--email EMAIL] [--password PASSWORD]');
    process.exit(1);
  }

  const inputPath = inputArgs[0];
  const base      = arg('url',   'API_URL',      'http://localhost:8000');
  let   email     = (() => { try { return arg('email',    'API_EMAIL'); } catch { return ''; } })();
  let   password  = (() => { try { return arg('password', 'API_PASSWORD'); } catch { return ''; } })();

  if (!email)    email    = await prompt('Email: ');
  if (!password) password = await prompt('Password: ', true);

  // -- Load history file ------------------------------------------------------
  console.error(`\nReading: ${inputPath}`);
  const imported: ImportFile = JSON.parse(readFileSync(inputPath, 'utf-8'));
  console.error(`  ${imported.sessions.length} sessions, ${imported.customExercises.length} custom exercises`);

  // -- Login ------------------------------------------------------------------
  const api = new ApiClient(base);
  console.error(`\nConnecting to: ${base}`);
  await api.login(email, password);

  // -- Resolve exercises -------------------------------------------------------
  // Map: lowercased exercise name → server UUID  (covers both presets and custom)
  // Map: local UUID (from import-history.ts)    → server UUID  (custom exercises)
  const exerciseIdMap = new Map<string, string>();

  console.error('\nFetching server exercise list…');
  const serverExercises = await api.getExercises();
  // Seed map with ALL server exercises by name so preset UUIDs resolve correctly
  for (const e of serverExercises) {
    exerciseIdMap.set(e.name.toLowerCase(), e.id);
  }
  console.error(`  ${serverExercises.length} exercises on server`);

  // Resolve custom exercises (those not in the server preset list)
  const allSessionExercises = imported.sessions.flatMap(s => s.exercises);

  // Collect every exercise referenced in sessions that the server doesn't know about
  const missingByName = new Map<string, { exerciseId: string; exerciseName: string; trackingType: string }>();
  for (const ex of allSessionExercises) {
    if (!exerciseIdMap.has(ex.exerciseName.toLowerCase())) {
      missingByName.set(ex.exerciseName.toLowerCase(), ex);
    }
  }

  // Also include explicitly listed custom exercises
  for (const ce of imported.customExercises) {
    if (!exerciseIdMap.has(ce.name.toLowerCase())) {
      missingByName.set(ce.name.toLowerCase(), {
        exerciseId: ce.id,
        exerciseName: ce.name,
        trackingType: ce.trackingType,
      });
    }
  }

  if (missingByName.size > 0) {
    console.error(`\nCreating ${missingByName.size} missing exercise(s) on server…`);
    for (const ex of missingByName.values()) {
      const created = await api.createExercise({
        name: ex.exerciseName,
        category: 'other',
        tracking_type: ex.trackingType,
      });
      console.error(`  Created "${ex.exerciseName}" → ${created.id}`);
      exerciseIdMap.set(ex.exerciseName.toLowerCase(), created.id);
      exerciseIdMap.set(ex.exerciseId, created.id);
      await sleep(100);
    }
  }

  // -- Find already-uploaded dates so we can skip them -----------------------
  console.error('\nFetching existing sessions from server…');
  const existing = await api.getSessions();
  const existingDates = new Set(existing.map(s => s.date));
  console.error(`  ${existingDates.size} sessions already on server`);

  const toUpload = imported.sessions.filter(s => !existingDates.has(s.date));
  const skipped  = imported.sessions.length - toUpload.length;
  if (skipped > 0) console.error(`  Skipping ${skipped} session(s) (date already exists)`);
  console.error(`  Uploading ${toUpload.length} session(s)…`);

  // -- Upload sessions --------------------------------------------------------
  let ok = 0;
  let failed = 0;

  for (const session of toUpload) {
    const payload = buildSessionPayload(session, exerciseIdMap);
    try {
      await api.createSession(payload);
      console.error(`  ✓  ${session.date}  ${session.workoutName}`);
      ok++;
    } catch (err) {
      console.error(`  ✗  ${session.date}  ${session.workoutName}  — ${(err as Error).message}`);
      failed++;
    }
    await sleep(150); // gentle rate limiting
  }

  // -- Summary ----------------------------------------------------------------
  console.error(`\nDone: ${ok} uploaded, ${skipped} skipped (already existed), ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
