import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { useActiveLeirskoleWeek, useLeirskoleTasks, useToggleLeirskoleTask } from '@/hooks/useLeirskole';
import { formatDue } from '@/lib/leirskoleDates';

export default function LeirskoleOppgaver() {
  const navigate = useNavigate();
  const { effectiveLeader } = useAuth();
  const { data: week } = useActiveLeirskoleWeek();
  const { data: tasks, isLoading } = useLeirskoleTasks(week?.id);
  const toggleTask = useToggleLeirskoleTask();

  const myTasks = (tasks ?? []).filter(
    (t) => t.assign_all || (t.assigned_leader_ids ?? []).includes(effectiveLeader?.id ?? ''),
  );
  const done = myTasks.filter((t) => t.completedByMe).length;
  const pct = myTasks.length ? Math.round((done / myTasks.length) * 100) : 0;

  return (
    <div className="space-y-3 animate-fade-in pb-6">
      <Button variant="ghost" size="sm" className="gap-1.5 px-2" onClick={() => navigate('/')}>
        <ArrowLeft className="h-4 w-4" /> Tilbake
      </Button>

      <div className="oks-ls-pill p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Oppgaver</p>
        <h1 className="mt-0.5 text-2xl font-heading font-bold">Mine oppgaver</h1>
        {myTasks.length > 0 && (
          <>
            <p className="mt-1 text-sm text-muted-foreground">{done} av {myTasks.length} fullført</p>
            <Progress value={pct} className="mt-2 h-1.5" />
          </>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-32 rounded-3xl" />
      ) : myTasks.length === 0 ? (
        <p className="oks-ls-pill flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
          <ClipboardList className="h-4 w-4" /> Ingen oppgaver akkurat nå.
        </p>
      ) : (
        <div className="space-y-2">
          {myTasks.map((t) => (
            <label key={t.id} className="oks-ls-pill flex items-start gap-3 p-4">
              <Checkbox
                checked={t.completedByMe}
                onCheckedChange={(v) => toggleTask.mutate({ taskId: t.id, done: !!v })}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <p className={`text-sm font-medium ${t.completedByMe ? 'line-through text-muted-foreground' : ''}`}>
                  {t.title}
                </p>
                {t.description && <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>}
                {t.due_at && <p className="mt-0.5 text-[11px] text-muted-foreground">Frist {formatDue(t.due_at)}</p>}
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
