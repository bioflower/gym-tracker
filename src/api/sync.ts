const SYNC_QUEUE_KEY = 'gym-tracker-sync-queue';
const SYNC_RETRY_INTERVAL_MS = 15000;

interface SyncQueueItem {
  id: string;
  endpoint: string;
  method: string;
  body: unknown;
  timestamp: string;
}

function getQueue(): SyncQueueItem[] {
  const raw = localStorage.getItem(SYNC_QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function setQueue(queue: SyncQueueItem[]): void {
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

export function enqueue(item: Omit<SyncQueueItem, 'id' | 'timestamp'>): void {
  const queue = getQueue();
  queue.push({ ...item, id: crypto.randomUUID(), timestamp: new Date().toISOString() });
  setQueue(queue);
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export async function processQueue(): Promise<void> {
  const queue = getQueue();
  if (queue.length === 0) return;

  const { apiRequest } = await import('./client');
  const remaining: SyncQueueItem[] = [];

  for (const item of queue) {
    try {
      await apiRequest(item.endpoint, {
        method: item.method,
        body: JSON.stringify(item.body),
      });
    } catch {
      remaining.push(item);
    }
  }

  setQueue(remaining);
}

export function setupSyncListener(): () => void {
  const flush = () => {
    if (navigator.onLine) {
      void processQueue();
    }
  };
  // Flush anything queued while offline the moment the app starts (or comes online).
  flush();
  const id = window.setInterval(flush, SYNC_RETRY_INTERVAL_MS);
  window.addEventListener('online', flush);
  return () => {
    window.clearInterval(id);
    window.removeEventListener('online', flush);
  };
}
