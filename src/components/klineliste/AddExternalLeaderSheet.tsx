import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAddExternalLeader } from '@/hooks/useHookups';
import { useStatusPopup } from '@/hooks/useStatusPopup';

/**
 * Register a former leader who is not in the app. Name only — they get no
 * account and only show up as an option in Klineliste.
 */
export function AddExternalLeaderSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState('');
  const add = useAddExternalLeader();
  const { showError } = useStatusPopup();

  const submit = async () => {
    try {
      await add.mutateAsync({ name, gender: null });
      toast.success(`${name.trim()} lagt inn`);
      setName('');
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
          For ledere som ikke er i appen. De blir bare et navn du kan velge i klinelista — ingen
          bruker eller innlogging opprettes.
        </p>

        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Navn"
          className="mt-4"
          maxLength={80}
        />

        <Button
          className="mt-5 w-full"
          disabled={add.isPending || name.trim().length < 2}
          onClick={submit}
        >
          Legg inn
        </Button>
      </SheetContent>
    </Sheet>
  );
}