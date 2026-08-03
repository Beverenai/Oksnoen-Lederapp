import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tent, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  question: string;
  onAnswer: (joining: boolean) => Promise<void> | void;
};

/**
 * First-time gate: leader must actively answer Ja or Nei.
 * Cannot be dismissed by swipe, escape or outside click.
 */
export function OvernattingGateDialog({ title, question, onAnswer }: Props & { open: boolean }) {
  const [saving, setSaving] = useState<null | boolean>(null);

  const answer = async (v: boolean) => {
    setSaving(v);
    try {
      await onAnswer(v);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog open>
      <DialogContent
        className="max-w-sm [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="items-center text-center">
          <div className="mx-auto mb-2 w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
            <Tent className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{question}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button variant="outline" disabled={saving !== null} onClick={() => answer(false)}>
            {saving === false ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
            Nei
          </Button>
          <Button disabled={saving !== null} onClick={() => answer(true)}>
            {saving === true ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            Ja
          </Button>
        </div>
        <p className="text-[11px] text-center text-muted-foreground">
          Du kan endre svaret senere med telt-knappen på hjemskjermen.
        </p>
      </DialogContent>
    </Dialog>
  );
}

/** Change-your-answer sheet, opened from the round tent button. */
export function OvernattingEditDialog({
  open,
  onOpenChange,
  title,
  question,
  joining,
  onAnswer,
}: Props & { open: boolean; onOpenChange: (v: boolean) => void; joining: boolean }) {
  const [saving, setSaving] = useState<null | boolean>(null);

  const answer = async (v: boolean) => {
    setSaving(v);
    try {
      await onAnswer(v);
      onOpenChange(false);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="items-center text-center">
          <div className="mx-auto mb-2 w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
            <Tent className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{question}</DialogDescription>
        </DialogHeader>
        <p className="text-center text-sm font-medium">
          Du har svart: <span className={cn(joining ? 'text-primary' : 'text-muted-foreground')}>{joining ? 'Ja' : 'Nei'}</span>
        </p>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Button variant={joining ? 'outline' : 'secondary'} disabled={saving !== null} onClick={() => answer(false)}>
            {saving === false ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
            Nei
          </Button>
          <Button variant={joining ? 'default' : 'outline'} disabled={saving !== null} onClick={() => answer(true)}>
            {saving === true ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            Ja
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}