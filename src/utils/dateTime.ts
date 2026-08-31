export function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(dateString: string | null): string {
  if (!dateString) return '--';
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export function formatDurationFromDates(start: string | null, end: string | null): string {
  if (!start || !end) return '--';
  const diff = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  return formatDuration(diff);
}

export function getTodayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function diffSeconds(start: string, end: string): number {
  const diff = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  return Math.max(0, diff);
}

export function formatClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
