import { useState, useCallback, useEffect } from 'react';
import type {
  AppData, ActiveWorkoutSession, ActiveExercise,
  Exercise, ExerciseSet, WorkoutSession, WeightRepSet,
  RepsOnlySet, DurationSet, DistanceDurationSet,
  TrackingType, WorkoutDay,
} from '../types/gym';
import { loadAppData, saveAppData, clearAppData, getDefaultAppData } from '../utils/storage';
import { advanceWorkout, getCurrentWorkout } from '../utils/rotation';
import { convertActiveToCompletedExercise } from '../utils/exerciseHistory';
import { generateId } from '../utils/validation';
import { getTodayISO, nowISO } from '../utils/dateTime';
import { presetExercises } from '../data/presetExercises';

export function useGymTracker() {
  const [data, setData] = useState<AppData>(() => loadAppData());

  useEffect(() => {
    saveAppData(data);
  }, [data]);

  const createEmptySets = (trackingType: TrackingType, count: number = 3): ExerciseSet[] => {
    const sets: ExerciseSet[] = [];
    for (let i = 0; i < count; i++) {
      const id = generateId();
      if (trackingType === 'weight-reps') {
        sets.push({ id, weight: null, weightUnit: 'kg', reps: null, completed: false } as WeightRepSet);
      } else if (trackingType === 'reps') {
        sets.push({ id, reps: null, completed: false } as RepsOnlySet);
      } else if (trackingType === 'duration') {
        sets.push({ id, durationSeconds: null, completed: false } as DurationSet);
      } else {
        sets.push({ id, distance: null, distanceUnit: 'km', durationSeconds: null, notes: '', completed: false } as DistanceDurationSet);
      }
    }
    return sets;
  };

  const getAllExercises = useCallback((): Exercise[] => {
    return [...presetExercises, ...data.customExercises];
  }, [data.customExercises]);

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
        trackingType: exerciseDef?.trackingType ?? 'reps',
        startedAt: null,
        completedAt: null,
        completed: false,
        sets: createEmptySets(exerciseDef?.trackingType ?? 'reps', pe.targetSets),
        notes: pe.notes ?? '',
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
  }, [data.workoutPlan, data.currentWorkoutIndex, data.customExercises]);

  const getCurrentWorkoutDay = useCallback((): WorkoutDay | null => {
    return getCurrentWorkout(data.workoutPlan, data.currentWorkoutIndex);
  }, [data.workoutPlan, data.currentWorkoutIndex]);

  const finishWorkout = useCallback(() => {
    if (!data.activeWorkout) return;
    const completedExercises = data.activeWorkout.exercises.map(convertActiveToCompletedExercise);
    const session: WorkoutSession = {
      id: data.activeWorkout.id,
      workoutDayId: data.activeWorkout.workoutDayId,
      workoutName: data.activeWorkout.workoutName,
      date: data.activeWorkout.date,
      startedAt: data.activeWorkout.startedAt,
      completedAt: nowISO(),
      status: 'completed',
      exercises: completedExercises,
    };
    setData(prev => ({
      ...prev,
      activeWorkout: null,
      workoutHistory: [session, ...prev.workoutHistory],
      currentWorkoutIndex: advanceWorkout(prev.workoutPlan, prev.currentWorkoutIndex),
    }));
  }, [data.activeWorkout, data.workoutPlan, data.currentWorkoutIndex]);

  const skipWorkout = useCallback(() => {
    const workout = getCurrentWorkout(data.workoutPlan, data.currentWorkoutIndex);
    if (!workout) return;
    const session: WorkoutSession = {
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
      workoutHistory: [session, ...prev.workoutHistory],
      currentWorkoutIndex: advanceWorkout(prev.workoutPlan, prev.currentWorkoutIndex),
    }));
  }, [data.workoutPlan, data.currentWorkoutIndex]);

  const startExercise = useCallback((exerciseId: string) => {
    setData(prev => {
      if (!prev.activeWorkout) return prev;
      return {
        ...prev,
        activeWorkout: {
          ...prev.activeWorkout,
          exercises: prev.activeWorkout.exercises.map(e =>
            e.id === exerciseId ? { ...e, startedAt: nowISO() } : e
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
            e.id === exerciseId ? { ...e, completed: true, completedAt: nowISO() } : e
          ),
        },
      };
    });
  }, []);

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
  }, []);

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

  const addCustomExercise = useCallback((exercise: Exercise) => {
    setData(prev => ({
      ...prev,
      customExercises: [...prev.customExercises, exercise],
    }));
  }, []);

  const editCustomExercise = useCallback((id: string, updates: Partial<Exercise>) => {
    setData(prev => ({
      ...prev,
      customExercises: prev.customExercises.map(e =>
        e.id === id ? { ...e, ...updates } : e
      ),
    }));
  }, []);

  const removeCustomExercise = useCallback((id: string) => {
    setData(prev => ({
      ...prev,
      customExercises: prev.customExercises.filter(e => e.id !== id),
    }));
  }, []);

  const updateWorkoutPlan = useCallback((plan: WorkoutDay[]) => {
    setData(prev => ({ ...prev, workoutPlan: plan }));
  }, []);

  const addWorkoutDay = useCallback((day: WorkoutDay) => {
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

  return {
    data,
    startWorkout,
    getCurrentWorkoutDay,
    finishWorkout,
    skipWorkout,
    startExercise,
    completeExercise,
    updateSet,
    addSet,
    removeSet,
    addCustomExercise,
    editCustomExercise,
    removeCustomExercise,
    updateWorkoutPlan,
    addWorkoutDay,
    resetAll,
    getAllExercises,
    getNextWorkout,
  };
}
