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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { shortDate } from '@/lib/leirskoleDates';
import { CalendarRange, Plus, Trash2, Users, Check, ChevronDown, Settings2, Crown, Edit3 } from 'lucide-react';

type Props = {
  selectedWeekId: string | null;
  activeWeekId?: string | null;
  onSelect: (weekId: string) => void;
};

/**
 * Kompakt ukevelger for Leirskole-admin.
 * Vises som en horisontal rad med toggles, og valgt ukes detaljer
 * kan ekspanderes om nødvendig.
 */
export function LeirskoleWeekPeriodsCard({ selectedWeekId, activeWeekId, onSelect }: Props) {
  const qc = useQueryClient();
  const { showError } = useStatusPopup();
  const { data: weeks } = useLeirskoleWeeks();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState({ name: '', start_date: '', end_date: '', max_daily_hours: '8' });

  const selectedWeek = useMemo(
    () => (weeks ?? []).find((w) => w.id === selectedWeekId) ?? null,
    [weeks, selectedWeekId],
  );

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
    <div className="space-y-2">
      {/* Tittelrad med kompakt + knapp */}
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <CalendarRange className="h-4 w-4 text-primary" /> Leirskoleuker
        </p>
        <Button
          size="sm"
          variant={adding ? 'default' : 'secondary'}
          className="h-8 shrink-0 gap-1 rounded-full px-3 text-xs"
          onClick={() => setAdding((v) => !v)}
        >
          <Plus className="h-3.5 w-3.5" /> {adding ? 'Lukk' : 'Ny uke'}
        </Button>
      </div>

      {/* Horisontal ukevelger — rask å bytte mellom */}
      <div className="flex gap-1.5 overflow-x-auto px-1 pb-1 -mx-1">
        {(weeks ?? []).length === 0 && !adding && (
          <p className="py-2 text-xs text-muted-foreground">Ingen uker lagt inn ennå.</p>
        )}
        {(weeks ?? []).map((w) => {
          const on = w.id === selectedWeekId;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                onSelect(w.id);
                setEditing(false);
              }}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                on
                  ? 'oks-ls-gradient text-white shadow-md'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
            >
              <span className="flex items-center gap-1.5">
                {on && <Check className="h-3 w-3 shrink-0" />}
                <span>{w.name}</span>
              </span>
              <span className={`mt-0.5 block text-[10px] font-normal ${on ? 'text-white/80' : 'text-muted-foreground/80'}`}>
                {shortDate(w.start_date)}–{shortDate(w.end_date)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Ny uke-skjema */}
      {adding && (
        <div className="oks-ls-pill space-y-2 rounded-2xl bg-muted/40 p-3">
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

      {/* Valgt uke — kompakt sammendrag, redigering skjult */}
      {selectedWeek && !adding && (
        <div className="oks-ls-pill overflow-hidden">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="flex w-full items-center gap-2 p-3 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{selectedWeek.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {shortDate(selectedWeek.start_date)} – {shortDate(selectedWeek.end_date)} ·{' '}
                {staffCount.get(selectedWeek.id) ?? 0} ledere · maks {Number(selectedWeek.max_daily_hours ?? 8)}t/dag
                {selectedWeek.schedule_published_at && <span className="ml-1.5 text-primary">· Publisert</span>}
              </span>
            </span>
            <Settings2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${editing ? 'rotate-180' : ''}`} />
          </button>

          {editing && (
            <div className="space-y-2 border-t border-border/60 p-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px]">Fra</Label>
                  <Input
                    type="date"
                    value={selectedWeek.start_date}
                    onChange={(e) => patch.mutate({ id: selectedWeek.id, values: { start_date: e.target.value } })}
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Til</Label>
                  <Input
                    type="date"
                    value={selectedWeek.end_date}
                    onChange={(e) => patch.mutate({ id: selectedWeek.id, values: { end_date: e.target.value } })}
                  />
                </div>
              </div>
              <div>
                <Label className="text-[11px]">Maks timer per dag</Label>
                <Input
                  type="number"
                  min={1}
                  max={16}
                  value={selectedWeek.max_daily_hours}
                  onChange={(e) =>
                    patch.mutate({ id: selectedWeek.id, values: { max_daily_hours: Number(e.target.value) } })
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2">
                <span className="text-xs">Uken er i bruk (gir tilgang)</span>
                <Switch
                  checked={selectedWeek.is_active}
                  onCheckedChange={(v) => patch.mutate({ id: selectedWeek.id, values: { is_active: v } })}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full gap-1.5 text-destructive"
                onClick={() => {
                  if (confirm(`Slette ${selectedWeek.name} med vaktplan og oppsett?`)) remove.mutate(selectedWeek.id);
                }}
              >
                <Trash2 className="h-4 w-4" /> Slett uken
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
