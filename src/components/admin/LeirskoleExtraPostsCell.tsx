import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, Plus, Trash2 } from 'lucide-react';
import { trimDayHours } from '@/lib/leirskoleDayHours';

export interface ExtraPost {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  assignments: { staff_id: string }[];
}

const hhmm = (t: string) => t.slice(0, 5);
const firstName = (n: string) => n.split(' ')[0];

/**
 * Egne økter for en dag (ankomst, avreise, rydding …). Legges til med en
 * «+»-knapp med navn, klokkeslett og ledere — samme rad-logikk som måltidene.
 */
export function LeirskoleExtraPostsCell({
  weekId,
  date,
  posts,
  staffOptions,
  suggestions = ['Ankomst', 'Avreise'],
  style,
}: {
  weekId: string;
  date: string;
  posts: ExtraPost[];
  staffOptions: { staffId: string; name: string }[];
  suggestions?: string[];
  style?: React.CSSProperties;
}) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [openPost, setOpenPost] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', start: '09:00', end: '11:00' });

  const invalidate = () =>
    ['leirskole-schedule', 'leirskole-my-shifts', 'leirskole-week-plan'].forEach((key) =>
      qc.invalidateQueries({ queryKey: [key] }),
    );

  const createPost = useMutation({
    mutationFn: async ({ name, start, end }: { name: string; start: string; end: string }) => {
      const { error } = await supabase.from('leirskole_posts').insert({
        week_id: weekId,
        date,
        name: name.trim() || 'Egen økt',
        post_type: 'other',
        start_time: `${start}:00`,
        end_time: `${end}:00`,
        required_leaders: 1,
        is_custom: true,
        is_published: true,
        sort_order: Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5)),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setAddOpen(false);
      setDraft({ name: '', start: '09:00', end: '11:00' });
      toast.success('Økt lagt til');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke lagre økten'),
  });

  const updatePost = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, string> }) => {
      const { error } = await supabase.from('leirskole_posts').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error('Kunne ikke oppdatere økten'),
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

  const toggleStaff = useMutation({
    mutationFn: async ({ postId, staffId, on }: { postId: string; staffId: string; on: boolean }) => {
      if (on) {
        const { error } = await supabase
          .from('leirskole_assignments')
          .insert({ post_id: postId, staff_id: staffId, assigned_manually: true, is_locked: true });
        if (error) throw error;
        const removed = await trimDayHours({ weekId, date, staffId, keepPostId: postId });
        if (removed.length) toast.success(`Fjernet ${removed.join(', ')} for å holde 8t`);
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

  return (
    <div style={style} className="space-y-1 rounded-xl border border-amber-500/40 bg-amber-500/5 p-1.5">
      {posts.map((p) => {
        const names = staffOptions
          .filter((s) => p.assignments.some((a) => a.staff_id === s.staffId))
          .map((s) => firstName(s.name));
        return (
          <Popover key={p.id} open={openPost === p.id} onOpenChange={(v) => setOpenPost(v ? p.id : null)}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="w-full rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-1.5 py-1 text-left hover:brightness-105"
              >
                <p className="truncate text-[11px] font-bold leading-tight">{p.name}</p>
                <p className="text-[10px] leading-tight tabular-nums text-muted-foreground">
                  {hhmm(p.start_time)}–{hhmm(p.end_time)}
                </p>
                <p className="truncate text-[10px] leading-tight">{names.length ? names.join(', ') : 'ingen ledere'}</p>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 max-h-[70vh] space-y-2 overflow-y-auto p-3">
              <Input
                key={`${p.id}-${p.name}`}
                defaultValue={p.name}
                placeholder="Navn på økten"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== p.name) updatePost.mutate({ id: p.id, patch: { name: v } });
                }}
              />
              <TimeRangeField
                start={hhmm(p.start_time)}
                end={hhmm(p.end_time)}
                onStartChange={(v) => updatePost.mutate({ id: p.id, patch: { start_time: v } })}
                onEndChange={(v) => updatePost.mutate({ id: p.id, patch: { end_time: v } })}
              />
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

      <Popover open={addOpen} onOpenChange={setAddOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Legg til egen økt"
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-amber-500/60 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-500/10 dark:text-amber-200"
          >
            <Plus className="h-3.5 w-3.5" /> Legg til
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 space-y-2 p-3">
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
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
            placeholder="Navn på økten"
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
          <TimeRangeField
            start={draft.start}
            end={draft.end}
            onStartChange={(v) => setDraft((d) => ({ ...d, start: v }))}
            onEndChange={(v) => setDraft((d) => ({ ...d, end: v }))}
          />
          <Button
            size="sm"
            className="w-full rounded-full"
            disabled={createPost.isPending}
            onClick={() => createPost.mutate(draft)}
          >
            Legg til økten
          </Button>
          <p className="text-[11px] text-muted-foreground">Ledere settes på etterpå ved å trykke på økten.</p>
        </PopoverContent>
      </Popover>
    </div>
  );
}