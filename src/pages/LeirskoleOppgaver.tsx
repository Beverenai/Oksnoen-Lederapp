import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Award, ClipboardList, Pencil } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useActiveLeirskoleWeek,
  useLeirskoleTasks,
  useMyLeirskoleCompetencies,
  useToggleLeirskoleTask,
} from '@/hooks/useLeirskole';
import { LeirskoleCompetenceSheet } from '@/components/leirskole/LeirskoleCompetenceSheet';
import { competenceEmoji, competenceLabel } from '@/lib/leirskoleCompetencies';

export default function LeirskoleOppgaver() {
  const { effectiveLeader } = useAuth();
  const { data: week, isLoading } = useActiveLeirskoleWeek();
  const { data: tasks } = useLeirskoleTasks(week?.id);
  const toggleTask = useToggleLeirskoleTask();
  const { data: myCompetencies } = useMyLeirskoleCompetencies();
  const [compOpen, setCompOpen] = useState(false);

  const myTasks = (tasks ?? []).filter(
    (t) => t.assign_all || (t.assigned_leader_ids ?? []).includes(effectiveLeader?.id ?? ''),
  );
  const doneTasks = myTasks.filter((t) => t.completedByMe).length;
  const taskPct = myTasks.length ? Math.round((doneTasks / myTasks.length) * 100) : 0;

  if (isLoading) return <Skeleton className="h-64 rounded-3xl" />;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 pb-6 animate-fade-in">
      <header className="oks-glass-card p-4">
        <h1 className="text-[22px] font-heading font-bold leading-tight">Oppgaver</h1>
        <p className="mt-1 text-sm text-muted-foreground">{week?.name ?? 'Ingen aktiv uke'}</p>
      </header>

      {/* Min kompetanse */}
      <section className="oks-glass-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-heading font-bold">
            <Award className="h-4 w-4 text-primary" /> Min kompetanse
          </h2>
          <Button size="sm" variant="ghost" className="gap-1.5 rounded-full" onClick={() => setCompOpen(true)}>
            <Pencil className="h-3.5 w-3.5" /> Endre
          </Button>
        </div>
        <div className="mt-3">
          {(myCompetencies ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Legg inn hva du kan ha ansvar for — tube, klatring, rappellering, kanotur, båtkjøring og badevakt.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {(myCompetencies ?? []).map((c) => (
                <span key={c} className="oks-pill px-2.5 py-1 text-xs font-medium">
                  {competenceEmoji(c)} {competenceLabel(c)}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Oppgaver fra admin */}
      <section className="oks-glass-card p-4">
        <h2 className="flex items-center gap-2 text-base font-heading font-bold">
          <ClipboardList className="h-4 w-4 text-primary" /> Oppgaver fra admin
        </h2>
        {myTasks.length > 0 && (
          <>
            <p className="mt-0.5 text-xs text-muted-foreground">{doneTasks} av {myTasks.length} fullført</p>
            <Progress value={taskPct} className="mt-2 h-1.5" />
          </>
        )}
        <div className="mt-3 space-y-2">
          {myTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen oppgaver akkurat nå.</p>
          ) : (
            myTasks.map((t) => (
              <label key={t.id} className="oks-pill flex items-start gap-3 px-3 py-2.5">
                <Checkbox
                  checked={t.completedByMe}
                  onCheckedChange={(v) => toggleTask.mutate({ taskId: t.id, done: !!v })}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${t.completedByMe ? 'line-through text-muted-foreground' : ''}`}>
                    {t.title}
                  </p>
                  {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                </div>
              </label>
            ))
          )}
        </div>
      </section>

      {effectiveLeader?.id && (
        <LeirskoleCompetenceSheet
          open={compOpen}
          onOpenChange={setCompOpen}
          leaderId={effectiveLeader.id}
          leaderName={effectiveLeader.name}
          current={myCompetencies ?? []}
        />
      )}
    </div>
  );
}
