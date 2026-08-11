import { useState, useCallback, useEffect } from 'react';
import type {
  AppData, ActiveWorkoutSession, ActiveExercise,
  WorkoutDay, Exercise, ExerciseSet, WorkoutSession,
} from '../types/gym';
import { loadAppData, saveAppData, clearAppData, getDefaultAppData } from '../utils/storage';
import { advanceWorkout, getCurrentWorkout } from '../utils/rotation';
import { generateId } from '../utils/validation';
import { getTodayISO, nowISO } from '../utils/dateTime';
import { presetExercises } from '../data/presetExercises';
import * as workouts from '../api/workouts';
import { isOnline, enqueue, setupSyncListener } from '../api/sync';

export function useGymTracker() {
  const [data, setData] = useState<AppData>(() => loadAppData());

  // Sync on mount and when coming online
  useEffect(() => {
    const cleanup = setupSyncListener();
    if (isOnline()) {
      syncFromServer();
    }
    return cleanup;
  }, []);

  // Persist to localStorage on every change (offline cache)
  useEffect(() => {
    saveAppData(data);
  }, [data]);

  async function syncFromServer() {
    let exercises: Exercise[] | null = null;
    let plan: WorkoutDay[] | null = null;
    let sessions: WorkoutSession[] = [];

    try {
      exercises = await workouts.fetchExercises();
    } catch {
      // offline or server error — keep local cache
    }
    try {
      plan = await workouts.fetchPlan();
    } catch {
      // offline or server error — keep local cache
    }
    try {
      sessions = await workouts.fetchSessions();
    } catch {
      // offline or server error — keep local cache
    }

    setData(prev => ({
      ...prev,
      ...(exercises ? { customExercises: exercises.filter(e => !e.isPreset) } : {}),
      ...(plan && plan.length > 0 ? { workoutPlan: plan } : {}),
      ...(sessions.length > 0 ? { workoutHistory: sessions } : {}),
    }));
  }

  const createEmptySets = useCallback((trackingType: string, count: number = 3): ExerciseSet[] => {
    const sets: ExerciseSet[] = [];
    for (let i = 0; i < count; i++) {
      const id = generateId();
      const base = { id, startedAt: null as string | null, completedAt: null as string | null, completed: false };
      if (trackingType === 'weight-reps') {
        sets.push({ ...base, weight: null, weightUnit: 'kg', reps: null } as ExerciseSet);
      } else if (trackingType === 'reps') {
        sets.push({ ...base, reps: null } as ExerciseSet);
      } else if (trackingType === 'duration') {
        sets.push({ ...base, durationSeconds: null } as ExerciseSet);
      } else {
        sets.push({ ...base, distance: null, distanceUnit: 'km', durationSeconds: null, notes: '' } as ExerciseSet);
      }
    }
    return sets;
  }, []);

  const startWorkout = useCallback(() => {
    const workout = getCurrentWorkout(data.workoutPlan, data.currentWorkoutIndex);
    if (!workout) return;
    const allExercises: Exercise[] = [...presetExercises, ...data.customExercises];
    const exercises: ActiveExercise[] = workout.exercises.map(pe => {
      const exerciseDef = allExercises.find(e => e.id === pe.exerciseId);
      return {
        id: generateId(),
        exerciseId: pe.exerciseId,
        exerciseName: exerciseDef?.name ?? 'Unknown',
        trackingType: exerciseDef?.trackingType ?? ('reps' as const),
        sets: createEmptySets(exerciseDef?.trackingType ?? 'reps', pe.targetSets),
        notes: pe.notes ?? '',
        startedAt: null,
        completedAt: null,
        completed: false,
      };
    });
    const session: ActiveWorkoutSession = {
      id: generateId(),
      workoutDayId: workout.id,
      workoutName: workout.name,
      date: getTodayISO(),
      startedAt: nowISO(),
      completedAt: null,
      status: 'in-progress',
      exercises,
    };
    setData(prev => ({ ...prev, activeWorkout: session }));
  }, [data.workoutPlan, data.currentWorkoutIndex, data.customExercises, createEmptySets]);

  const getCurrentWorkoutDay = useCallback((): WorkoutDay | null => {
    return getCurrentWorkout(data.workoutPlan, data.currentWorkoutIndex);
  }, [data.workoutPlan, data.currentWorkoutIndex]);

  const finishWorkout = useCallback(async () => {
    if (!data.activeWorkout) return;
    const completedAt = nowISO();
    const sessionData: Record<string, unknown> = {
      workout_day: data.activeWorkout.workoutDayId,
      workout_name: data.activeWorkout.workoutName,
      date: data.activeWorkout.date,
      started_at: data.activeWorkout.startedAt,
      completed_at: completedAt,
      status: 'completed',
      exercises: data.activeWorkout.exercises.map(e => ({
        exercise: e.exerciseId,
        exercise_name: e.exerciseName,
        tracking_type: e.trackingType,
        sets: e.sets.map(s => ({
          type: e.trackingType,
          weight: 'weight' in s ? s.weight : null,
          weight_unit: 'weightUnit' in s ? s.weightUnit : null,
          reps: 'reps' in s ? s.reps : null,
          duration_seconds: 'durationSeconds' in s ? s.durationSeconds : null,
          distance: 'distance' in s ? s.distance : null,
          distance_unit: 'distanceUnit' in s ? s.distanceUnit : null,
          started_at: s.startedAt,
          completed_at: s.completedAt,
          completed: s.completed,
        })),
      })),
    };

    if (isOnline()) {
      try {
        await workouts.saveSession(sessionData as never);
      } catch {
        enqueue({ endpoint: '/workouts/sessions/', method: 'POST', body: sessionData });
      }
    } else {
      enqueue({ endpoint: '/workouts/sessions/', method: 'POST', body: sessionData });
    }

    const completedSession: WorkoutSession = {
      id: data.activeWorkout.id,
      workoutDayId: data.activeWorkout.workoutDayId,
      workoutName: data.activeWorkout.workoutName,
      date: data.activeWorkout.date,
      startedAt: data.activeWorkout.startedAt,
      completedAt,
      status: 'completed',
      exercises: data.activeWorkout.exercises.map(e => ({
        id: e.id,
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        trackingType: e.trackingType,
        startedAt: e.startedAt,
        completedAt: e.completedAt,
        sets: e.sets.map(s => ({
          id: s.id,
          type: e.trackingType,
          weight: 'weight' in s ? s.weight : null,
          weightUnit: 'weightUnit' in s ? s.weightUnit : null,
          reps: 'reps' in s ? s.reps : null,
          durationSeconds: 'durationSeconds' in s ? s.durationSeconds : null,
          distance: 'distance' in s ? s.distance : null,
          distanceUnit: 'distanceUnit' in s ? s.distanceUnit : null,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
          completed: s.completed,
        })),
      })),
    };

    setData(prev => ({
      ...prev,
      activeWorkout: null,
      currentWorkoutIndex: advanceWorkout(prev.workoutPlan, prev.currentWorkoutIndex),
      workoutHistory: prev.workoutHistory.some(s => s.id === completedSession.id)
        ? prev.workoutHistory
        : [completedSession, ...prev.workoutHistory],
    }));
  }, [data.activeWorkout, data.workoutPlan, data.currentWorkoutIndex]);

  const skipWorkout = useCallback(async () => {
    const workout = getCurrentWorkout(data.workoutPlan, data.currentWorkoutIndex);
    if (!workout) return;
    const sessionData: Record<string, unknown> = {
      workout_day: workout.id,
      workout_name: workout.name,
      date: getTodayISO(),
      started_at: null,
      completed_at: null,
      status: 'skipped',
      exercises: [],
    };

    if (isOnline()) {
      try {
        await workouts.saveSession(sessionData as never);
      } catch {
        enqueue({ endpoint: '/workouts/sessions/', method: 'POST', body: sessionData });
      }
    } else {
      enqueue({ endpoint: '/workouts/sessions/', method: 'POST', body: sessionData });
    }

    const skippedSession: WorkoutSession = {
      id: generateId(),
      workoutDayId: workout.id,
      workoutName: workout.name,
      date: getTodayISO(),
      startedAt: null,
      completedAt: null,
      status: 'skipped',
      exercises: [],
    };

    setData(prev => ({
      ...prev,
      activeWorkout: null,
      currentWorkoutIndex: advanceWorkout(prev.workoutPlan, prev.currentWorkoutIndex),
      workoutHistory: [skippedSession, ...prev.workoutHistory],
    }));
  }, [data.workoutPlan, data.currentWorkoutIndex, getCurrentWorkout]);

  const updateSet = useCallback((exerciseId: string, setId: string, updates: Partial<ExerciseSet>) => {
    setData(prev => {
      if (!prev.activeWorkout) return prev;
      return {
        ...prev,
        activeWorkout: {
          ...prev.activeWorkout,
          exercises: prev.activeWorkout.exercises.map(e =>
            e.id === exerciseId
              ? { ...e, sets: e.sets.map(s => (s.id === setId ? { ...s, ...updates } : s)) }
              : e
          ),
        },
      };
    });
  }, []);

  const addSet = useCallback((exerciseId: string) => {
    setData(prev => {
      if (!prev.activeWorkout) return prev;
      return {
        ...prev,
        activeWorkout: {
          ...prev.activeWorkout,
          exercises: prev.activeWorkout.exercises.map(e => {
            if (e.id !== exerciseId) return e;
            const newSet = createEmptySets(e.trackingType, 1)[0];
            return { ...e, sets: [...e.sets, newSet] };
          }),
        },
      };
    });
  }, [createEmptySets]);

  const removeSet = useCallback((exerciseId: string, setId: string) => {
    setData(prev => {
      if (!prev.activeWorkout) return prev;
      return {
        ...prev,
        activeWorkout: {
          ...prev.activeWorkout,
          exercises: prev.activeWorkout.exercises.map(e =>
            e.id === exerciseId
              ? { ...e, sets: e.sets.filter(s => s.id !== setId) }
              : e
          ),
        },
      };
    });
  }, []);

  const startExercise = useCallback((exerciseId: string) => {
    setData(prev => {
      if (!prev.activeWorkout) return prev;
      return {
        ...prev,
        activeWorkout: {
          ...prev.activeWorkout,
          exercises: prev.activeWorkout.exercises.map(e =>
            e.id === exerciseId && !e.startedAt
              ? { ...e, startedAt: nowISO(), completed: false }
              : e
          ),
        },
      };
    });
  }, []);

  const completeExercise = useCallback((exerciseId: string) => {
    setData(prev => {
      if (!prev.activeWorkout) return prev;
      return {
        ...prev,
        activeWorkout: {
          ...prev.activeWorkout,
          exercises: prev.activeWorkout.exercises.map(e =>
            e.id === exerciseId
              ? { ...e, completedAt: nowISO(), completed: true }
              : e
          ),
        },
      };
    });
  }, []);

  const addCustomExercise = useCallback(async (exercise: Exercise) => {
    setData(prev => ({
      ...prev,
      customExercises: [...prev.customExercises, exercise],
    }));
  }, []);

  const editCustomExercise = useCallback(async (id: string, updates: Partial<Exercise>) => {
    setData(prev => ({
      ...prev,
      customExercises: prev.customExercises.map(e =>
        e.id === id ? { ...e, ...updates } : e
      ),
    }));
  }, []);

  const removeCustomExercise = useCallback(async (id: string) => {
    setData(prev => ({
      ...prev,
      customExercises: prev.customExercises.filter(e => e.id !== id),
    }));
  }, []);

  const updateWorkoutPlan = useCallback(async (plan: WorkoutDay[]) => {
    setData(prev => ({ ...prev, workoutPlan: plan }));
    if (isOnline()) {
      try {
        await workouts.savePlan(plan);
      } catch {
        enqueue({ endpoint: '/workouts/plan/', method: 'PUT', body: plan });
      }
    } else {
      enqueue({ endpoint: '/workouts/plan/', method: 'PUT', body: plan });
    }
  }, []);

  const addWorkoutDay = useCallback(async (day: WorkoutDay) => {
    setData(prev => ({ ...prev, workoutPlan: [...prev.workoutPlan, day] }));
  }, []);

  const resetAll = useCallback(() => {
    clearAppData();
    setData(getDefaultAppData());
  }, []);

  const getNextWorkout = useCallback((): WorkoutDay | null => {
    const nextIndex = advanceWorkout(data.workoutPlan, data.currentWorkoutIndex);
    return getCurrentWorkout(data.workoutPlan, nextIndex);
  }, [data.workoutPlan, data.currentWorkoutIndex]);

  const getAllExercises = useCallback((): Exercise[] => {
    return [...presetExercises, ...data.customExercises];
  }, [data.customExercises]);

  return {
    data,
    startWorkout,
    getCurrentWorkoutDay,
    finishWorkout,
    skipWorkout,
    updateSet,
    addSet,
    removeSet,
    startExercise,
    completeExercise,
    addCustomExercise,
    editCustomExercise,
    removeCustomExercise,
    updateWorkoutPlan,
    addWorkoutDay,
    resetAll,
    getAllExercises,
    getNextWorkout,
    syncFromServer,
  };
}
