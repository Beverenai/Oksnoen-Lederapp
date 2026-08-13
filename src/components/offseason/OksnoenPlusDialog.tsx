import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Crown, Check, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { hapticImpact } from '@/lib/capacitorHaptics';

const PERKS = [
  'Ubegrenset tilgang til Øksnøen-sola ☀️',
  'Eksklusiv snusboks i gull',
  'Prioritert plass i klinekøen',
  'Egen fanfare når du går ned til brygga',
  'Ingen reklame i Lederhuset',
];

/**
 * Humoristisk "Øksnøen +"-abonnement. Ren pynt – ingenting kjøpes,
 * ingen betaling skjer. Kun for gøy for off-season-ledere.
 */
export function OksnoenPlusDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [tries, setTries] = useState(0);

  const handleSubscribe = () => {
    hapticImpact('medium');
    const next = tries + 1;
    setTries(next);
    if (next === 1) toast('Du trenger Øksnøen + abo 💳', { description: 'Betaling er dessverre ikke tilgjengelig (heldigvis).' });
    else if (next === 2) toast('Kortet ble avvist av Bengt 😬');
    else toast('Øksnøen + er fortsatt utsolgt. Prøv igjen neste sommer ☀️');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm overflow-hidden rounded-3xl border-border/60 bg-card/90 backdrop-blur-xl p-0">
        <div className="relative px-6 pt-8 pb-6 text-center">
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/25 to-transparent" aria-hidden />
          <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 border border-primary/30 shadow-sm">
            <Crown className="h-8 w-8 text-primary" strokeWidth={2} />
          </div>
          <h2 className="relative text-2xl font-heading font-bold text-foreground">
            Øksnøen <span className="text-primary">+</span>
          </h2>
          <p className="relative mt-1 text-sm text-muted-foreground">
            Du trenger Øksnøen + abo for å bruke denne funksjonen.
          </p>

          <div className="relative mt-5 rounded-2xl border border-border/60 bg-background/60 p-4 text-left">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-foreground">1 000 kr</span>
              <span className="text-sm text-muted-foreground">/ måned</span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Bindingstid: hele livet. Ingen refusjon.
            </p>
            <ul className="mt-3 space-y-2">
              {PERKS.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.5} />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>

          <Button className="relative mt-5 w-full rounded-2xl" size="lg" onClick={handleSubscribe}>
            <Sparkles className="mr-2 h-4 w-4" />
            Bli Øksnøen + medlem
          </Button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="relative mt-2 w-full py-2 text-sm font-medium text-muted-foreground"
          >
            Nei takk, jeg er blakk
          </button>
          <p className="relative mt-2 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
            <Lock className="h-3 w-3" /> Dette er en tøysefunksjon – ingenting belastes.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}