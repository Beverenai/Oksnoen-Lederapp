import { useQuery } from '@tanstack/react-query';
import { ClipboardMinus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useActivePeriodId } from '@/hooks/useActivePeriodId';
import { DashCard, EmptyLine } from '@/components/admin/dashboard/DashCard';
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

type MissingItem = {
  label: string;
  count: number;
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
    missing.push('Skrikeren en vei/Triatlon');
  }
  return missing;
}

export function MissingActivitiesCard() {
  const { data: activePeriodId } = useActivePeriodId();

  const { data, isLoading } = useQuery({
    queryKey: ['dash-missing-activities', activePeriodId],
    enabled: !!activePeriodId,
    queryFn: async () => {
      const [participantsRes, activitiesRes] = await Promise.all([
        supabase.from('participants').select('id').eq('period_id', activePeriodId!),
        supabase.from('participant_activities').select('participant_id, activity').eq('period_id', activePeriodId!),
      ]);
      if (participantsRes.error) throw participantsRes.error;
      if (activitiesRes.error) throw activitiesRes.error;

      const acts = new Map<string, string[]>();
      (activitiesRes.data || []).forEach((a) => {
        const list = acts.get(a.participant_id) || [];
        list.push(a.activity);
        acts.set(a.participant_id, list);
      });

      const counts = new Map<string, number>();

      (participantsRes.data || []).forEach((p) => {
        const activities = acts.get(p.id) || [];
        const missing = new Set<string>();

        if (!hasStoreStyrkprove(activities)) {
          missingStore(activities).forEach((m) => missing.add(m));
        }
        if (!hasLilleStyrkprove(activities)) {
          missingLille(activities).forEach((m) => missing.add(m));
        }

        missing.forEach((m) => {
          counts.set(m, (counts.get(m) || 0) + 1);
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

      const items: MissingItem[] = Array.from(counts.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => {
          const ia = priority.indexOf(a.label);
          const ib = priority.indexOf(b.label);
          if (ia !== -1 && ib !== -1) return ia - ib;
          if (ia !== -1) return -1;
          if (ib !== -1) return 1;
          return a.label.localeCompare(b.label, 'nb');
        });

      return { items, totalParticipants: participantsRes.data?.length ?? 0 };
    },
  });

  return (
    <DashCard
      title="Aktiviteter som mangler"
      icon={<ClipboardMinus className="h-4 w-4 text-orange-500" />}
      className="overflow-hidden"
    >
      {isLoading || !data ? (
        <div className="flex gap-2 overflow-hidden">
          <Skeleton className="h-10 w-28 shrink-0 rounded-full" />
          <Skeleton className="h-10 w-28 shrink-0 rounded-full" />
          <Skeleton className="h-10 w-28 shrink-0 rounded-full" />
        </div>
      ) : data.items.length === 0 ? (
        <EmptyLine text="Alle deltagere har fullført styrkeprøvene." />
      ) : (
        <div className="-mb-1 flex flex-wrap gap-2">
          {data.items.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-3 py-2 text-sm"
            >
              <span className="font-medium">{item.label}</span>
              <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-orange-500 px-1 text-[11px] font-bold text-white">
                {item.count}
              </span>
              <span className="text-[11px] text-muted-foreground">deltagere</span>
            </div>
          ))}
        </div>
      )}
    </DashCard>
  );
}
