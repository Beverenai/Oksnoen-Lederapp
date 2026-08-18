import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Undo2, Wand2 } from 'lucide-react';
import { runLeirskoleGenerate } from '@/lib/leirskoleGenerateAll';
import { restoreLeirskoleSnapshot, takeLeirskoleSnapshot, type LeirskoleSnapshot } from '@/lib/leirskoleSnapshot';
import { shortDate } from '@/lib/leirskoleDates';

const KEYS = [
  'leirskole-week-plan',
  'leirskole-schedule',
  'leirskole-activities',
  'leirskole-activity-history',
  'leirskole-my-shifts',
  'leirskole-kitchen-days',
];

type Scope = { kind: 'unlocked' | 'fresh' | 'day'; date?: string };

/**
 * «Generer uken» som en frittstående knapp, slik at den er tilgjengelig
 * uansett hvilken fane admin står i. Omfanget velges i menyen:
 * alle ulåste dager, alt på nytt, eller bare den valgte dagen.
 */
export function LeirskoleGenerateButton({
  week,
  date,
  className,
  size = 'sm',
}: {
  week: { id: string; start_date: string; end_date: string };
  /** Den dagen admin ser på nå — brukes til «bare denne dagen». */
  date?: string;
  className?: string;
  size?: 'sm' | 'default';
}) {
  const qc = useQueryClient();
  const { leader } = useAuth();
  const [snapshot, setSnapshot] = useState<LeirskoleSnapshot | null>(null);

  const generate = useMutation({
    mutationFn: async (scope: Scope) => {
      const { count } = await supabase
        .from('leirskole_staff')
        .select('id', { count: 'exact', head: true })
        .eq('week_id', week.id);
      if (!count) {
        throw new Error('Legg inn lederne som jobber denne uken før du genererer.');
      }
      const snap = await takeLeirskoleSnapshot(week.id);
      setSnapshot(snap);
      return runLeirskoleGenerate({
        weekId: week.id,
        startDate: week.start_date,
        endDate: week.end_date,
        mode: 'all',
        createdBy: leader?.id ?? null,
        overwritePlan: scope.kind === 'fresh',
        onlyDates: scope.kind === 'day' && scope.date ? [scope.date] : null,
        ignoreLocked: scope.kind === 'fresh',
      });
    },
    onSuccess: (result) => {
      KEYS.forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
      const parts = [
        result.cellsFilled ? `${result.cellsFilled} ruter` : null,
        result.shifts ? `${result.shifts} vakter` : null,
        result.activityAssignments ? `${result.activityAssignments} aktiviteter` : null,
      ].filter(Boolean);
      if (parts.length) toast.success(`Generert: ${parts.join(' · ')}`);
      else toast.info('Ingenting ble endret — alt var allerede fylt ut');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke generere uken'),
  });

  const undo = useMutation({
    mutationFn: async () => {
      if (!snapshot) throw new Error('Ingen generering å angre');
      await restoreLeirskoleSnapshot(snapshot);
    },
    onSuccess: () => {
      KEYS.forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
      setSnapshot(null);
      toast.success('Genereringen er angret');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke angre'),
  });

  const busy = generate.isPending || undo.isPending;

  return (
    <div className={`flex items-center gap-1.5 ${className ?? ''}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size={size} disabled={busy} className="gap-1.5 rounded-full">
            <Wand2 className="h-4 w-4" />
            {generate.isPending ? 'Genererer…' : 'Generer uken'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" collisionPadding={12} className="z-50 w-[min(19rem,calc(100vw-2rem))]">
          <DropdownMenuLabel>Hva skal genereres?</DropdownMenuLabel>
          <DropdownMenuItem
            className="flex-col items-start gap-0.5 rounded-xl py-2"
            onClick={() => generate.mutate({ kind: 'unlocked' })}
          >
            <span className="text-sm font-semibold">Alle dager som ikke er låst</span>
            <span className="text-[11px] text-muted-foreground">Fyller tomrom og beholder det du har låst</span>
          </DropdownMenuItem>
          {date && (
            <DropdownMenuItem
              className="flex-col items-start gap-0.5 rounded-xl py-2"
              onClick={() => generate.mutate({ kind: 'day', date })}
            >
              <span className="text-sm font-semibold">Bare {shortDate(date)}</span>
              <span className="text-[11px] text-muted-foreground">Rører ingen andre dager</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="flex-col items-start gap-0.5 rounded-xl py-2"
            onClick={() => generate.mutate({ kind: 'fresh' })}
          >
            <span className="text-sm font-semibold">Alt på nytt</span>
            <span className="text-[11px] text-muted-foreground">Ignorerer låsene og lager hele uken om igjen</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {snapshot && (
        <Button
          size={size}
          variant="outline"
          disabled={busy}
          onClick={() => undo.mutate()}
          className="gap-1.5 rounded-full"
        >
          <Undo2 className="h-4 w-4" /> Angre
        </Button>
      )}
    </div>
  );
}
