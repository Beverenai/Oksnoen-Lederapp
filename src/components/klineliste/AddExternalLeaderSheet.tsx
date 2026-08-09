import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAddExternalLeader } from '@/hooks/useHookups';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { cn } from '@/lib/utils';

/**
 * Register a former leader who is not in the app. Name only (plus optional
 * gender for the filters) — they get no account and appear only in Klineliste.
 */
export function AddExternalLeaderSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const add = useAddExternalLeader();
  const { showError } = useStatusPopup();

  const submit = async () => {
    try {
      await add.mutateAsync({ name, gender });
      toast.success(`${name.trim()} lagt inn`);
      setName('');
      setGender(null);
      onOpenChange(false);
    } catch (e) {
      showError('Kunne ikke legge inn', e instanceof Error ? e.message : 'Ukjent feil');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      >
        <SheetHeader className="text-left">
          <SheetTitle>Legg til leder manuelt</SheetTitle>
        </SheetHeader>

        <p className="mt-2 text-xs text-muted-foreground">
          For tidligere ledere som ikke er i appen. Koblingen blir bekreftet med én gang, og vises
          i kartet med et merke.
        </p>

        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Fullt navn"
          className="mt-4"
          maxLength={80}
        />

        <div className="mt-3 flex gap-1.5">
          {([
            { key: 'male', label: 'Gutt' },
            { key: 'female', label: 'Jente' },
          ] as const).map((opt) => (
            <button
              key={String(opt.key)}
              type="button"
              onClick={() => setGender(opt.key)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                gender === opt.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <Button
          className="mt-5 w-full"
          disabled={add.isPending || !gender || name.trim().split(' ').filter(Boolean).length < 2}
          onClick={submit}
        >
          Legg inn
        </Button>
      </SheetContent>
    </Sheet>
  );
}