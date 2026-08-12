import { useMemo, useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, Loader2, Search, Send, User, UserRound, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useLeaders } from '@/hooks/useLeaders';
import { useCreateParticipantTask } from '@/hooks/useParticipantTasks';

interface SendParticipantTaskSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participantId: string;
  participantName: string;
  participantImage?: string;
}

const QUICK_MESSAGES = [
  'Ta en prat med denne deltakeren',
  'Følg deltakeren til nurse',
  'Ring hjem til foreldrene',
  'Hold et ekstra øye i kveld',
];

const MAX_LEN = 400;

export function SendParticipantTaskSheet({
  open,
  onOpenChange,
  participantId,
  participantName,
  participantImage,
}: SendParticipantTaskSheetProps) {
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'all' | 'one'>('all');
  const [targetId, setTargetId] = useState<string | null>(null);
  const { data: leaders = [] } = useLeaders();
  const createTask = useCreateParticipantTask();

  const selectedLeader = useMemo(
    () => leaders.find((l) => l.id === targetId) ?? null,
    [leaders, targetId]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? leaders.filter((l) => l.name.toLowerCase().includes(q)) : leaders;
  }, [leaders, search]);

  const handleSend = () => {
    if (!message.trim()) {
      toast.error('Skriv en beskjed først');
      return;
    }
    const finalTarget = mode === 'one' ? targetId : null;
    if (mode === 'one' && !finalTarget) {
      toast.error('Velg en leder');
      return;
    }
    createTask.mutate(
      { participantId, participantName, message: message.trim(), targetLeaderId: finalTarget },
      {
        onSuccess: () => {
          toast.success(finalTarget ? 'Oppdrag sendt til lederen' : 'Oppdrag sendt til alle ledere');
          setMessage('');
          setTargetId(null);
          setMode('all');
          setSearch('');
          onOpenChange(false);
        },
        onError: () => toast.error('Kunne ikke sende oppdraget'),
      }
    );
  };

  const canSend = !!message.trim() && (mode === 'all' || !!targetId) && !createTask.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92dvh] p-0 flex flex-col gap-0 rounded-t-3xl overflow-hidden sm:max-h-[85vh] sm:max-w-xl sm:rounded-3xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:h-auto sm:border sm:border-border/60 sm:shadow-2xl"
      >
        {/* Topp: deltaker */}
        <div className="px-5 pt-5 pb-4 border-b border-border/60 bg-muted/30">
          <div className="flex items-center gap-3 pr-8">
            <Avatar className="h-12 w-12 border border-border">
              <AvatarImage src={participantImage} alt={participantName} />
              <AvatarFallback>
                <UserRound className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                Send oppdrag
              </p>
              <p className="font-heading font-bold text-lg leading-tight truncate">
                {participantName}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Beskjed */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Beskjed
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {message.length}/{MAX_LEN}
              </span>
            </div>
            <Textarea
              id="task-message"
              value={message}
              maxLength={MAX_LEN}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hva skal gjøres med denne deltakeren?"
              rows={3}
              className="rounded-2xl bg-muted/40 border-border/70 resize-none text-base"
            />
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {QUICK_MESSAGES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setMessage(q)}
                  className="shrink-0 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground active:scale-95 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </section>

          {/* Mottaker */}
          <section className="space-y-3">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Mottaker
            </span>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode('all');
                  setTargetId(null);
                }}
                className={cn(
                  'rounded-2xl border px-3 py-3 text-left transition active:scale-[0.98]',
                  mode === 'all'
                    ? 'border-primary bg-primary/10 shadow-card'
                    : 'border-border/70 bg-muted/30'
                )}
              >
                <Users
                  className={cn(
                    'h-5 w-5 mb-1.5',
                    mode === 'all' ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
                <p className="text-sm font-semibold">Alle ledere</p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Første som fikser det får oppdraget
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('one')}
                className={cn(
                  'rounded-2xl border px-3 py-3 text-left transition active:scale-[0.98]',
                  mode === 'one'
                    ? 'border-primary bg-primary/10 shadow-card'
                    : 'border-border/70 bg-muted/30'
                )}
              >
                <User
                  className={cn(
                    'h-5 w-5 mb-1.5',
                    mode === 'one' ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
                <p className="text-sm font-semibold">Én leder</p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Må bekrefte at beskjeden er lest
                </p>
              </button>
            </div>

            {mode === 'one' && (
              <div className="space-y-2 animate-fade-in">
                {selectedLeader ? (
                  <div className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 pl-1 pr-1 py-1 w-fit max-w-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={selectedLeader.profile_image_url || undefined}
                        alt={selectedLeader.name}
                      />
                      <AvatarFallback className="text-xs">
                        {selectedLeader.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium truncate">{selectedLeader.name}</span>
                    <button
                      type="button"
                      onClick={() => setTargetId(null)}
                      aria-label="Velg en annen leder"
                      className="ml-1 p-1.5 rounded-full hover:bg-background/60"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Søk etter leder..."
                        className="pl-9 rounded-full bg-muted/40 border-border/70"
                      />
                    </div>

                    <div className="max-h-56 overflow-y-auto rounded-2xl border border-border/70 divide-y divide-border/50">
                      {filtered.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-6">
                          Ingen ledere funnet
                        </p>
                      )}
                      {filtered.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => setTargetId(l.id)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition"
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={l.profile_image_url || undefined} alt={l.name} />
                            <AvatarFallback className="text-xs">
                              {l.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium truncate flex-1">{l.name}</span>
                          {targetId === l.id && <Check className="h-4 w-4 text-primary" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Send */}
        <div className="px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] border-t border-border/60 bg-card/80 backdrop-blur-xl">
          <Button
            className="w-full h-12 rounded-2xl text-base"
            onClick={handleSend}
            disabled={!canSend}
          >
            {createTask.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {mode === 'all'
              ? 'Send til alle ledere'
              : selectedLeader
                ? `Send til ${selectedLeader.name.split(' ')[0]}`
                : 'Velg en leder'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}