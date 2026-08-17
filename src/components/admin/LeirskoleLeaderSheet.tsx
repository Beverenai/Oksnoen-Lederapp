import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Clock, Send, Trash2 } from 'lucide-react';
import {
  useLeirskoleActivities,
  useSaveLeirskoleActivities,
  useDeleteLeirskoleActivity,
  useSaveLeirskoleCompetencies,
  useLeirskoleActivityTypes,
} from '@/hooks/useLeirskole';
import {
  LEIRSKOLE_ACTIVITY_SESSIONS,
  activityEmoji,
  activityLabel,
  sessionLabel,
} from '@/lib/leirskoleActivities';
import { dayLabel } from '@/lib/leirskoleDates';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  weekId: string;
  leaderId: string;
  leaderName: string;
  imageUrl?: string | null;
  competencies: string[];
  hours: number;
}

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join('');

export function LeirskoleLeaderSheet({
  open,
  onOpenChange,
  weekId,
  leaderId,
  leaderName,
  imageUrl,
  competencies,
  hours,
}: Props) {
  const { leader } = useAuth();
  const { data: activities } = useLeirskoleActivities(weekId);
  const saveActivities = useSaveLeirskoleActivities();
  const deleteActivity = useDeleteLeirskoleActivity();
  const saveComps = useSaveLeirskoleCompetencies();
  const { data: types } = useLeirskoleActivityTypes(true);
  const activityTypes = types ?? [];

  const today = new Date().toLocaleDateString('sv-SE');
  const [date, setDate] = useState(today);
  const [session, setSession] = useState<string>('formiddag');
  const [activity, setActivity] = useState<string>('');
  const [taskTitle, setTaskTitle] = useState('');

  const mine = useMemo(
    () => (activities ?? []).filter((a) => a.leader_id === leaderId),
    [activities, leaderId],
  );

  const effectiveActivity = activity || activityTypes[0]?.key || '';

  const assign = useMutation({
    mutationFn: async () => {
      await saveActivities.mutateAsync({
        weekId,
        date,
        session,
        rows: [{ leader_id: leaderId, activity }],
        replace: false,
      });
    },
    onSuccess: () => toast.success('Aktivitet tildelt'),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke tildele'),
  });

  const sendTask = useMutation({
    mutationFn: async () => {
      const title = taskTitle.trim();
      if (!title) throw new Error('Skriv en oppgave');
      const { error } = await supabase.from('leirskole_tasks').insert({
        week_id: weekId,
        title,
        assign_all: false,
        assigned_leader_ids: [leaderId],
        created_by: leader?.id ?? null,
      });
      if (error) throw error;
      await supabase.functions.invoke('push-send', {
        body: {
          title: 'Ny leirskole-oppgave',
          message: title,
          leader_ids: [leaderId],
          sender_leader_id: leader?.id,
        },
      });
    },
    onSuccess: () => {
      setTaskTitle('');
      toast.success('Oppgave sendt');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke sende'),
  });

  const toggleComp = (key: string) => {
    const next = competencies.includes(key)
      ? competencies.filter((c) => c !== key)
      : [...competencies, key];
    saveComps.mutate({ leaderId, competencies: next });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-3">
            <Avatar className="h-11 w-11">
              <AvatarImage src={imageUrl ?? undefined} alt={leaderName} />
              <AvatarFallback>{initials(leaderName)}</AvatarFallback>
            </Avatar>
            <span className="min-w-0">
              <span className="block truncate">{leaderName}</span>
              <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                <Clock className="h-3 w-3" /> {hours.toFixed(1)} t denne uken
              </span>
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5 pb-8">
          {/* Kompetanse */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Kompetanse</p>
            <div className="flex flex-wrap gap-1.5">
              {activityTypes.map((c) => {
                const on = competencies.includes(c.key);
                return (
                  <button
                    key={c.key}
                    onClick={() => toggleComp(c.key)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                      on ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground'
                    }`}
                  >
                    {c.emoji} {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tildel aktivitet */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Tildel aktivitet</p>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <div className="flex gap-1.5">
              {LEIRSKOLE_ACTIVITY_SESSIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSession(s.key)}
                  className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium ${
                    s.key === session ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activityTypes.map((a) => (
                <button
                  key={a.key}
                  onClick={() => setActivity(a.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    a.key === activity ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground'
                  }`}
                >
                  {a.emoji} {a.label}
                </button>
              ))}
            </div>
            <Button className="w-full rounded-full" disabled={assign.isPending} onClick={() => assign.mutate()}>
              Tildel
            </Button>
          </div>

          {/* Historikk denne uken */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Aktiviteter denne uken
            </p>
            {mine.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ingen tildelt ennå.</p>
            ) : (
              <div className="space-y-1.5">
                {mine.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 rounded-2xl bg-muted/40 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {activityEmoji(a.activity)} {activityLabel(a.activity)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {dayLabel(a.date)} · {sessionLabel(a.session)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Slett"
                      onClick={() => deleteActivity.mutate(a.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Oppgave */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Send oppgave</p>
            <Input
              placeholder="Oppgave til denne lederen"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />
            <Button
              className="w-full gap-2 rounded-full"
              disabled={sendTask.isPending}
              onClick={() => sendTask.mutate()}
            >
              <Send className="h-4 w-4" /> Send + varsle
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
