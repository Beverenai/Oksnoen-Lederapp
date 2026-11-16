import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivePeriodId } from '@/hooks/useActivePeriodId';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import {
  flushScanQueue,
  getScanQueueCounts,
  subscribeScanQueue,
  type FlushResult,
} from '@/lib/scanQueue';

/** Det skanneren trenger å vite om en deltaker, lagret på telefonen. */
export interface BandParticipant {
  id: string;
  name: string;
  image: string | null;
  cabin: string | null;
  room: string | null;
  birth_date: string | null;
  has_arrived?: boolean | null;
  arrived_at?: string | null;
}

export interface BandAssignment {
  code: string;
  participant_id: string;
  assigned_at: string;
}

export interface BandDirectory {
  participants: BandParticipant[];
  assignments: BandAssignment[];
  fetchedAt: string;
}

export type AssignResult =
  | { status: 'koblet' | 'uendret'; code: string }
  | { status: 'opptatt'; code: string; participant_id: string; participant_name: string | null };

const CACHE_PREFIX = 'oksnoen_qr_directory_v1_';

function readCache(periodId: string): BandDirectory | undefined {
  try {
    const stored = localStorage.getItem(CACHE_PREFIX + periodId);
    return stored ? (JSON.parse(stored) as BandDirectory) : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(periodId: string, directory: BandDirectory) {
  try {
    localStorage.setItem(CACHE_PREFIX + periodId, JSON.stringify(directory));
  } catch {
    /* fullt lager på telefonen: skanning virker fortsatt med det som ligger i minnet */
  }
}

async function fetchDirectory(periodId: string): Promise<BandDirectory> {
  const [participantsRes, assignmentsRes] = await Promise.all([
    supabase
      .from('participants')
      .select('id, name, image_url, image_thumb_url, room, birth_date, has_arrived, arrived_at, cabins(name)')
      .eq('period_id', periodId)
      .order('name', { ascending: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('wristband_assignments')
      .select('code, participant_id, assigned_at')
      .eq('period_id', periodId)
      .is('released_at', null),
  ]);
  if (participantsRes.error) throw participantsRes.error;
  if (assignmentsRes.error) throw assignmentsRes.error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const participants: BandParticipant[] = ((participantsRes.data ?? []) as any[]).map((p) => ({
    id: p.id,
    name: p.name,
    image: p.image_thumb_url || p.image_url || null,
    cabin: p.cabins?.name ?? null,
    room: p.room ?? null,
    birth_date: p.birth_date ?? null,
    has_arrived: p.has_arrived,
    arrived_at: p.arrived_at,
  }));

  const directory: BandDirectory = {
    participants,
    assignments: (assignmentsRes.data ?? []) as BandAssignment[],
    fetchedAt: new Date().toISOString(),
  };
  writeCache(periodId, directory);
  return directory;
}

/**
 * Deltakere og aktive bånd for aktiv periode. Listen ligger også på telefonen,
 * så oppslag ved skanning virker uten nett.
 */
export function useBandDirectory() {
  const queryClient = useQueryClient();
  const { data: periodId, isLoading: periodLoading } = useActivePeriodId();

  const query = useQuery({
    queryKey: ['qr-band-directory', periodId ?? 'none'],
    enabled: !!periodId,
    queryFn: () => {
      if (!periodId) throw new Error('Ingen aktiv periode');
      return fetchDirectory(periodId);
    },
    placeholderData: () => (periodId ? readCache(periodId) : undefined),
    staleTime: 30_000,
    refetchInterval: 60_000,
    networkMode: 'offlineFirst',
  });

  const directory = query.data ?? (periodId ? readCache(periodId) : undefined);

  const byCode = useMemo(() => {
    const map = new Map<string, string>();
    directory?.assignments.forEach((a) => map.set(a.code, a.participant_id));
    return map;
  }, [directory]);

  const byParticipant = useMemo(() => {
    const map = new Map<string, string>();
    directory?.assignments.forEach((a) => map.set(a.participant_id, a.code));
    return map;
  }, [directory]);

  const participantById = useMemo(() => {
    const map = new Map<string, BandParticipant>();
    directory?.participants.forEach((p) => map.set(p.id, p));
    return map;
  }, [directory]);

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['qr-band-directory'] }),
    [queryClient],
  );

  const assign = useCallback(
    async (participantId: string, code: string, force = false): Promise<AssignResult> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('assign_wristband', {
        _participant_id: participantId,
        _code: code,
        _force: force,
      });
      if (error) throw error;
      await refresh();
      return data as AssignResult;
    },
    [refresh],
  );

  const release = useCallback(
    async (participantId: string, reason: 'mistet' | 'feil' = 'mistet') => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc('release_wristband', {
        _participant_id: participantId,
        _reason: reason,
      });
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  return {
    periodId: periodId ?? null,
    isLoading: periodLoading || (query.isLoading && !directory),
    error: query.error as Error | null,
    participants: directory?.participants ?? [],
    byCode,
    byParticipant,
    participantById,
    fetchedAt: directory?.fetchedAt ?? null,
    refresh,
    assign,
    release,
  };
}

/** Status for lageret, og automatisk sending når det er nett. */
export function useScanQueue() {
  const isOffline = useOfflineStatus();
  const [counts, setCounts] = useState(getScanQueueCounts());
  const [isSending, setIsSending] = useState(false);
  const [lastResult, setLastResult] = useState<FlushResult | null>(null);

  useEffect(() => subscribeScanQueue(() => setCounts(getScanQueueCounts())), []);

  const send = useCallback(async () => {
    if (getScanQueueCounts().total === 0) return null;
    setIsSending(true);
    try {
      const result = await flushScanQueue();
      setLastResult(result);
      return result;
    } finally {
      setIsSending(false);
      setCounts(getScanQueueCounts());
    }
  }, []);

  // Send når nettet kommer tilbake, når siden åpnes, og hvert 30. sekund.
  useEffect(() => {
    if (isOffline) return;
    const first = setTimeout(send, 800);
    const interval = setInterval(send, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [isOffline, send]);

  return { counts, isSending, isOffline, lastResult, send };
}
