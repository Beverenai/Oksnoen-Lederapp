// Background sync queue for offline data persistence

export interface SyncQueueItem {
  id: string;
  type: 'insert' | 'update' | 'delete';
  table: string;
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

const SYNC_QUEUE_KEY = 'oksnoen_sync_queue';
const MAX_RETRIES = 3;

export function getSyncQueue(): SyncQueueItem[] {
  try {
    const stored = localStorage.getItem(SYNC_QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>): void {
  const queue = getSyncQueue();
  const newItem: SyncQueueItem = {
    ...item,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    retryCount: 0,
  };
  queue.push(newItem);
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  console.log('[SyncQueue] Added item to queue:', newItem.id, newItem.type, newItem.table);
}

export function removeFromSyncQueue(id: string): void {
  const queue = getSyncQueue().filter(item => item.id !== id);
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  console.log('[SyncQueue] Removed item from queue:', id);
}

export function incrementRetryCount(id: string): boolean {
  const queue = getSyncQueue();
  const item = queue.find(i => i.id === id);
  
  if (!item) return false;
  
  item.retryCount += 1;
  
  if (item.retryCount >= MAX_RETRIES) {
    // Remove after max retries
    const filteredQueue = queue.filter(i => i.id !== id);
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filteredQueue));
    console.log('[SyncQueue] Max retries reached, removing item:', id);
    return false;
  }
  
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  return true;
}

export function clearSyncQueue(): void {
  localStorage.removeItem(SYNC_QUEUE_KEY);
  console.log('[SyncQueue] Queue cleared');
}

export function getQueueCount(): number {
  return getSyncQueue().length;
}
