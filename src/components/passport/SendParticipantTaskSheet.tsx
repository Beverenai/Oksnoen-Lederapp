import { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Search, Send, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useLeaders } from '@/hooks/useLeaders';
import { useCreateParticipantTask } from '@/hooks/useParticipantTasks';

interface SendParticipantTaskSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participantId: string;
  participantName: string;
}

export function SendParticipantTaskSheet({
  open,
  onOpenChange,
  participantId,
  participantName,
}: SendParticipantTaskSheetProps) {
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [targetId, setTargetId] = useState<string | null>(null);
  const { data: leaders = [] } = useLeaders();
  const createTask = useCreateParticipantTask();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? leaders.filter((l) => l.name.toLowerCase().includes(q)) : leaders;
  }, [leaders, search]);

  const handleSend = () => {
    if (!message.trim()) {
      toast.error('Skriv en beskjed først');
      return;
    }
    createTask.mutate(
      { participantId, participantName, message: message.trim(), targetLeaderId: targetId },
      {
        onSuccess: () => {
          toast.success(targetId ? 'Oppdrag sendt til lederen' : 'Oppdrag sendt til alle ledere');
          setMessage('');
          setTargetId(null);
          setSearch('');
          onOpenChange(false);
        },
        onError: () => toast.error('Kunne ikke sende oppdraget'),
      }
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] flex flex-col pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <SheetHeader>
          <SheetTitle>Send oppdrag — {participantName}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-4 mt-3">
          <div className="space-y-2">
            <Label htmlFor="task-message">Beskjed</Label>
            <Textarea
              id="task-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hva skal gjøres med denne deltakeren?"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Mottaker</Label>
            <button
              type="button"
              onClick={() => setTargetId(null)}
              className={cn(
                'w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                targetId === null ? 'border-primary bg-primary/10' : 'border-border bg-muted/40'
              )}
            >
              <div className="p-2 rounded-full bg-primary/15">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Alle ledere</p>
                <p className="text-xs text-muted-foreground">
                  Første som trykker «Jeg fikser det» får oppdraget
                </p>
              </div>
            </button>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Søk etter leder..."
                className="pl-9"
              />
            </div>

            <div className="space-y-1.5">
              {filtered.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setTargetId(l.id)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition',
                    targetId === l.id ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'
                  )}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={l.profile_image_url || undefined} alt={l.name} />
                    <AvatarFallback className="text-xs">
                      {l.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium truncate">{l.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <Button className="w-full mt-3" onClick={handleSend} disabled={createTask.isPending}>
          {createTask.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Send oppdrag
        </Button>
      </SheetContent>
    </Sheet>
  );
}