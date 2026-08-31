import { useEffect, useState } from 'react';
import { diffSeconds, formatClock } from '../utils/dateTime';

interface LiveTimerProps {
  startAt: string;
}

export function LiveTimer({ startAt }: LiveTimerProps) {
  const [elapsed, setElapsed] = useState(() => diffSeconds(startAt, new Date().toISOString()));

  useEffect(() => {
    setElapsed(diffSeconds(startAt, new Date().toISOString()));
    const interval = setInterval(() => {
      setElapsed(diffSeconds(startAt, new Date().toISOString()));
    }, 1000);
    return () => clearInterval(interval);
  }, [startAt]);

  return <span className="live-timer">{formatClock(elapsed)}</span>;
}
