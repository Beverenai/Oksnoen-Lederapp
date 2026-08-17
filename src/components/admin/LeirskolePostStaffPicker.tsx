import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check } from 'lucide-react';
import { trimDayHours } from '@/lib/leirskoleDayHours';

export interface PickerPost {
  id: string;
  name: string;
  date: string;
  duration_hours?: number | null;
  assignments: { staff_id: string }[];
}

/** Trykk på en måltid-/natt-/kjøkkenrute for å endre hvem som står der. */
export function LeirskolePostStaffPicker({
  weekId,
  post,
  staffOptions,
  hoursByStaff,
  maxHours,
  title,
  children,
}: {
  weekId: string;
  post: PickerPost;
  staffOptions: { staffId: string; name: string }[];
  hoursByStaff: Map<string, number>;
  maxHours: number;
  title: string;
  children: React.ReactNode;
}) {
  const qc = useQueryClient();

  const invalidate = () =>
    ['leirskole-schedule', 'leirskole-my-shifts', 'leirskole-activities'].forEach((key) =>
      qc.invalidateQueries({ queryKey: [key] }),
    );

  const toggle = useMutation({
    mutationFn: async ({ staffId, on }: { staffId: string; on: boolean }) => {
      if (!on) {
        const { error } = await supabase
          .from('leirskole_assignments')
          .delete()
          .eq('post_id', post.id)
          .eq('staff_id', staffId);
        if (error) throw error;
        return [] as string[];
      }
      const { error } = await supabase.from('leirskole_assignments').insert({
        post_id: post.id,
        staff_id: staffId,
        assigned_manually: true,
        is_locked: true,
      });
      if (error) throw error;
      return trimDayHours({ weekId, date: post.date, staffId, keepPostId: post.id, maxHours });
    },
    onSuccess: (removed) => {
      invalidate();
      if (removed.length) toast.success(`Fjernet ${removed.join(', ')} for å holde ${maxHours}t`);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke oppdatere bemanning'),
  });

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <p className="px-1 pb-1.5 text-xs font-semibold">{title}</p>
        <div className="max-h-[60vh] space-y-0.5 overflow-y-auto">
          {staffOptions.map((s) => {
            const on = post.assignments.some((a) => a.staff_id === s.staffId);
            const hours = hoursByStaff.get(s.staffId) ?? 0;
            return (
              <button
                key={s.staffId}
                type="button"
                onClick={() => toggle.mutate({ staffId: s.staffId, on: !on })}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted ${
                  on ? 'bg-primary/10 font-semibold' : ''
                }`}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border">
                  {on && <Check className="h-3 w-3" />}
                </span>
                <span className="flex-1 truncate">{s.name}</span>
                <span
                  className={`tabular-nums text-[10px] ${
                    hours > maxHours + 0.01 ? 'text-destructive' : 'text-muted-foreground'
                  }`}
                >
                  {hours.toFixed(1)}t
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
