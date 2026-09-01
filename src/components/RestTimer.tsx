import { LiveTimer } from './LiveTimer';

interface RestTimerProps {
  previousCompletedAt: string;
}

export function RestTimer({ previousCompletedAt }: RestTimerProps) {
  return (
    <div className="rest-timer">
      <span className="rest-timer-label">Rest</span>
      <LiveTimer startAt={previousCompletedAt} />
    </div>
  );
}
