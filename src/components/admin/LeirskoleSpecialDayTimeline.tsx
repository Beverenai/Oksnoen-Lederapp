import { useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, Trash2 } from 'lucide-react';

const START_HOUR = 7;
const END_HOUR = 24;
const SLOT_MIN = 15;
const SLOT_PX = 4; // kompakt: høyde per 15 min
const SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MIN;

const toClock = (slot: number) => {
  const total = START_HOUR * 60 + slot * SLOT_MIN;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};
const toSlot = (clock: string) => {
  const [h, m] = clock.slice(0, 5).split(':').map(Number);
  return Math.max(0, Math.round((h * 60 + m - START_HOUR * 60) / SLOT_MIN));
};

export interface TimelinePost {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  assignments: { staff_id: string }[];
}

/** Dagkolonne for ankomst/avreise: dra for å lage økt, trykk på økten for navn og ledere. */
export function LeirskoleSpecialDayTimeline({
  weekId,
  date,
  posts,
  staffOptions,
}: {
  weekId: string;
  date: string;
  posts: TimelinePost[];
  staffOptions: { staffId: string; name: string }[];
}) {
  const qc = useQueryClient();
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  /** Flytting/endring av en eksisterende økt. */
  const [edit, setEdit] = useState<{ id: string; mode: 'move' | 'resize'; from: number; to: number; grabOffset: number } | null>(null);
  const [draft, setDraft] = useState<{ from: number; to: number } | null>(null);
  const [draftName, setDraftName] = useState('');
  const [openPost, setOpenPost] = useState<string | null>(null);
  const movedRef = useRef(false);

  /** Sorterte økter — ankomst/avreise har alltid én økt om gangen (ingen overlapp). */
  const sorted = useMemo(() => {
    return [...posts]
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map((p) => {
        const from = toSlot(p.start_time);
        return { post: p, from, to: Math.max(from + 2, toSlot(p.end_time)) };
      });
  }, [posts]);

  /** Klemmer et tidsrom slik at det aldri overlapper en annen økt. */
  const clampRange = (from: number, to: number, ignoreId?: string) => {
    const others = sorted.filter((r) => r.post.id !== ignoreId);
    const prevEnd = Math.max(0, ...others.filter((r) => r.to <= from).map((r) => r.to));
    const nextStart = Math.min(SLOTS, ...others.filter((r) => r.from >= prevEnd && r.from > from).map((r) => r.from));
    const start = Math.max(prevEnd, Math.min(from, nextStart - 2));
    const end = Math.max(start + 2, Math.min(to, nextStart));
    const blocked = others.some((r) => start < r.to && end > r.from);
    return blocked ? null : { from: start, to: end };
  };

  const invalidate = () =>
    ['leirskole-schedule', 'leirskole-my-shifts', 'leirskole-week-plan'].forEach((key) =>
      qc.invalidateQueries({ queryKey: [key] }),
    );

  const slotAt = (clientY: number) => {
    const box = gridRef.current?.getBoundingClientRect();
    if (!box) return 0;
    return Math.max(0, Math.min(SLOTS, Math.round((clientY - box.top) / SLOT_PX)));
  };

  const createPost = useMutation({
    mutationFn: async ({ from, to, name }: { from: number; to: number; name: string }) => {
      const start = toClock(from);
      const end = toClock(to);
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
      setOpenPost(null);
    },
    onError: () => toast.error('Kunne ikke slette økten'),
  });

  const updatePost = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, string> }) => {
      const { error } = await supabase.from('leirskole_posts').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error('Kunne ikke oppdatere økten'),
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
  const editPreview = edit;

  /** Peker-drag på en eksisterende økt: flytt hele, eller endre slutten. */
  const onEditMove = (clientY: number) => {
    if (!edit) return;
    const s = slotAt(clientY);
    movedRef.current = true;
    if (edit.mode === 'move') {
      const length = edit.to - edit.from;
      const from = Math.max(0, Math.min(SLOTS - length, s - edit.grabOffset));
      setEdit({ ...edit, from, to: from + length });
    } else {
      setEdit({ ...edit, to: Math.max(edit.from + 2, Math.min(SLOTS, s)) });
    }
  };

  const commitEdit = () => {
    if (!edit) return;
    const next = clampRange(edit.from, edit.to, edit.id);
    setEdit(null);
    if (!next) {
      toast.error('Økter kan ikke overlappe');
      return;
    }
    updatePost.mutate({
      id: edit.id,
      patch: { start_time: toClock(next.from), end_time: toClock(next.to) },
    });
  };

  return (
    <div className="flex h-full flex-col gap-1">
      <p className="text-center text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
        Dra for å lage · dra økten for å flytte
      </p>
      <div className="flex flex-1 gap-1">
        {/* Klokkeskala */}
        <div className="w-8 shrink-0 select-none pt-0">
          {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
            <div key={i} style={{ height: SLOT_PX * 4 }} className="text-right text-[8px] leading-none text-muted-foreground">
              {i % 2 === 0 ? String(START_HOUR + i).padStart(2, '0') : ''}
            </div>
          ))}
        </div>

        <div
          ref={gridRef}
          className="relative flex-1 cursor-crosshair touch-none select-none overflow-hidden rounded-xl border border-dashed border-amber-500/60 bg-amber-500/5"
          style={{ height: SLOTS * SLOT_PX }}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('[data-post]')) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            const s = slotAt(e.clientY);
            setDraft(null);
            setDrag({ from: s, to: s });
          }}
          onPointerMove={(e) => {
            if (edit) {
              onEditMove(e.clientY);
              return;
            }
            if (drag) setDrag({ from: drag.from, to: slotAt(e.clientY) });
          }}
          onPointerUp={(e) => {
            e.currentTarget.releasePointerCapture?.(e.pointerId);
            if (edit) {
              commitEdit();
              return;
            }
            if (!drag) return;
            const from = Math.min(drag.from, drag.to);
            const to = Math.max(drag.from, drag.to);
            setDrag(null);
            const next = clampRange(from, Math.max(to, from + 4));
            if (!next) {
              toast.error('Det ligger allerede en økt her');
              return;
            }
            setDraft(next);
            setDraftName('');
          }}
        >
          {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
            <div key={i} className="absolute left-0 right-0 border-t border-border/40" style={{ top: i * SLOT_PX * 4 }} />
          ))}

          {preview && !edit && (
            <div
              className="pointer-events-none absolute left-0.5 right-0.5 rounded-md border-2 border-dashed border-primary bg-primary/20"
              style={{
                top: Math.min(preview.from, preview.to) * SLOT_PX,
                height: (Math.abs(preview.to - preview.from) + 1) * SLOT_PX,
              }}
            >
              <p className="px-1 text-[9px] font-bold leading-tight text-primary">
                {toClock(Math.min(preview.from, preview.to))}
              </p>
            </div>
          )}

          {sorted.map(({ post: p, from: rawFrom, to: rawTo }) => {
            const live = editPreview?.id === p.id ? editPreview : null;
            const from = live ? live.from : rawFrom;
            const to = live ? live.to : rawTo;
            const names = staffOptions
              .filter((s) => p.assignments.some((a) => a.staff_id === s.staffId))
              .map((s) => s.name.split(' ')[0]);
            return (
              <Popover key={p.id} open={openPost === p.id} onOpenChange={(v) => setOpenPost(v ? p.id : null)}>
                <PopoverTrigger asChild>
                  <button
                    data-post
                    type="button"
                    className={`absolute left-0.5 right-0.5 overflow-hidden rounded-md border border-emerald-500/60 bg-emerald-500/20 px-1 py-0.5 text-left hover:bg-emerald-500/30 ${
                      live ? 'ring-2 ring-primary' : ''
                    }`}
                    style={{ top: from * SLOT_PX, height: (to - from) * SLOT_PX, cursor: 'grab' }}
                    onClick={(e) => {
                      if (movedRef.current) {
                        e.preventDefault();
                        movedRef.current = false;
                      }
                    }}
                    onPointerDown={(e) => {
                      if ((e.target as HTMLElement).closest('[data-resize]')) return;
                      movedRef.current = false;
                      gridRef.current?.setPointerCapture(e.pointerId);
                      setEdit({ id: p.id, mode: 'move', from: rawFrom, to: rawTo, grabOffset: slotAt(e.clientY) - rawFrom });
                    }}
                  >
                    <p className="truncate text-[10px] font-bold leading-tight">{p.name}</p>
                    <p className="truncate text-[9px] leading-tight text-muted-foreground">
                      {toClock(from)}–{toClock(to)}
                    </p>
                    <p className="truncate text-[9px] leading-tight">{names.length ? names.join(', ') : 'ingen ledere'}</p>
                    <span
                      data-resize
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        gridRef.current?.setPointerCapture(e.pointerId);
                        setEdit({ id: p.id, mode: 'resize', from: rawFrom, to: rawTo, grabOffset: 0 });
                      }}
                      className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-emerald-600/40"
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 space-y-2 p-3">
                  <Input
                    key={`${p.id}-${p.name}`}
                    defaultValue={p.name}
                    placeholder="Navn på økten"
                    onBlur={(e) => {
                      if (e.target.value.trim() && e.target.value.trim() !== p.name) {
                        updatePost.mutate({ id: p.id, patch: { name: e.target.value.trim() } });
                      }
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      defaultValue={p.start_time.slice(0, 5)}
                      onBlur={(e) => e.target.value && updatePost.mutate({ id: p.id, patch: { start_time: e.target.value } })}
                    />
                    <span className="text-muted-foreground">–</span>
                    <Input
                      type="time"
                      defaultValue={p.end_time.slice(0, 5)}
                      onBlur={(e) => e.target.value && updatePost.mutate({ id: p.id, patch: { end_time: e.target.value } })}
                    />
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Trykk på en leder for å legge til
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {staffOptions.map((s) => {
                      const on = p.assignments.some((a) => a.staff_id === s.staffId);
                      return (
                        <button
                          key={s.staffId}
                          type="button"
                          disabled={toggleStaff.isPending}
                          onClick={() => toggleStaff.mutate({ postId: p.id, staffId: s.staffId, on: !on })}
                          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                            on ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {s.name}
                          {on && <Check className="h-3 w-3" />}
                        </button>
                      );
                    })}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full gap-1 text-destructive"
                    onClick={() => removePost.mutate(p.id)}
                  >
                    <Trash2 className="h-4 w-4" /> Slett økten
                  </Button>
                </PopoverContent>
              </Popover>
            );
          })}
        </div>
      </div>

      {draft && (
        <div className="space-y-1 rounded-lg border border-primary/50 bg-primary/10 p-1.5">
          <p className="text-[10px] font-bold">
            {toClock(draft.from)}–{toClock(draft.to)}
          </p>
          <Input
            autoFocus
            className="h-8 text-xs"
            value={draftName}
            placeholder="Navn på økten"
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') createPost.mutate({ ...draft, name: draftName });
            }}
          />
          <div className="flex gap-1">
            <Button
              size="sm"
              className="h-7 flex-1 rounded-full text-xs"
              disabled={createPost.isPending}
              onClick={() => createPost.mutate({ ...draft, name: draftName })}
            >
              Legg til
            </Button>
            <Button size="sm" variant="ghost" className="h-7 rounded-full text-xs" onClick={() => setDraft(null)}>
              Avbryt
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
