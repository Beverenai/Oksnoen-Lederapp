import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useLeirskoleWeeks, type LeirskoleWeek } from '@/hooks/useLeirskole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { shortDate } from '@/lib/leirskoleDates';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CalendarRange, Plus, Trash2, Check, ChevronDown, Settings2, Crown, Edit3, ChevronRight } from 'lucide-react';

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
  const [sheetOpen, setSheetOpen] = useState(false);
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

  const setActive = useMutation({
    mutationFn: async (id: string) => {
      const { error: offError } = await supabase.from('leirskole_weeks').update({ is_active: false }).neq('id', id);
      if (offError) throw offError;
      const { error } = await supabase.from('leirskole_weeks').update({ is_active: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Aktiv uke endret');
      invalidate();
      setDialogOpen(false);
    },
    onError: (e: unknown) => showError(e instanceof Error ? e.message : 'Kunne ikke endre aktiv uke'),
  });

  return (
    <>
      {/* Kompakt knapp — uker håndteres i eget ark */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="oks-ls-pill flex w-full items-center gap-2 p-3 text-left"
      >
        <CalendarRange className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {selectedWeek?.name ?? 'Velg leirskoleuke'}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {selectedWeek
              ? `${shortDate(selectedWeek.start_date)} – ${shortDate(selectedWeek.end_date)} · ${
                  staffCount.get(selectedWeek.id) ?? 0
                } ledere${selectedWeek.is_active ? ' · aktiv' : ''}`
              : 'Trykk for å velge, endre eller lage ny uke'}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-primary" /> Leirskoleuker
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-2 pt-2">
      {/* Tittelrad med aktiv-uke-knapp og ny uke */}
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-xs text-muted-foreground">Velg uken du planlegger</p>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="default"
            className="h-8 shrink-0 gap-1 rounded-full px-3 text-xs oks-ls-gradient"
            onClick={() => setDialogOpen(true)}
          >
            <Crown className="h-3.5 w-3.5" /> Bytt aktiv uke
          </Button>
          <Button
            size="sm"
            variant={adding ? 'default' : 'secondary'}
            className="h-8 shrink-0 gap-1 rounded-full px-3 text-xs"
            onClick={() => setAdding((v) => !v)}
          >
            <Plus className="h-3.5 w-3.5" /> {adding ? 'Lukk' : 'Ny uke'}
          </Button>
        </div>
      </div>

      {/* Ukevelger */}
      <div className="-mx-1 flex flex-wrap gap-1.5 px-1 pb-1">
        {(weeks ?? []).length === 0 && !adding && (
          <p className="py-2 text-xs text-muted-foreground">Ingen uker lagt inn ennå.</p>
        )}
        {(weeks ?? []).map((w) => {
          const isPlanning = w.id === selectedWeekId;
          const isActive = w.id === activeWeekId;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                onSelect(w.id);
                setEditing(false);
                setSheetOpen(false);
              }}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                isPlanning
                  ? 'oks-ls-gradient text-white shadow-md'
                  : isActive
                    ? 'bg-primary/15 text-primary ring-1 ring-primary/40 hover:bg-primary/20'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
            >
              <span className="flex items-center gap-1.5">
                {isPlanning && <Edit3 className="h-3 w-3 shrink-0" />}
                {isActive && !isPlanning && <Crown className="h-3 w-3 shrink-0" />}
                <span>{w.name}</span>
              </span>
              <span className={`mt-0.5 block text-[10px] font-normal ${isPlanning ? 'text-white/80' : isActive ? 'text-primary/80' : 'text-muted-foreground/80'}`}>
                {shortDate(w.start_date)}–{shortDate(w.end_date)}
                {isActive && <span className="ml-1 font-semibold">· aktiv</span>}
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
            <Label className="text-xs">Planleggingsgrense timer per dag</Label>
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
                {staffCount.get(selectedWeek.id) ?? 0} ledere · planleggingsgrense {Number(selectedWeek.max_daily_hours ?? 8)}t/dag
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
                <Label className="text-[11px]">Planleggingsgrense timer per dag</Label>
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
              <div className="rounded-xl bg-muted/40 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs">
                    {selectedWeek.is_active ? 'Denne uken er aktiv for lederne' : 'Denne uken er ikke aktiv'}
                  </span>
                  <Button
                    size="sm"
                    variant={selectedWeek.is_active ? 'secondary' : 'default'}
                    className={`h-7 rounded-full px-2.5 text-[11px] ${selectedWeek.is_active ? '' : 'oks-ls-gradient'}`}
                    onClick={() => setDialogOpen(true)}
                  >
                    {selectedWeek.is_active ? 'Endre aktiv uke' : 'Sett aktiv'}
                  </Button>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Aktiv uke = den lederne ser i appen. Du kan fortsatt planlegge andre uker uten at de blir aktive.
                </p>
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

      {/* Dialog for å bytte hvilken uke som er aktiv for lederne */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" /> Velg aktiv uke
            </DialogTitle>
            <DialogDescription>
              Dette er den uken lederne ser i appen. Du kan fortsatt planlegge andre uker uten at de blir aktive.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-1">
            {(weeks ?? []).map((w) => {
              const isActive = w.id === activeWeekId;
              return (
                <div
                  key={w.id}
                  className={`flex items-center gap-3 rounded-2xl border p-3 ${
                    isActive ? 'border-primary/40 bg-primary/10' : 'border-border/60 bg-muted/30'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      {w.name}
                      {isActive && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                          AKTIV
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {shortDate(w.start_date)} – {shortDate(w.end_date)} · {staffCount.get(w.id) ?? 0} ledere
                    </p>
                  </div>
                  {isActive ? (
                    <Check className="h-5 w-5 shrink-0 text-primary" />
                  ) : (
                    <Button
                      size="sm"
                      className="h-8 rounded-full px-3 text-xs oks-ls-gradient"
                      disabled={setActive.isPending}
                      onClick={() => setActive.mutate(w.id)}
                    >
                      Sett aktiv
                    </Button>
                  )}
                </div>
              );
            })}
            {(weeks ?? []).length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">Ingen uker lagt inn ennå.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
