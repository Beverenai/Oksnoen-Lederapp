import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CloudOff, Trash2, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { hapticError, hapticImpact } from '@/lib/capacitorHaptics';
import { getScanQueue, removeScan } from '@/lib/scanQueue';
import { activitySymbol } from '@/lib/activityStyle';
import { formatWristbandCode } from '@/lib/wristband';
import type { BandParticipant } from '@/hooks/useWristbands';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  periodId: string | null;
  participantById: Map<string, BandParticipant>;
  onClose: () => void;
  /** Kalles når en skanning er angret, så skanneren kan godta deltakeren på nytt. */
  onUndone?: (participantId: string | null, activity: string) => void;
}

interface Row {
  key: string;
  id: string | null;
  client_scan_id: string | null;
  participant_id: string | null;
  code: string | null;
  activity: string;
  leader_id: string | null;
  at: string;
  local: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function clock(iso: string): string {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  const time = d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  return today ? time : `${d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })} ${time}`;
}

/** Historikk over skanninger, per leder. Hver linje kan angres. */
export function ScanHistory({ open, periodId, participantById, onClose, onUndone }: Props) {
  const { leader, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>('mine');
  const [busy, setBusy] = useState<string | null>(null);
  const [localTick, setLocalTick] = useState(0);

  const { data: serverRows = [], isFetching } = useQuery({
    queryKey: ['qr-scan-history', periodId],
    enabled: open && !!periodId,
    staleTime: 5_000,
    queryFn: async () => {
      const { data, error } = await db
        .from('participant_activities')
        .select('id, participant_id, activity, registered_by, scanned_at, completed_at, wristband_code, client_scan_id')
        .eq('source', 'qr')
        .eq('period_id', periodId)
        .order('completed_at', { ascending: false })
        .limit(400);
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []) as any[];
    },
  });

  const { data: leaders = [] } = useQuery({
    queryKey: ['qr-scan-history-leaders'],
    enabled: open,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from('leaders').select('id, name');
      return (data ?? []) as { id: string; name: string }[];
    },
  });
  const leaderName = useMemo(() => new Map(leaders.map((l) => [l.id, l.name])), [leaders]);

  const rows: Row[] = useMemo(() => {
    const local: Row[] = getScanQueue()
      .slice()
      .reverse()
      .map((s) => ({
        key: `l-${s.client_scan_id}`,
        id: null,
        client_scan_id: s.client_scan_id,
        participant_id: s.participant_id ?? null,
        code: s.code,
        activity: s.activity,
        leader_id: leader?.id ?? null,
        at: s.scanned_at,
        local: true,
      }));
    const localIds = new Set(local.map((r) => r.client_scan_id));
    const server: Row[] = serverRows
      .filter((r) => !r.client_scan_id || !localIds.has(r.client_scan_id))
      .map((r) => ({
        key: `s-${r.id}`,
        id: r.id,
        client_scan_id: r.client_scan_id ?? null,
        participant_id: r.participant_id,
        code: r.wristband_code ?? null,
        activity: r.activity,
        leader_id: r.registered_by ?? null,
        at: r.scanned_at ?? r.completed_at,
        local: false,
      }));
    return [...local, ...server];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverRows, leader?.id, localTick, open]);

  const leaderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((r) => r.leader_id && counts.set(r.leader_id, (counts.get(r.leader_id) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const shown = rows.filter((r) =>
    filter === 'alle' ? true : filter === 'mine' ? r.leader_id === leader?.id : r.leader_id === filter,
  );

  const undo = async (row: Row) => {
    setBusy(row.key);
    try {
      if (row.local && row.client_scan_id) {
        removeScan(row.client_scan_id);
        setLocalTick((t) => t + 1);
      } else if (row.id) {
        const { error } = await db.from('participant_activities').delete().eq('id', row.id).eq('source', 'qr');
        if (error) throw error;
        await queryClient.invalidateQueries({ queryKey: ['qr-scan-history'] });
      }
      hapticImpact('medium');
      onUndone?.(row.participant_id, row.activity);
    } catch {
      hapticError();
    } finally {
      setBusy(null);
    }
  };

  if (!open) return null;

  const chips: { id: string; label: string }[] = [
    { id: 'mine', label: `Mine (${rows.filter((r) => r.leader_id === leader?.id).length})` },
    ...(isAdmin
      ? [
          { id: 'alle', label: `Alle (${rows.length})` },
          ...leaderCounts
            .filter(([id]) => id !== leader?.id)
            .map(([id, n]) => ({ id, label: `${(leaderName.get(id) ?? 'Leder').split(' ')[0]} (${n})` })),
        ]
      : []),
  ];

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end">
      <button type="button" aria-label="Lukk" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[88%] min-h-[50%] flex-col rounded-t-[2rem] bg-background pb-[env(safe-area-inset-bottom,0px)] shadow-2xl animate-in slide-in-from-bottom duration-200">
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-muted-foreground/30" />
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
          <h2 className="text-2xl font-heading font-bold text-foreground">Historikk</h2>
          <button type="button" onClick={onClose} aria-label="Lukk" className="rounded-full bg-muted p-2">
            <X className="h-5 w-5" />
          </button>
        </div>

        {chips.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-5 pb-3">
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setFilter(c.id)}
                className={cn(
                  'shrink-0 rounded-full px-3.5 py-2 text-sm font-medium',
                  filter === c.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-1.5 overflow-y-auto overscroll-contain px-5 pb-6">
          {shown.map((r) => {
            const p = r.participant_id ? participantById.get(r.participant_id) : undefined;
            const name = p?.name ?? (r.code ? `Bånd ${formatWristbandCode(r.code)}` : 'Ukjent deltaker');
            const canUndo = r.local || isAdmin || r.leader_id === leader?.id;
            return (
              <div key={r.key} className="flex items-center gap-3 rounded-2xl bg-muted/40 p-2 pr-2.5">
                <Avatar className="h-11 w-11">
                  <AvatarImage src={p?.image ?? undefined} />
                  <AvatarFallback>{name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{name}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <span aria-hidden>{activitySymbol(r.activity)}</span>
                    <span className="truncate">
                      {r.activity} · {clock(r.at)}
                      {filter !== 'mine' && r.leader_id ? ` · ${(leaderName.get(r.leader_id) ?? '').split(' ')[0]}` : ''}
                    </span>
                    {r.local && <CloudOff className="h-3 w-3 shrink-0 text-amber-600" aria-label="Ikke sendt ennå" />}
                  </p>
                </div>
                {canUndo && (
                  <button
                    type="button"
                    disabled={busy === r.key}
                    onClick={() => undo(r)}
                    aria-label={`Angre ${name}`}
                    className="rounded-full p-2.5 text-destructive active:bg-destructive/10 disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
          {shown.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {isFetching ? 'Henter…' : 'Ingen skanninger ennå'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
