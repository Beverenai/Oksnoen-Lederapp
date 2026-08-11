/**
 * Offline-kø for taleopptak. Lyden lagres i IndexedDB slik at et opptak aldri
 * forsvinner om nettet er borte eller appen lukkes midt i transkriberingen.
 */

const DB_NAME = 'voice-queue';
const STORE = 'recordings';
const DB_VERSION = 1;

export interface PendingRecording {
  id: string;
  blob: Blob;
  createdAt: number;
  attempts: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = fn(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

const listeners = new Set<() => void>();

export function subscribeVoiceQueue(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notify() {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.error('[voiceQueue] listener failed', e);
    }
  });
}

export async function enqueueRecording(blob: Blob): Promise<string> {
  const id = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await tx('readwrite', (store) => store.put({ id, blob, createdAt: Date.now(), attempts: 0 }));
  notify();
  return id;
}

export async function listRecordings(): Promise<PendingRecording[]> {
  try {
    const all = await tx<PendingRecording[]>('readonly', (store) => store.getAll() as IDBRequest<PendingRecording[]>);
    return (all ?? []).sort((a, b) => a.createdAt - b.createdAt);
  } catch (e) {
    console.error('[voiceQueue] kunne ikke lese kø', e);
    return [];
  }
}

export async function removeRecording(id: string): Promise<void> {
  await tx('readwrite', (store) => store.delete(id) as unknown as IDBRequest<undefined>);
  notify();
}

export async function markAttempt(id: string): Promise<void> {
  try {
    const rec = await tx<PendingRecording | undefined>('readonly', (store) => store.get(id));
    if (!rec) return;
    await tx('readwrite', (store) => store.put({ ...rec, attempts: (rec.attempts ?? 0) + 1 }));
    notify();
  } catch (e) {
    console.error('[voiceQueue] kunne ikke oppdatere forsøk', e);
  }
}
