import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Send, Trash2, Check, CalendarPlus, ListChecks, Bell, AlertTriangle } from 'lucide-react';
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
        rows: [{ leader_id: leaderId, activity: effectiveActivity }],
        replace: false,
      });
    },
    onSuccess: () => toast.success('Aktivitet tildelt'),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Kunne ikke tildele'),
  });

  // Egen varsling til denne lederen (oppgave-modulen er erstattet av varslinger).
  const sendNotice = useMutation({
    mutationFn: async () => {
      const message = taskTitle.trim();
      if (!message) throw new Error('Skriv en beskjed');
      const { error } = await supabase.functions.invoke('push-send', {
        body: {
          title: 'Beskjed fra leirskole',
          message,
          leader_ids: [leaderId],
          sender_leader_id: leader?.id,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTaskTitle('');
      toast.success('Varsling sendt');
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
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:max-w-2xl sm:mx-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-3 pr-8">
            <Avatar className="h-12 w-12">
              <AvatarImage src={imageUrl ?? undefined} alt={leaderName} />
              <AvatarFallback>{initials(leaderName)}</AvatarFallback>
            </Avatar>
            <span className="min-w-0">
              <span className="block truncate">{leaderName}</span>
              <span className="flex flex-wrap items-center gap-x-2 text-xs font-normal text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {hours.toFixed(1)} t denne uken
                </span>
                <span>·</span>
                <span>{mine.length} aktiviteter</span>
                <span>·</span>
                <span>{competencies.length} kompetanser</span>
              </span>
            </span>
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="kompetanse" className="mt-4 pb-8">
          <TabsList className="grid w-full grid-cols-3 rounded-full">
            <TabsTrigger value="kompetanse" className="rounded-full gap-1.5 text-xs">
              <Check className="h-3.5 w-3.5" /> Kompetanse
            </TabsTrigger>
            <TabsTrigger value="aktiviteter" className="rounded-full gap-1.5 text-xs">
              <ListChecks className="h-3.5 w-3.5" /> Aktiviteter
            </TabsTrigger>
            <TabsTrigger value="beskjed" className="rounded-full gap-1.5 text-xs">
              <Bell className="h-3.5 w-3.5" /> Beskjed
            </TabsTrigger>
          </TabsList>

          {/* Kompetanse */}
          <TabsContent value="kompetanse" className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Hva lederen <strong className="text-foreground">kan</strong> ha. Trykk for å slå av/på — lagres med en gang.
            </p>
            {competencies.length === 0 && (
              <div className="flex items-center gap-1.5 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" /> Ingen kompetanse valgt ennå
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {activityTypes.map((c) => {
                const on = competencies.includes(c.key);
                return (
                  <button
                    key={c.key}
                    onClick={() => toggleComp(c.key)}
                    className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      on
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-transparent text-muted-foreground hover:bg-muted/60'
                    }`}
                  >
                    {on && <Check className="h-3 w-3" />}
                    {c.emoji} {c.label}
                  </button>
                );
              })}
            </div>
          </TabsContent>

          {/* Aktiviteter: tildel + historikk */}
          <TabsContent value="aktiviteter" className="mt-4 space-y-5">
            <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <CalendarPlus className="h-4 w-4 text-primary" /> Tildel ny aktivitet
              </p>
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">1. Dag</p>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">2. Økt</p>
                <div className="flex gap-1.5">
              {LEIRSKOLE_ACTIVITY_SESSIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSession(s.key)}
                  className={`flex-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    s.key === session
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted/60'
                  }`}
                >
                  {s.label}
                </button>
              ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">3. Aktivitet</p>
                <div className="flex flex-wrap gap-1.5">
              {activityTypes.map((a) => (
                <button
                  key={a.key}
                  onClick={() => setActivity(a.key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    a.key === effectiveActivity
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted/60'
                  }`}
                >
                  {a.emoji} {a.label}
                </button>
              ))}
                </div>
              </div>
              <Button className="w-full rounded-full" disabled={assign.isPending} onClick={() => assign.mutate()}>
                Tildel aktivitet
              </Button>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">Tildelt denne uken</p>
            {mine.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ingen tildelt ennå.</p>
            ) : (
              <div className="space-y-1.5">
                {mine.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 rounded-2xl bg-muted/40 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {activityEmoji(a.activity, activityTypes)} {activityLabel(a.activity, activityTypes)}
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
          </TabsContent>

          {/* Varsling */}
          <TabsContent value="beskjed" className="mt-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              Sender en push-varsling kun til {leaderName.split(' ')[0]}.
            </p>
            <Input
              placeholder="Beskjed til denne lederen"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
            />
            <Button
              className="w-full gap-2 rounded-full"
              disabled={sendNotice.isPending || !taskTitle.trim()}
              onClick={() => sendNotice.mutate()}
            >
              <Send className="h-4 w-4" /> Send + varsle
            </Button>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
