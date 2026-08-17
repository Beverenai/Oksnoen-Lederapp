import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useLeirskoleWeeks, type LeirskoleWeek } from '@/hooks/useLeirskole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { shortDate } from '@/lib/leirskoleDates';
import { CalendarRange, Plus, Trash2, Users, Check } from 'lucide-react';

type Props = {
  selectedWeekId: string | null;
  onSelect: (weekId: string) => void;
};

/**
 * Leirskoleuker som «perioder»: velg hvilken uke du planlegger,
 * lag nye uker med datoer, og se hvor mange ledere som har tilgang
 * i den perioden (tilgangen styres av datoene på uken).
 */
export function LeirskoleWeekPeriodsCard({ selectedWeekId, onSelect }: Props) {
  const qc = useQueryClient();
  const { showError } = useStatusPopup();
  const { data: weeks } = useLeirskoleWeeks();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', start_date: '', end_date: '', max_daily_hours: '8' });

  const { data: staffRows } = useQuery({
    queryKey: ['leirskole-week-staff-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leirskole_staff').select('week_id');
      if (error) throw error;
      return (data ?? []) as { week_id: string }[];
    },
  });

  const staffCount = useMemo(() => {
    const map = new Map<string, number>();
    (staffRows ?? []).forEach((r) => map.set(r.week_id, (map.get(r.week_id) ?? 0) + 1));
    return map;
  }, [staffRows]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['leirskole-weeks'] });
    qc.invalidateQueries({ queryKey: ['leirskole-active-week'] });
    qc.invalidateQueries({ queryKey: ['leirskole-week-staff-counts'] });
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!draft.name.trim()) throw new Error('Gi uken et navn');
      if (!draft.start_date || !draft.end_date) throw new Error('Velg start- og sluttdato');
      if (draft.end_date < draft.start_date) throw new Error('Sluttdato må være etter startdato');
      const { data, error } = await supabase
        .from('leirskole_weeks')
        .insert({
          name: draft.name.trim(),
          start_date: draft.start_date,
          end_date: draft.end_date,
          max_daily_hours: Number(draft.max_daily_hours) || 8,
          is_active: true,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success('Uke opprettet');
      setDraft({ name: '', start_date: '', end_date: '', max_daily_hours: '8' });
      setAdding(false);
      invalidate();
      onSelect(id);
    },
    onError: (e: unknown) => showError(e instanceof Error ? e.message : 'Kunne ikke opprette uken'),
  });

  const patch = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<LeirskoleWeek> }) => {
      const { error } = await supabase.from('leirskole_weeks').update(values).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: unknown) => showError(e instanceof Error ? e.message : 'Kunne ikke oppdatere uken'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leirskole_weeks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Uke slettet');
      invalidate();
    },
    onError: (e: unknown) => showError(e instanceof Error ? e.message : 'Kunne ikke slette uken'),
  });

  return (
    <div className="oks-ls-pill oks-ls-stripe space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <CalendarRange className="h-4 w-4 text-primary" /> Leirskoleuker (perioder)
          </p>
          <p className="text-xs text-muted-foreground">
            Velg uken du planlegger. Datoene bestemmer når lederne har tilgang til leirskole-appen.
          </p>
        </div>
        <Button size="sm" variant="secondary" className="shrink-0 gap-1.5 rounded-full" onClick={() => setAdding((v) => !v)}>
          <Plus className="h-4 w-4" /> Ny uke
        </Button>
      </div>

      {adding && (
        <div className="space-y-2 rounded-2xl bg-muted/40 p-3">
          <Input
            placeholder="Navn (f.eks. Leirskole uke 36)"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Fra</Label>
              <Input type="date" value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Til</Label>
              <Input type="date" value={draft.end_date} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Maks timer per dag</Label>
            <Input
              type="number"
              min={1}
              max={16}
              value={draft.max_daily_hours}
              onChange={(e) => setDraft({ ...draft, max_daily_hours: e.target.value })}
            />
          </div>
          <Button className="w-full rounded-full" disabled={create.isPending} onClick={() => create.mutate()}>
            Opprett uke
          </Button>
        </div>
      )}

      <div className="space-y-1.5">
        {(weeks ?? []).length === 0 && (
          <p className="py-3 text-center text-xs text-muted-foreground">Ingen uker lagt inn ennå.</p>
        )}
        {(weeks ?? []).map((w) => {
          const on = w.id === selectedWeekId;
          return (
            <div
              key={w.id}
              className={`rounded-2xl border px-3 py-2 transition-colors ${
                on ? 'border-primary/50 bg-primary/10' : 'border-border/60 bg-muted/30'
              }`}
            >
              <button type="button" onClick={() => onSelect(w.id)} className="flex w-full items-center gap-2 text-left">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    {on && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    <span className="truncate text-sm font-semibold">{w.name}</span>
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                    <span>
                      {shortDate(w.start_date)} – {shortDate(w.end_date)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" /> {staffCount.get(w.id) ?? 0} ledere
                    </span>
                    <span>maks {Number(w.max_daily_hours ?? 8)}t/dag</span>
                    {w.schedule_published_at && <span className="text-primary">Publisert</span>}
                  </span>
                </span>
              </button>

              {on && (
                <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px]">Fra</Label>
                      <Input
                        type="date"
                        value={w.start_date}
                        onChange={(e) => patch.mutate({ id: w.id, values: { start_date: e.target.value } })}
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Til</Label>
                      <Input
                        type="date"
                        value={w.end_date}
                        onChange={(e) => patch.mutate({ id: w.id, values: { end_date: e.target.value } })}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2">
                    <span className="text-xs">Uken er i bruk (gir tilgang)</span>
                    <Switch
                      checked={w.is_active}
                      onCheckedChange={(v) => patch.mutate({ id: w.id, values: { is_active: v } })}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full gap-1.5 text-destructive"
                    onClick={() => {
                      if (confirm(`Slette ${w.name} med vaktplan og oppsett?`)) remove.mutate(w.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Slett uken
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
