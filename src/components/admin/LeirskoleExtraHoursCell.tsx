import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, Clock, Plus, Trash2 } from 'lucide-react';

export interface ExtraHourPost {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  duration_hours: number | null;
  assignments: { staff_id: string }[];
}

/** Egne timer utenfor vanlige økter: navn + varighet velges fritt. */
export const EXTRA_HOURS_TYPE = 'extra_hours';

const DURATIONS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8];
const SUGGESTIONS = ['Ekstra timer', 'Rydding', 'Møte', 'Vasking', 'Transport'];

const fmt = (h: number) => Number(h).toFixed(1).replace(/\.0$/, '').replace('.', ',');
const firstName = (n: string) => n.split(' ')[0];

/** "09:00" + 1.5t -> "10:30:00" */
function endTime(start: string, hours: number) {
  const [h, m] = start.split(':').map(Number);
  const total = h * 60 + m + Math.round(hours * 60);
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}:00`;
}

export function LeirskoleExtraHoursCell({
  weekId,
  date,
  posts,
  staffOptions,
  style,
}: {
  weekId: string;
  date: string;
  posts: ExtraHourPost[];
  staffOptions: { staffId: string; name: string }[];
  style?: React.CSSProperties;
}) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [openPost, setOpenPost] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', start: '09:00', hours: 1 });

  const invalidate = () =>
    ['leirskole-schedule', 'leirskole-my-shifts', 'leirskole-week-plan'].forEach((key) =>
      qc.invalidateQueries({ queryKey: [key] }),
    );

  const createPost = useMutation({
    mutationFn: async ({ name, start, hours }: { name: string; start: string; hours: number }) => {
      const { error } = await supabase.from('leirskole_posts').insert({
        week_id: weekId,
        date,
        name: name.trim() || 'Ekstra timer',
        post_type: EXTRA_HOURS_TYPE,
        start_time: `${start}:00`,
        end_time: endTime(start, hours),
        required_leaders: 1,
        is_custom: true,
        is_published: true,
        sort_order: 2000 + Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5)),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setAddOpen(false);
      setDraft({ name: '', start: '09:00', hours: 1 });
      toast.success('Ekstra timer lagt til');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke lagre timene'),
  });

  const updatePost = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, string> }) => {
      const { error } = await supabase.from('leirskole_posts').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error('Kunne ikke oppdatere timene'),
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
    onError: () => toast.error('Kunne ikke slette timene'),
  });

  const toggleStaff = useMutation({
    mutationFn: async ({ postId, staffId, on }: { postId: string; staffId: string; on: boolean }) => {
      if (on) {
        const { error } = await supabase
          .from('leirskole_assignments')
          .insert({ post_id: postId, staff_id: staffId, assigned_manually: true, is_locked: true });
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
    onError: () => toast.error('Kunne ikke oppdatere bemanningen'),
  });

  const hoursOf = (p: ExtraHourPost) => Number(p.duration_hours ?? 0);

  return (
    <div style={style} className="space-y-1 rounded-xl border border-violet-500/40 bg-violet-500/5 p-1.5">
      {posts.map((p) => {
        const names = staffOptions
          .filter((s) => p.assignments.some((a) => a.staff_id === s.staffId))
          .map((s) => firstName(s.name));
        return (
          <Popover key={p.id} open={openPost === p.id} onOpenChange={(v) => setOpenPost(v ? p.id : null)}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="w-full rounded-lg border border-violet-500/50 bg-violet-500/15 px-1.5 py-1 text-left hover:brightness-105"
              >
                <p className="truncate text-[11px] font-bold leading-tight">{p.name}</p>
                <p className="flex items-center gap-1 text-[10px] leading-tight tabular-nums text-muted-foreground">
                  <Clock className="h-2.5 w-2.5" /> {fmt(hoursOf(p))}t · {p.start_time.slice(0, 5)}
                </p>
                <p className="truncate text-[10px] leading-tight">
                  {names.length ? names.join(', ') : 'ingen ledere'}
                </p>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 max-h-[70vh] space-y-2 overflow-y-auto p-3">
              <Input
                key={`${p.id}-${p.name}`}
                defaultValue={p.name}
                placeholder="Navn på timene"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== p.name) updatePost.mutate({ id: p.id, patch: { name: v } });
                }}
              />
              <div>
                <p className="pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Varighet
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {DURATIONS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() =>
                        updatePost.mutate({
                          id: p.id,
                          patch: { end_time: endTime(p.start_time.slice(0, 5), h) },
                        })
                      }
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums ${
                        Math.abs(hoursOf(p) - h) < 0.01
                          ? 'border-violet-500 bg-violet-500/20 text-violet-700 dark:text-violet-200'
                          : 'border-border/60 bg-background text-muted-foreground hover:bg-muted/60'
                      }`}
                    >
                      {fmt(h)}t
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Starter
                </p>
                <Input
                  type="time"
                  defaultValue={p.start_time.slice(0, 5)}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    updatePost.mutate({
                      id: p.id,
                      patch: { start_time: `${v}:00`, end_time: endTime(v, hoursOf(p) || 1) },
                    });
                  }}
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
                <Trash2 className="h-4 w-4" /> Slett timene
              </Button>
            </PopoverContent>
          </Popover>
        );
      })}

      <Popover open={addOpen} onOpenChange={setAddOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Legg til ekstra timer"
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-violet-500/60 py-1 text-[11px] font-semibold text-violet-700 hover:bg-violet-500/10 dark:text-violet-200"
          >
            <Plus className="h-3.5 w-3.5" /> Legg til
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 space-y-2 p-3">
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, name: s }))}
                className="rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium hover:bg-muted"
              >
                {s}
              </button>
            ))}
          </div>
          <Input
            autoFocus
            value={draft.name}
            placeholder="Navn (f.eks. Rydding)"
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
          <div className="flex flex-wrap gap-1.5">
            {DURATIONS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, hours: h }))}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums ${
                  draft.hours === h
                    ? 'border-violet-500 bg-violet-500/20 text-violet-700 dark:text-violet-200'
                    : 'border-border/60 bg-background text-muted-foreground hover:bg-muted/60'
                }`}
              >
                {fmt(h)}t
              </button>
            ))}
          </div>
          <Input
            type="time"
            value={draft.start}
            onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value || '09:00' }))}
          />
          <Button
            size="sm"
            className="w-full rounded-full"
            disabled={createPost.isPending}
            onClick={() => createPost.mutate(draft)}
          >
            Legg til {fmt(draft.hours)}t
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Timene telles med i lederens totale timer. Ledere settes på etterpå.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}
