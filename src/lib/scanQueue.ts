// «Lageret»: skanninger lagres alltid først på telefonen, og sendes inn når
// det er nett. Hver skanning har sin egen ID, så den kan aldri telles to ganger.

import { supabase } from '@/integrations/supabase/client';

export type ScanState = 'venter' | 'ukjent';

export interface QueuedScan {
  client_scan_id: string;
  session_id?: string;
  code: string;
  activity: string;
  scanned_at: string;
  participant_id?: string | null;
  participant_name?: string | null;
  state: ScanState;
}

export interface FlushResult {
  sent: number;
  registered: number;
  duplicates: number;
  unknown: number;
  failed: boolean;
  outcomes: { scan: QueuedScan; status: string; gang?: number; participant_id?: string }[];
}

const KEY = 'oksnoen_qr_scan_queue_v1';
const EVENT = 'oksnoen-qr-queue';
const BATCH = 50;

function read(): QueuedScan[] {
  try {
    const stored = localStorage.getItem(KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(queue: QueuedScan[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('[ScanQueue] Kunne ikke lagre lageret', err);
  }
  try {
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ingen vindu */
  }
}

export function getScanQueue(): QueuedScan[] {
  return read();
}

export function getScanQueueCounts() {
  const queue = read();
  return {
    total: queue.length,
    waiting: queue.filter((s) => s.state === 'venter').length,
    unknown: queue.filter((s) => s.state === 'ukjent').length,
  };
}

export function addScan(scan: Omit<QueuedScan, 'client_scan_id' | 'state' | 'scanned_at'> & { scanned_at?: string }): QueuedScan {
  const item: QueuedScan = {
    ...scan,
    client_scan_id: crypto.randomUUID(),
    scanned_at: scan.scanned_at ?? new Date().toISOString(),
    state: 'venter',
  };
  write([...read(), item]);
  return item;
}

export function removeScan(clientScanId: string): boolean {
  const queue = read();
  const next = queue.filter((s) => s.client_scan_id !== clientScanId);
  if (next.length === queue.length) return false;
  write(next);
  return true;
}

export function subscribeScanQueue(listener: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener();
  };
  window.addEventListener(EVENT, listener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
}

let flushing: Promise<FlushResult> | null = null;

/** Sender lageret til serveren i bolker. Trygt å kalle flere ganger samtidig. */
export function flushScanQueue(): Promise<FlushResult> {
  if (flushing) return flushing;
  flushing = doFlush().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function doFlush(): Promise<FlushResult> {
  const result: FlushResult = { sent: 0, registered: 0, duplicates: 0, unknown: 0, failed: false, outcomes: [] };
  const snapshot = read();
  if (snapshot.length === 0) return result;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    result.failed = true;
    return result;
  }

  for (let i = 0; i < snapshot.length; i += BATCH) {
    const batch = snapshot.slice(i, i + BATCH);
    const payload = batch.map(({ client_scan_id, code, activity, scanned_at, session_id }) => ({
      client_scan_id,
      code,
      activity,
      scanned_at,
      session_id,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('record_wristband_scans', { _scans: payload });
    if (error) {
      console.error('[ScanQueue] Sending feilet', error);
      result.failed = true;
      break;
    }

    const rows: { client_scan_id: string; status: string; gang?: number; participant_id?: string }[] = Array.isArray(data) ? data : [];
    const done = new Set<string>();
    const unknown = new Set<string>();
    for (const row of rows) {
      const scan = batch.find(s => s.client_scan_id === row.client_scan_id);
      if (scan) result.outcomes.push({ scan, status: row.status, gang: row.gang, participant_id: row.participant_id });
      if (row.status === 'ukjent_band') {
        unknown.add(row.client_scan_id);
        result.unknown++;
      } else {
        done.add(row.client_scan_id);
        if (row.status === 'registrert' || row.status === 'gjentatt') result.registered++;
        else result.duplicates++;
      }
    }
    result.sent += batch.length;

    // Les lageret på nytt: det kan ha kommet nye skanninger mens vi sendte.
    const current = read()
      .filter((s) => !done.has(s.client_scan_id))
      .map((s) => (unknown.has(s.client_scan_id) ? { ...s, state: 'ukjent' as ScanState } : s));
    write(current);
  }

  return result;
}
