import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ClipboardCheck, Loader2, Ban } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAllParticipantTasks,
  useCancelParticipantTask,
  useParticipantTasksRealtime,
  type ParticipantTask,
} from '@/hooks/useParticipantTasks';

function fmt(ts: string | null) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusBadge(task: ParticipantTask) {
  if (task.status === 'cancelled') return <Badge variant="outline" className="text-muted-foreground">Trukket tilbake</Badge>;
  if (task.status === 'done') return <Badge variant="secondary">Ferdig</Badge>;
  if (task.claimed_by) return <Badge className="bg-blue-500 hover:bg-blue-600">Tatt</Badge>;
  return <Badge variant="outline">Venter</Badge>;
}

export function ParticipantTasksTab() {
  useParticipantTasksRealtime();
  const { data: tasks = [], isLoading } = useAllParticipantTasks();
  const cancel = useCancelParticipantTask();

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5" />
          Deltakeroppdrag ({tasks.length})
        </CardTitle>
        <CardDescription>Beskjeder og oppdrag sendt til ledere om enkelte deltakere</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.length === 0 && (
          <p className="text-muted-foreground text-center py-6">Ingen oppdrag sendt enda</p>
        )}
        {tasks.map((task) => (
          <div key={task.id} className="rounded-xl border border-border p-3 space-y-2">
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={task.participant?.image_thumb_url || task.participant?.image_url || undefined}
                  alt={task.participant?.name ?? ''}
                />
                <AvatarFallback className="text-xs">
                  {(task.participant?.name ?? '?').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{task.participant?.name ?? 'Deltaker'}</span>
                  {statusBadge(task)}
                  <Badge variant="outline" className="text-[10px]">
                    {task.is_broadcast ? 'Alle ledere' : (task.target_leader?.name ?? 'Leder')}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{task.message}</p>
                <div className="text-[11px] text-muted-foreground mt-1.5 space-y-0.5">
                  <p>Sendt {fmt(task.created_at)}{task.creator?.name ? ` av ${task.creator.name}` : ''}</p>
                  {task.claimed_at && (
                    <p className="text-blue-600 dark:text-blue-400">
                      Tatt av {task.claimer?.name ?? 'leder'} {fmt(task.claimed_at)}
                    </p>
                  )}
                  {task.read_at ? (
                    <p className="text-success font-medium">
                      Lest {fmt(task.read_at)}
                      {task.target_leader?.name ? ` av ${task.target_leader.name}` : ''}
                    </p>
                  ) : (
                    !task.is_broadcast && <p className="text-warning font-medium">Ikke lest enda</p>
                  )}
                  {task.status === 'cancelled' ? (
                    <p>Trukket tilbake {fmt(task.completed_at)}</p>
                  ) : (
                    task.completed_at && <p>Fullført {fmt(task.completed_at)}</p>
                  )}
                </div>
              </div>
              {task.status !== 'cancelled' && task.status !== 'done' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  disabled={cancel.isPending}
                  onClick={() =>
                    cancel.mutate(task.id, {
                      onSuccess: () => toast.success('Oppdrag trukket tilbake'),
                      onError: () => toast.error('Kunne ikke trekke tilbake'),
                    })
                  }
                >
                  <Ban className="h-3.5 w-3.5" />
                  Trekk tilbake
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}