import { useEffect, useRef, useState } from 'react';
import {
  Crown,
  X,
  Check,
  Sun,
  Circle,
  HeartHandshake,
  Music4,
  ShieldOff,
  Loader2,
  AlertCircle,
  Lock,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { hapticImpact } from '@/lib/capacitorHaptics';

type Plan = 'monthly' | 'yearly';
type Status = 'idle' | 'processing' | 'declined';

const PERKS: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: Sun, title: 'Ubegrenset sol', desc: 'Tilgang til Øksnøen-sola året rundt' },
  { icon: Circle, title: 'Gullsnus', desc: 'Eksklusiv snusboks i 24 karat' },
  { icon: HeartHandshake, title: 'Prioritert klinekø', desc: 'Hopp foran i køen på klinelista' },
  { icon: Music4, title: 'Egen fanfare', desc: 'Spilles automatisk når du går ned til brygga' },
  { icon: ShieldOff, title: 'Reklamefritt Lederhuset', desc: 'Ingen forstyrrelser i chatten' },
];

const DECLINES = [
  { code: 'ERR_ØKS_402', reason: 'Kortet ble avvist av Bengt.' },
  { code: 'ERR_ØKS_409', reason: 'Øksnøen + er dessverre utsolgt.' },
  { code: 'ERR_ØKS_418', reason: 'Banken din tror du er på leir.' },
  { code: 'ERR_ØKS_503', reason: 'Prøv igjen sommeren 2027.' },
];

const PLANS: Record<Plan, { label: string; price: string; unit: string; note: string }> = {
  monthly: { label: 'Månedlig', price: '1 000 kr', unit: '/ mnd', note: 'Fornyes automatisk hver måned' },
  yearly: { label: 'Årlig', price: '12 000 kr', unit: '/ år', note: 'Spar 0 % sammenlignet med månedlig' },
};

/**
 * Øksnøen + — en fullstendig oppdiktet «premium»-paywall for off-season-ledere.
 * Ingen betaling, ingen backend, ingenting lagres. Ren moro.
 */
export function OksnoenPlusDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [plan, setPlan] = useState<Plan>('monthly');
  const [status, setStatus] = useState<Status>('idle');
  const [attempts, setAttempts] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setStatus('idle');
      if (timer.current) clearTimeout(timer.current);
    }
  }, [open]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!open) return null;

  const decline = DECLINES[Math.min(attempts, DECLINES.length) - 1] ?? DECLINES[0];

  const handleSubscribe = () => {
    if (status === 'processing') return;
    hapticImpact('medium');
    setStatus('processing');
    timer.current = setTimeout(() => {
      setAttempts((a) => a + 1);
      setStatus('declined');
      hapticImpact('heavy');
    }, 1800);
  };

  const handleTrial = () => {
    hapticImpact('light');
    toast('Du fikk 0 dager gratis 🎉', {
      description: 'Prøveperioden er allerede utløpt.',
    });
    onOpenChange(false);
  };

  const close = () => {
    hapticImpact('light');
    onOpenChange(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Øksnøen +"
      className="fixed inset-0 z-[70] flex flex-col bg-background animate-in slide-in-from-bottom duration-300"
      style={{ height: '100dvh' }}
    >
      {/* Topp */}
      <div className="relative shrink-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-25"
          style={{ background: 'var(--gradient-oks-gold)' }}
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" aria-hidden />
        <div className="relative px-5 pb-5" style={{ paddingTop: 'calc(var(--safe-t) + 0.75rem)' }}>
          <button
            type="button"
            onClick={close}
            aria-label="Lukk"
            className="absolute right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/70 backdrop-blur text-foreground"
            style={{ top: 'calc(var(--safe-t) + 0.5rem)' }}
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mx-auto mt-2 flex h-14 w-14 items-center justify-center rounded-[1.1rem] oks-gold-surface oks-gold-ring">
            <Crown className="h-7 w-7 text-background" strokeWidth={2.2} />
          </div>
          <h2 className="mt-3 text-center text-2xl font-heading font-bold tracking-tight text-foreground">
            Øksnøen <span className="oks-gold-text">+</span>
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-center text-[13px] text-muted-foreground">
            Denne funksjonen krever Øksnøen + abonnement.
          </p>
        </div>
      </div>

      {/* Innhold */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-3">
        <div className="mx-auto w-full max-w-md space-y-4">
          {/* Planvalg */}
          <div className="grid grid-cols-2 items-stretch gap-3 pt-2">
            {(['monthly', 'yearly'] as Plan[]).map((p) => {
              const active = plan === p;
              const info = PLANS[p];
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => { hapticImpact('light'); setPlan(p); setStatus('idle'); }}
                  className={cn(
                    'relative flex flex-col rounded-2xl border px-3.5 pb-3 pt-3 text-left transition-all',
                    active
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border/60 bg-card/60',
                  )}
                >
                  {p === 'monthly' && (
                    <span className="absolute -top-2.5 left-3 z-10 whitespace-nowrap rounded-full oks-gold-surface px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-background shadow-sm">
                      Mest populær
                    </span>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {info.label}
                    </span>
                    <span
                      className={cn(
                        'flex shrink-0 items-center justify-center rounded-full border',
                        active ? 'border-primary bg-primary' : 'border-border',
                      )}
                      style={{ height: '1.1rem', width: '1.1rem' }}
                    >
                      {active && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-1">
                    <span className="text-base font-bold text-foreground">{info.price}</span>
                    <span className="text-[10px] text-muted-foreground">{info.unit}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="-mt-1 px-1 text-[11px] text-muted-foreground">{PLANS[plan].note}</p>

          {/* Perks */}
          <div className="rounded-2xl border border-border/60 bg-card/60 divide-y divide-border/50">
            {PERKS.map((perk) => (
              <div key={perk.title} className="flex items-start gap-3 p-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <perk.icon className="h-4 w-4 text-primary" strokeWidth={2.2} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-snug text-foreground">{perk.title}</p>
                  <p className="text-[11px] leading-snug text-muted-foreground">{perk.desc}</p>
                </div>
                <Check className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.6} />
              </div>
            ))}
          </div>

          {/* Avvisning */}
          {status === 'declined' && (
            <div className="oks-decline-shake rounded-2xl border border-destructive/40 bg-destructive/10 p-3.5">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-semibold text-destructive">Betaling avvist</p>
                  <p className="text-xs text-destructive/85">{decline.reason}</p>
                  <p className="mt-1 font-mono text-[10px] text-destructive/70">{decline.code}</p>
                </div>
              </div>
            </div>
          )}

          {/* Betalingsmerker */}
          <div className="flex items-center justify-center gap-2">
            {['VISA', 'MASTERCARD', 'VIPPZ', 'ØKS PAY'].map((brand) => (
              <span
                key={brand}
                className="rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-[9px] font-bold tracking-wide text-muted-foreground"
              >
                {brand}
              </span>
            ))}
          </div>

          <p className="px-1 text-center text-[10px] leading-relaxed text-muted-foreground">
            Abonnementet fornyes automatisk. Bindingstid: hele livet. Kan avbestilles ved å ro til land.
            Priser kan endres uten varsel, og gjør det ofte.
          </p>
        </div>
      </div>

      {/* Bunn / CTA */}
      <div
        className="shrink-0 border-t border-border/60 bg-card/80 px-5 pt-3 backdrop-blur-xl"
        style={{ paddingBottom: 'calc(var(--safe-b) + 0.85rem)' }}
      >
        <div className="mx-auto w-full max-w-md">
          <button
            type="button"
            onClick={handleSubscribe}
            disabled={status === 'processing'}
            className="flex w-full items-center justify-center gap-2 rounded-2xl oks-gold-surface oks-gold-ring px-4 py-3.5 text-base font-bold text-background transition-transform active:scale-[0.99] disabled:opacity-80"
          >
            {status === 'processing' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Kontakter banken …
              </>
            ) : (
              <>Abonner for {PLANS[plan].price} {PLANS[plan].unit}</>
            )}
          </button>

          {attempts >= 3 && status !== 'processing' && (
            <button
              type="button"
              onClick={handleTrial}
              className="mt-2 w-full rounded-2xl border border-border/60 py-2.5 text-sm font-semibold text-foreground"
            >
              Start gratis prøveperiode
            </button>
          )}

          <div className="mt-2 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => toast('Fant ingen tidligere kjøp')}
              className="py-1.5 text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
            >
              Gjenopprett kjøp
            </button>
            <button
              type="button"
              onClick={close}
              className="py-1.5 text-xs font-medium text-muted-foreground"
            >
              Nei takk, jeg er blakk
            </button>
          </div>

          <p className="mt-1 flex items-center justify-center gap-1 text-[9px] text-muted-foreground/70">
            <Lock className="h-2.5 w-2.5" /> Tøysefunksjon — ingenting belastes, ingenting lagres.
          </p>
        </div>
      </div>
    </div>
  );
}
