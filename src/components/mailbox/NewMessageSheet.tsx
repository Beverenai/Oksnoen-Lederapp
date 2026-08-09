import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { MAILBOX_CATEGORIES, MailboxCategory, useSendMailboxMessage } from '@/hooks/useMailbox';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export function NewMessageSheet({
  open,
  onOpenChange,
  onSent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSent?: () => void;
}) {
  const [category, setCategory] = useState<MailboxCategory>('question');
  const [content, setContent] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const send = useSendMailboxMessage();
  const { showError } = useStatusPopup();
  const { isAdmin } = useAuth();

  const submit = async () => {
    if (content.trim().length < 3) {
      showError('Skriv litt mer', 'Meldingen er for kort.');
      return;
    }
    try {
      await send.mutateAsync({ category, content, isAnonymous: anonymous });
      setContent('');
      setCategory('question');
      onOpenChange(false);
      onSent?.();
      toast.success('Lagt i postkassen');
    } catch (e) {
      showError('Kunne ikke sende', e instanceof Error ? e.message : 'Ukjent feil');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92dvh] overflow-y-auto rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      >
        <SheetHeader className="text-left">
          <SheetTitle>Legg i postkassen</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          <div className="space-y-2">
            <Label>Kategori</Label>
            <div className="flex flex-wrap gap-2">
              {MAILBOX_CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm transition-colors',
                    category === c.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-foreground',
                  )}
                >
                  <span aria-hidden className="mr-1">{c.emoji}</span>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mailbox-content">Melding</Label>
            <Textarea
              id="mailbox-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder="Skriv spørsmålet eller forslaget ditt…"
            />
          </div>

          <div className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-muted/40 p-3">
            <div className="space-y-1">
              <Label htmlFor="mailbox-anon" className="text-sm">Send anonymt</Label>
              <p className="text-xs text-muted-foreground">
                Navnet ditt vises ikke for andre ledere.
              </p>
            </div>
            <Switch id="mailbox-anon" checked={anonymous} onCheckedChange={setAnonymous} />
          </div>

          <Button className="w-full" onClick={submit} disabled={send.isPending}>
            {send.isPending ? 'Sender…' : 'Send inn'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
