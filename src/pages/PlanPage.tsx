import { useState } from 'react';
import { useGymTracker } from '../hooks/useGymTracker';
import type { WorkoutDay, PlannedExercise } from '../types/gym';
import { generateId, validateWorkoutDayName } from '../utils/validation';

export function PlanPage() {
  const { data, updateWorkoutPlan, getAllExercises } = useGymTracker();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newDayName, setNewDayName] = useState('');
  const [showAddExercise, setShowAddExercise] = useState<string | null>(null);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);

  const allExercises = getAllExercises();

  function handleRename(dayId: string, name: string) {
    const error = validateWorkoutDayName(name);
    if (error) return;
    updateWorkoutPlan(data.workoutPlan.map(d => d.id === dayId ? { ...d, name } : d));
    setEditingId(null);
  }

  function handleDelete(dayId: string) {
    updateWorkoutPlan(
      data.workoutPlan.filter(d => d.id !== dayId).map((d, i) => ({ ...d, position: i }))
    );
  }

  function handleMove(dayId: string, direction: -1 | 1) {
    const idx = data.workoutPlan.findIndex(d => d.id === dayId);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= data.workoutPlan.length) return;
    const plan = [...data.workoutPlan];
    [plan[idx], plan[newIdx]] = [plan[newIdx], plan[idx]];
    updateWorkoutPlan(plan.map((d, i) => ({ ...d, position: i })));
  }

  function handleAddDay() {
    const error = validateWorkoutDayName(newDayName);
    if (error) return;
    const newDay: WorkoutDay = {
      id: generateId(),
      name: newDayName,
      position: data.workoutPlan.length,
      exercises: [],
    };
    updateWorkoutPlan([...data.workoutPlan, newDay]);
    setNewDayName('');
  }

  function handleAddExercise(dayId: string, exerciseId: string) {
    const day = data.workoutPlan.find(d => d.id === dayId);
    if (!day) return;
    const newExercise: PlannedExercise = {
      id: generateId(),
      exercise: exerciseId,
      position: day.exercises.length,
      target_sets: 3,
    };
    updateWorkoutPlan(data.workoutPlan.map(d =>
      d.id === dayId ? { ...d, exercises: [...d.exercises, newExercise] } : d
    ));
    setShowAddExercise(null);
  }

  function handleRemoveExercise(dayId: string, exerciseId: string) {
    updateWorkoutPlan(data.workoutPlan.map(d =>
      d.id === dayId
        ? { ...d, exercises: d.exercises.filter(e => e.id !== exerciseId).map((e, i) => ({ ...e, position: i })) }
        : d
    ));
  }

  function handleChangeExercise(dayId: string, plannedExerciseId: string, newExerciseId: string) {
    updateWorkoutPlan(data.workoutPlan.map(d =>
      d.id === dayId
        ? { ...d, exercises: d.exercises.map(e =>
            e.id === plannedExerciseId ? { ...e, exercise: newExerciseId } : e
          ) }
        : d
    ));
    setEditingExerciseId(null);
  }

  function handleMoveExercise(dayId: string, exerciseId: string, direction: -1 | 1) {
    const day = data.workoutPlan.find(d => d.id === dayId);
    if (!day) return;
    const idx = day.exercises.findIndex(e => e.id === exerciseId);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= day.exercises.length) return;
    const exercises = [...day.exercises];
    [exercises[idx], exercises[newIdx]] = [exercises[newIdx], exercises[idx]];
    updateWorkoutPlan(data.workoutPlan.map(d =>
      d.id === dayId ? { ...d, exercises: exercises.map((e, i) => ({ ...e, position: i })) } : d
    ));
  }

  return (
    <div className="plan-page">
      <h1>Workout Plan</h1>
      {data.workoutPlan.map((day, idx) => (
        <div key={day.id} className="plan-day-card">
          <div className="plan-day-header">
            {editingId === day.id ? (
              <input
                className="input"
                defaultValue={day.name}
                onBlur={e => handleRename(day.id, e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRename(day.id, (e.target as HTMLInputElement).value)}
                autoFocus
              />
            ) : (
              <h2 onClick={() => setEditingId(day.id)}>{day.name}</h2>
            )}
            <div className="plan-day-controls">
              <button className="btn btn-small" onClick={() => handleMove(day.id, -1)} disabled={idx === 0}>↑</button>
              <button className="btn btn-small" onClick={() => handleMove(day.id, 1)} disabled={idx === data.workoutPlan.length - 1}>↓</button>
              <button className="btn btn-small btn-danger-outline" onClick={() => handleDelete(day.id)}>✕</button>
            </div>
          </div>
          <div className="plan-exercise-list">
            {day.exercises.map((ex, exIdx) => {
              const exerciseDef = allExercises.find(e => e.id === ex.exercise);
              return (
                <div key={ex.id} className="plan-exercise-row">
                  {editingExerciseId === ex.id ? (
                    <select
                      className="input"
                      defaultValue={ex.exercise}
                      onChange={e => handleChangeExercise(day.id, ex.id, e.target.value)}
                      onBlur={() => setEditingExerciseId(null)}
                      autoFocus
                    >
                      {allExercises.map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span onClick={() => setEditingExerciseId(ex.id)}>{exerciseDef?.name ?? 'Unknown'}</span>
                  )}
                  <div className="plan-exercise-controls">
                    <button className="btn btn-small" onClick={() => handleMoveExercise(day.id, ex.id, -1)} disabled={exIdx === 0}>↑</button>
                    <button className="btn btn-small" onClick={() => handleMoveExercise(day.id, ex.id, 1)} disabled={exIdx === day.exercises.length - 1}>↓</button>
                    <button className="btn btn-small btn-danger-outline" onClick={() => handleRemoveExercise(day.id, ex.id)}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="plan-add-exercise">
            <button className="btn btn-outline btn-small" onClick={() => setShowAddExercise(day.id)}>+ Add Exercise</button>
            {showAddExercise === day.id && (
              <div className="exercise-picker">
                <select
                  className="input"
                  defaultValue=""
                  onChange={e => { if (e.target.value) handleAddExercise(day.id, e.target.value); }}
                  autoFocus
                >
                  <option value="" disabled>Select exercise...</option>
                  {allExercises.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      ))}
      <div className="plan-add-day">
        <input
          className="input"
          placeholder="New workout name"
          value={newDayName}
          onChange={e => setNewDayName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddDay()}
        />
        <button className="btn btn-primary" onClick={handleAddDay}>Add Workout Day</button>
      </div>
    </div>
  );
}
