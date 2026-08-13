import { useQuery } from '@tanstack/react-query';
import { Dumbbell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useActivePeriodId } from '@/hooks/useActivePeriodId';
import { DashCard, EmptyLine } from '@/components/admin/dashboard/DashCard';
import { ParticipantChip } from '@/components/admin/dashboard/ParticipantChip';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  hasStoreStyrkprove,
  hasLilleStyrkprove,
  matchesRequirement,
  STORE_STYRKEPROVE_REQUIREMENTS,
  LILLE_STYRKEPROVE_FIXED_REQUIREMENTS,
  LILLE_STYRKEPROVE_HEIGHT_ALTERNATIVES,
  LILLE_STYRKEPROVE_SWIMMING_ALTERNATIVES,
} from '@/lib/activityUtils';

type Row = {
  id: string;
  name: string;
  imageUrl: string | null;
  thumbUrl: string | null;
  cabinName: string | null;
  missing: string[];
};

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
      const missingCounts = new Map<string, number>();

      (participantsRes.data || []).forEach((p) => {
        const activities = acts.get(p.id) || [];
        const base = {
          id: p.id,
          name: p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.name,
          imageUrl: p.image_url ?? null,
          thumbUrl: (p as any).image_thumb_url ?? null,
          cabinName: p.cabin_id ? cabinMap.get(p.cabin_id) ?? null : null,
        };

        const participantMissing = new Set<string>();

        if (!hasStoreStyrkprove(activities)) {
          const m = missingStore(activities);
          if (m.length >= 1 && m.length <= 2) store.push({ ...base, missing: m });
          m.forEach((x) => participantMissing.add(x));
        }
        if (!hasLilleStyrkprove(activities)) {
          const m = missingLille(activities);
          if (m.length >= 1 && m.length <= 2) lille.push({ ...base, missing: m });
          m.forEach((x) => participantMissing.add(x));
        }

        participantMissing.forEach((m) => {
          missingCounts.set(m, (missingCounts.get(m) || 0) + 1);
        });
      });

      const priority = [
        'Klatring',
        'Rappis',
        'Taubane',
        'Tretten meter',
        'Skrikeren begge veier',
        'Åtte/Ti/Tretten meter',
        'Skrikeren en vei/Triatlon',
      ];

      const missingItems = Array.from(missingCounts.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => {
          const ia = priority.indexOf(a.label);
          const ib = priority.indexOf(b.label);
          if (ia !== -1 && ib !== -1) return ia - ib;
          if (ia !== -1) return -1;
          if (ib !== -1) return 1;
          return a.label.localeCompare(b.label, 'nb');
        });

      const sort = (a: Row, b: Row) => a.missing.length - b.missing.length || a.name.localeCompare(b.name, 'nb');
      return { store: store.sort(sort), lille: lille.sort(sort), missingItems };
    },
  });

  const total = (data?.store.length ?? 0) + (data?.lille.length ?? 0);

  // Skjul kortet helt når ingen deltagere mangler 1–2 aktiviteter
  if (!isLoading && total === 0) return null;

  return (
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
      )}
    </DashCard>
  );
}
