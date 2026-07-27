import type { ActiveWorkoutSession } from '../types/gym';
import { formatDate } from '../utils/dateTime';

interface WorkoutHeaderProps {
  activeWorkout: ActiveWorkoutSession;
}

export function WorkoutHeader({ activeWorkout }: WorkoutHeaderProps) {
  const total = activeWorkout.exercises.length;
  const completed = activeWorkout.exercises.filter(e => e.completed).length;
  return (
    <div className="workout-header">
      <h1 className="workout-name">{activeWorkout.workoutName}</h1>
      <p className="workout-meta">{formatDate(activeWorkout.date)}</p>
      <p className="workout-progress">{completed} of {total} exercises completed</p>
    </div>
  );
}
