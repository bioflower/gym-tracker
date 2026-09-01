import { useEffect, useState } from 'react';
import { diffSeconds, formatClock } from '../utils/dateTime';

interface LiveTimerProps {
  startAt: string;
}

export function LiveTimer({ startAt }: LiveTimerProps) {
  const [, forceTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      forceTick(tick => tick + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [startAt]);

  const elapsed = diffSeconds(startAt, new Date().toISOString());

  return <span className="live-timer">{formatClock(elapsed)}</span>;
}
