import { useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, Trash2 } from 'lucide-react';
import { dayLabel } from '@/lib/leirskoleDates';

const START_HOUR = 7;
const END_HOUR = 24;
const SLOT_MIN = 15;
const SLOT_PX = 11; // høyde per 15 min
const SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MIN;

const toClock = (slot: number) => {
  const total = START_HOUR * 60 + slot * SLOT_MIN;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};
const toSlot = (clock: string) => {
  const [h, m] = clock.slice(0, 5).split(':').map(Number);
  return Math.round((h * 60 + m - START_HOUR * 60) / SLOT_MIN);
};

export interface TimelinePost {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  assignments: { staff_id: string }[];
}

/** Dra i dagen for å lage en økt, skriv navn, og trykk på ledere for å legge dem til. */
export function LeirskoleSpecialDayTimeline({
  weekId,
  date,
  dayType,
  posts,
  staffOptions,
}: {
  weekId: string;
  date: string;
  dayType: 'arrival' | 'departure';
  posts: TimelinePost[];
  staffOptions: { staffId: string; name: string }[];
}) {
  const qc = useQueryClient();
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const [draft, setDraft] = useState<{ from: number; to: number } | null>(null);
  const [draftName, setDraftName] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...posts].sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [posts],
  );
  const selected = sorted.find((p) => p.id === selectedId) ?? null;

  const invalidate = () =>
    ['leirskole-schedule', 'leirskole-my-shifts', 'leirskole-week-plan'].forEach((key) =>
      qc.invalidateQueries({ queryKey: [key] }),
    );

  const slotFromEvent = (clientY: number) => {
    const box = gridRef.current?.getBoundingClientRect();
    if (!box) return 0;
    return Math.max(0, Math.min(SLOTS - 1, Math.floor((clientY - box.top) / SLOT_PX)));
  };

  const createPost = useMutation({
    mutationFn: async ({ from, to, name }: { from: number; to: number; name: string }) => {
      const start = toClock(from);
      const end = toClock(to + 1);
      const { error } = await supabase.from('leirskole_posts').insert({
        week_id: weekId,
        date,
        name: name.trim() || 'Økt',
        post_type: 'other',
        start_time: start,
        end_time: end,
        required_leaders: 1,
        is_custom: true,
        is_published: true,
        sort_order: Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5)),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setDraft(null);
      setDraftName('');
      toast.success('Økt lagt til');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke lagre økten'),
  });

  const removePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leirskole_posts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setSelectedId(null);
    },
    onError: () => toast.error('Kunne ikke slette økten'),
  });

  const renamePost = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('leirskole_posts').update({ name: name.trim() || 'Økt' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error('Kunne ikke endre navnet'),
  });

  const toggleStaff = useMutation({
    mutationFn: async ({ postId, staffId, on }: { postId: string; staffId: string; on: boolean }) => {
      if (on) {
        const { error } = await supabase.from('leirskole_assignments').insert({
          week_id: weekId,
          post_id: postId,
          staff_id: staffId,
          assigned_manually: true,
          is_locked: true,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('leirskole_assignments')
          .delete()
          .eq('post_id', postId)
          .eq('staff_id', staffId);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: () => toast.error('Kunne ikke oppdatere bemanning'),
  });

  const preview = drag ?? draft;

  return (
    <div className="rounded-2xl border border-amber-500/50 bg-amber-500/5 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">
          {dayLabel(date)}{' '}
          <span className="text-xs font-medium uppercase text-amber-700 dark:text-amber-200">
            {dayType === 'arrival' ? 'Ankomst' : 'Avreise'}
          </span>
        </p>
        <p className="text-[11px] text-muted-foreground">Dra i dagen for å lage en økt</p>
      </div>

      <div className="flex gap-2">
        {/* Klokkeskala */}
        <div className="w-10 shrink-0 select-none">
          {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
            <div key={i} style={{ height: SLOT_PX * 4 }} className="text-right text-[10px] text-muted-foreground">
              {String(START_HOUR + i).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Dagen */}
        <div
          ref={gridRef}
          className="relative flex-1 touch-none overflow-hidden rounded-xl border border-border/60 bg-background"
          style={{ height: SLOTS * SLOT_PX }}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('[data-post]')) return;
            const s = slotFromEvent(e.clientY);
            setDraft(null);
            setDrag({ from: s, to: s });
          }}
          onPointerMove={(e) => {
            if (!drag) return;
            setDrag({ ...drag, to: slotFromEvent(e.clientY) });
          }}
          onPointerUp={() => {
            if (!drag) return;
            const from = Math.min(drag.from, drag.to);
            const to = Math.max(drag.from, drag.to);
            setDrag(null);
            setDraft({ from, to: Math.max(to, from + 3) });
            setDraftName('');
          }}
        >
          {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 border-t border-border/50"
              style={{ top: i * SLOT_PX * 4 }}
            />
          ))}

          {preview && (
            <div
              className="pointer-events-none absolute left-1 right-1 rounded-lg border-2 border-dashed border-primary bg-primary/15"
              style={{
                top: Math.min(preview.from, preview.to) * SLOT_PX,
                height: (Math.abs(preview.to - preview.from) + 1) * SLOT_PX,
              }}
            >
              <p className="px-2 pt-0.5 text-[10px] font-semibold text-primary">
                {toClock(Math.min(preview.from, preview.to))}–{toClock(Math.max(preview.from, preview.to) + 1)}
              </p>
            </div>
          )}

          {sorted.map((p) => {
            const from = toSlot(p.start_time);
            const to = toSlot(p.end_time);
            const active = p.id === selectedId;
            return (
              <button
                key={p.id}
                data-post
                type="button"
                onClick={() => setSelectedId(active ? null : p.id)}
                className={`absolute left-1 right-1 overflow-hidden rounded-lg border px-2 py-1 text-left transition-colors ${
                  active
                    ? 'border-primary bg-primary/20'
                    : 'border-emerald-500/50 bg-emerald-500/15 hover:bg-emerald-500/25'
                }`}
                style={{ top: from * SLOT_PX, height: Math.max(SLOT_PX * 2, (to - from) * SLOT_PX) }}
              >
                <p className="truncate text-[11px] font-semibold">{p.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)} ·{' '}
                  {p.assignments.length
                    ? staffOptions
                        .filter((s) => p.assignments.some((a) => a.staff_id === s.staffId))
                        .map((s) => s.name.split(' ')[0])
                        .join(', ')
                    : 'ingen ledere'}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ny økt */}
      {draft && (
        <div className="mt-3 space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-2">
          <p className="text-xs font-semibold">
            Ny økt {toClock(draft.from)}–{toClock(draft.to + 1)}
          </p>
          <div className="flex gap-2">
            <Input
              autoFocus
              value={draftName}
              placeholder="Navn på økten (f.eks. Innsjekk)"
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createPost.mutate({ ...draft, name: draftName });
              }}
            />
            <Button
              size="sm"
              className="rounded-full"
              disabled={createPost.isPending}
              onClick={() => createPost.mutate({ ...draft, name: draftName })}
            >
              Legg til
            </Button>
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setDraft(null)}>
              Avbryt
            </Button>
          </div>
        </div>
      )}

      {/* Valgt økt: navn + ledere */}
      {selected && (
        <div className="mt-3 space-y-2 rounded-xl border border-border/60 bg-muted/30 p-2">
          <div className="flex items-center gap-2">
            <Input
              defaultValue={selected.name}
              key={selected.id}
              onBlur={(e) => {
                if (e.target.value.trim() !== selected.name) {
                  renamePost.mutate({ id: selected.id, name: e.target.value });
                }
              }}
            />
            <Button
              size="icon"
              variant="ghost"
              className="shrink-0 text-destructive"
              onClick={() => removePost.mutate(selected.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Trykk på en leder for å legge til
          </p>
          <div className="flex flex-wrap gap-1.5">
            {staffOptions.map((s) => {
              const on = selected.assignments.some((a) => a.staff_id === s.staffId);
              return (
                <button
                  key={s.staffId}
                  type="button"
                  disabled={toggleStaff.isPending}
                  onClick={() => toggleStaff.mutate({ postId: selected.id, staffId: s.staffId, on: !on })}
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    on ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {s.name}
                  {on && <Check className="h-3.5 w-3.5" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}