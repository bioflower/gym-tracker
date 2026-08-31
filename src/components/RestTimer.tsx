import { LiveTimer } from './LiveTimer';

interface RestTimerProps {
  previousCompletedAt: string;
  onStartNext: () => void;
}

export function RestTimer({ previousCompletedAt, onStartNext }: RestTimerProps) {
  return (
    <div className="rest-timer">
      <span className="rest-timer-label">Rest</span>
      <LiveTimer startAt={previousCompletedAt} />
      <button className="btn btn-primary btn-small" onClick={onStartNext}>Start Next Set</button>
    </div>
  );
}
