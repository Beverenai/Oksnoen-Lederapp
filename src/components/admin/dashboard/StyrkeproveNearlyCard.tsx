import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dumbbell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useActivePeriodId } from '@/hooks/useActivePeriodId';
import { DashCard, EmptyLine } from '@/components/admin/dashboard/DashCard';
import { ParticipantChip } from '@/components/admin/dashboard/ParticipantChip';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  hasStoreStyrkprove,
  hasLilleStyrkprove,
  matchesRequirement,
  STORE_STYRKEPROVE_REQUIREMENTS,
  LILLE_STYRKEPROVE_FIXED_REQUIREMENTS,
  LILLE_STYRKEPROVE_HEIGHT_ALTERNATIVES,
  LILLE_STYRKEPROVE_SWIMMING_ALTERNATIVES,
} from '@/lib/activityUtils';

type ParticipantSummary = {
  id: string;
  name: string;
  imageUrl: string | null;
  thumbUrl: string | null;
  cabinName: string | null;
};

type Row = ParticipantSummary & { missing: string[] };

type SummaryItem = {
  label: string;
  count: number;
  participants: ParticipantSummary[];
};

const SUMMARY_LABELS = [
  'Klatring',
  'Rappis',
  'Taubane',
  'Tretten meter',
  'Skrikeren begge veier',
  'Åtte/Ti/Tretten meter',
  'Skrikeren en vei / Triatlon',
];

function missingStore(activities: string[]) {
  return STORE_STYRKEPROVE_REQUIREMENTS.filter((r) => !matchesRequirement(activities, r));
}

function missingLille(activities: string[]) {
  const missing: string[] = [];
  LILLE_STYRKEPROVE_FIXED_REQUIREMENTS.forEach((r) => {
    if (!matchesRequirement(activities, r)) missing.push(r);
  });
  if (!LILLE_STYRKEPROVE_HEIGHT_ALTERNATIVES.some((a) => matchesRequirement(activities, a))) {
    missing.push('Åtte/Ti/Tretten meter');
  }
  if (!LILLE_STYRKEPROVE_SWIMMING_ALTERNATIVES.some((a) => matchesRequirement(activities, a))) {
    missing.push('Skrikeren en vei / Triatlon');
  }
  return missing;
}

export function StyrkeproveNearlyCard({ onParticipantClick }: { onParticipantClick: (id: string) => void }) {
  const { data: activePeriodId } = useActivePeriodId();
  const [selected, setSelected] = useState<SummaryItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['dash-styrkeprove-nearly', activePeriodId],
    enabled: !!activePeriodId,
    queryFn: async () => {
      const [participantsRes, activitiesRes, cabinsRes] = await Promise.all([
        supabase
          .from('participants')
          .select('id, name, first_name, last_name, cabin_id, image_url, image_thumb_url')
          .eq('period_id', activePeriodId!),
        supabase
          .from('participant_activities')
          .select('participant_id, activity')
          .eq('period_id', activePeriodId!),
        supabase.from('cabins').select('id, name'),
      ]);
      if (participantsRes.error) throw participantsRes.error;
      if (activitiesRes.error) throw activitiesRes.error;

      const cabinMap = new Map((cabinsRes.data || []).map((c) => [c.id, c.name]));
      const acts = new Map<string, string[]>();
      (activitiesRes.data || []).forEach((a) => {
        const list = acts.get(a.participant_id) || [];
        list.push(a.activity);
        acts.set(a.participant_id, list);
      });

      const store: Row[] = [];
      const lille: Row[] = [];

      (participantsRes.data || []).forEach((p) => {
        const activities = acts.get(p.id) || [];
        const base: ParticipantSummary = {
          id: p.id,
          name: p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.name,
          imageUrl: p.image_url ?? null,
          thumbUrl: (p as any).image_thumb_url ?? null,
          cabinName: p.cabin_id ? cabinMap.get(p.cabin_id) ?? null : null,
        };

        if (!hasStoreStyrkprove(activities)) {
          const m = missingStore(activities);
          if (m.length >= 1 && m.length <= 2) {
            store.push({ ...base, missing: m });
          }
        }
        if (!hasLilleStyrkprove(activities)) {
          const m = missingLille(activities);
          if (m.length >= 1 && m.length <= 2) {
            lille.push({ ...base, missing: m });
          }
        }
      });

      // Slå sammen deltagere som er nær både lille og store styrkeprøven
      const nearById = new Map<string, Row>();
      [...store, ...lille].forEach((r) => {
        const existing = nearById.get(r.id);
        if (!existing) {
          nearById.set(r.id, r);
        } else {
          existing.missing = Array.from(new Set([...existing.missing, ...r.missing]));
        }
      });
      const nearParticipants = Array.from(nearById.values());

      const summary: SummaryItem[] = SUMMARY_LABELS.map((label) => {
        const participants = nearParticipants.filter((r) => r.missing.includes(label));
        return { label, count: participants.length, participants };
      }).filter((item) => item.count > 0);

      const sort = (a: Row, b: Row) => a.missing.length - b.missing.length || a.name.localeCompare(b.name, 'nb');
      return { store: store.sort(sort), lille: lille.sort(sort), summary };
    },
  });

  const total = (data?.store.length ?? 0) + (data?.lille.length ?? 0);

  // Skjul kortet helt når ingen deltagere mangler 1–2 aktiviteter
  if (!isLoading && total === 0) return null;

  return (
    <>
      <DashCard
        title="Nær styrkeprøven"
        icon={<Dumbbell className="h-4 w-4 text-yellow-600" />}
        badge={total > 0 ? <Badge variant="secondary">{total}</Badge> : undefined}
      >
        {isLoading || !data ? (
          <div className="space-y-2">
            <Skeleton className="h-12 rounded-2xl" />
            <Skeleton className="h-12 rounded-2xl" />
          </div>
        ) : (
          <>
            {data.summary.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {data.summary.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setSelected(item)}
                    className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-3 py-2 text-sm transition-colors hover:bg-muted"
                  >
                    <span className="font-medium">{item.label}</span>
                    <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-orange-500 px-1 text-[11px] font-bold text-white">
                      {item.count}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  { key: 'lille', label: 'Lille styrkeprøven', rows: data.lille },
                  { key: 'store', label: 'Store styrkeprøven', rows: data.store },
                ] as const
              ).map((group) => (
                <div key={group.key}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label} · {group.rows.length}
                  </p>
                  {group.rows.length === 0 ? (
                    <EmptyLine text="Ingen nære fullføring." />
                  ) : (
                    <div className="space-y-1.5">
                      {group.rows.map((r) => (
                        <ParticipantChip
                          key={r.id}
                          size="sm"
                          name={r.name}
                          imageUrl={r.imageUrl}
                          thumbUrl={r.thumbUrl}
                          subtitle={
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="text-muted-foreground">Mangler:</span>
                              {r.missing.map((m) => (
                                <Badge key={m} variant="outline" className="px-1 py-0 text-[10px] font-normal">
                                  {m}
                                </Badge>
                              ))}
                              {r.cabinName && <span className="text-muted-foreground">· {r.cabinName}</span>}
                            </div>
                          }
                          onClick={() => onParticipantClick(r.id)}
                          right={
                            <Badge variant="secondary" className="shrink-0 text-[10px]">
                              {r.missing.length}
                            </Badge>
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </DashCard>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Deltagere som mangler {selected?.label}
              <span className="ml-2 text-sm font-normal text-muted-foreground">({selected?.count})</span>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-1.5">
            {selected?.participants.length === 0 && (
              <EmptyLine text="Ingen deltagere mangler denne aktiviteten." />
            )}
            {selected?.participants.map((p) => (
              <ParticipantChip
                key={p.id}
                size="md"
                name={p.name}
                imageUrl={p.imageUrl}
                thumbUrl={p.thumbUrl}
                subtitle={p.cabinName ?? undefined}
                onClick={() => {
                  setSelected(null);
                  onParticipantClick(p.id);
                }}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
