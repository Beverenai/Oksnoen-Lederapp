import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Beer, Crown, Loader2, Minus, Plus, Search, Sparkles, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { OksnoenPlusDialog } from '@/components/offseason/OksnoenPlusDialog';
import { useDrinkSips, useGiveSips, useMyDrink, useMySips, useOpenSip, useSipLeaders, useSipsLeft } from '@/hooks/useSips';
import { DrinkPicker } from '@/components/offseason/DrinkPicker';
import { DRINKS, type DrinkType, drinkOf, playDrinkSound } from '@/lib/drinkSounds';
import { hapticImpact } from '@/lib/capacitorHaptics';
import { cn } from '@/lib/utils';

const FAVORITES_KEY = 'oks-slurker-favorites';

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function Slurker() {
  const navigate = useNavigate();
  const { data: left = 0, isLoading: leftLoading } = useSipsLeft();
  const { data: leaders = [] } = useSipLeaders();
  const { data: sips } = useMySips();
  const give = useGiveSips();
  const openSip = useOpenSip();
  const drinkSips = useDrinkSips();
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<{ id: string; name: string; image: string | null } | null>(null);
  const [amount, setAmount] = useState(1);
  const [message, setMessage] = useState('');
  const { drink: myDrink, isSet: drinkIsSet, isLoading: drinkLoading, setDrink } = useMyDrink();
  const [plusOpen, setPlusOpen] = useState(false);
  const [drinkOpen, setDrinkOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  // Første gang: spør hva lederen drikker
  useEffect(() => {
    if (!drinkLoading && !drinkIsSet) setDrinkOpen(true);
  }, [drinkLoading, drinkIsSet]);

  const toggleFavorite = (id: string) => {
    hapticImpact('light');
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id];
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch {
        /* ignorer */
      }
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? leaders.filter((l) => l.name.toLowerCase().includes(q)) : leaders;
  }, [leaders, query]);

  const favSet = new Set(favorites);
  const favLeaders = filtered.filter((l) => favSet.has(l.id));
  const restLeaders = filtered.filter((l) => !favSet.has(l.id));

  const received = sips?.received ?? [];
  const given = sips?.given ?? [];
  const unopened = received.filter((r) => !r.opened_at);
  const totalReceived = received.reduce((sum, r) => sum + r.amount, 0);
  const toDrink = received.filter((r) => r.opened_at && !r.drunk_at);
  const undrunkAmount = toDrink.reduce((sum, r) => sum + r.amount, 0);
  const drunkAmount = received
    .filter((r) => r.drunk_at)
    .reduce((sum, r) => sum + r.amount, 0);

  // Viser hvilke drikketyper man faktisk har fått / drukket
  const mixEmojis = (rows: typeof received) => {
    const types = Array.from(new Set(rows.map((r) => drinkOf(r.drink_type))));
    return (types.length ? types : (['beer'] as DrinkType[])).map((t) => DRINKS[t].emoji).join('');
  };
  const receivedMix = mixEmojis(received);
  const drunkMix = mixEmojis(received.filter((r) => r.drunk_at));

  const handleGive = async () => {
    if (!target) return;
    try {
      await give.mutateAsync({ targetId: target.id, amount, message });
      hapticImpact('medium');
      toast.success(
        `${amount} ${amount === 1 ? 'slurk' : 'slurker'} ${DRINKS[myDrink].emoji} sendt til ${target.name}`,
      );
      setTarget(null);
      setMessage('');
      setAmount(1);
    } catch (e: any) {
      toast.error(e?.message ?? 'Klarte ikke å gi slurker');
    }
  };

  const handleOpen = async (id: string, type: DrinkType) => {
    hapticImpact('heavy');
    playDrinkSound(type);
    try {
      await openSip.mutateAsync(id);
    } catch {
      /* lyden er det viktigste */
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 pb-10 pt-1">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Tilbake"
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card lg:flex"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-heading text-lg font-bold leading-tight">Gi slurker</h1>
          <p className="text-[11px] text-muted-foreground">
            Du har 10 slurker å dele ut — bruk dem klokt
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            hapticImpact('light');
            setDrinkOpen(true);
          }}
          aria-label="Endre min drikke"
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-oks-gold/50 bg-oks-gold/10 px-3 py-1.5 active:scale-[0.97]"
        >
          <span className="text-[19px] leading-none">{DRINKS[myDrink].emoji}</span>
          <span className="text-[11.5px] font-bold text-foreground">{DRINKS[myDrink].label}</span>
        </button>
      </header>

      {/* Slurk-banken */}
      <section className="relative overflow-hidden rounded-[26px] border border-oks-gold/30 bg-[var(--gradient-oks-red)] p-5 text-oks-cream shadow-oks">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-oks-gold/25 blur-3xl"
        />
        <div className="relative flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-oks-cream/15 text-[32px] leading-none backdrop-blur">
            {DRINKS[myDrink].emoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.24em] text-oks-gold">
              Slurker igjen
            </p>
            <p className="font-heading text-[40px] font-bold leading-none">
              {leftLoading ? '–' : left}
              <span className="ml-1 text-[15px] font-semibold opacity-70">/ 10</span>
            </p>
          </div>
        </div>

        {/* Interaktiv slurke-rad: fylte øl = igjen å gi */}
        <div className="relative mt-3 flex flex-wrap gap-1.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              aria-hidden
              className={cn(
                'text-[20px] leading-none transition-all',
                i < left ? 'opacity-100' : 'opacity-25 grayscale',
              )}
            >
              {DRINKS[myDrink].emoji}
            </span>
          ))}
        </div>

        <div className="relative mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-2xl bg-oks-cream/10 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-oks-gold">Fått</p>
            <p className="font-heading text-[22px] font-bold leading-none">
              {totalReceived} {receivedMix}
            </p>
          </div>
          <div className="rounded-2xl bg-oks-cream/10 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-oks-gold">Drukket</p>
            <p className="font-heading text-[22px] font-bold leading-none">
              {drunkAmount} {drunkMix}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            hapticImpact('light');
            setPlusOpen(true);
          }}
          className="relative mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-oks-gold/50 bg-oks-gold/15 py-2.5 text-[12.5px] font-bold uppercase tracking-wide text-oks-gold"
        >
          <Crown className="h-4 w-4" />
          Få flere slurker
        </button>
      </section>

      {/* Uåpnede slurker */}
      {undrunkAmount > 0 && (
        <section className="rounded-[22px] border border-oks-gold/35 bg-oks-gold/10 p-4">
          <p className="font-heading text-[15px] font-bold text-foreground">
            Du har {undrunkAmount} {undrunkAmount === 1 ? 'slurk' : 'slurker'} å drikke{' '}
            {mixEmojis(toDrink)}
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Skål — så bekrefter du at de er drukket.
          </p>
          <Button
            onClick={async () => {
              hapticImpact('medium');
              playDrinkSound(drinkOf(toDrink[0]?.drink_type));
              try {
                await drinkSips.mutateAsync(toDrink.map((r) => r.id));
                toast.success(`Skål! Slurkene er drukket ${mixEmojis(toDrink)}`);
              } catch {
                toast.error('Klarte ikke å registrere');
              }
            }}
            disabled={drinkSips.isPending}
            className="mt-3 h-11 w-full rounded-2xl font-bold"
          >
            {drinkSips.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Jeg har drukket slurkene
          </Button>
        </section>
      )}

      {unopened.length > 0 && (
        <section className="space-y-2.5">
          <p className="px-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Uåpnet
          </p>
          {unopened.map((sip) => (
            <div
              key={sip.id}
              className="flex items-center gap-3 rounded-[22px] border border-oks-gold/35 bg-[linear-gradient(150deg,hsl(var(--oks-forest))_0%,hsl(var(--oks-night-deep))_100%)] p-3.5 text-oks-cream shadow-oks"
            >
              <Avatar className="h-11 w-11 border border-oks-gold/40">
                <AvatarImage src={sip.fromImage ?? undefined} alt="" />
                <AvatarFallback>{initials(sip.fromName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-[15px] font-bold leading-tight">
                  {sip.fromName}
                </p>
                <p className="text-[11.5px] text-oks-cream/70">
                  ga deg {sip.amount} {sip.amount === 1 ? 'slurk' : 'slurker'}{' '}
                  {DRINKS[sip.drink_type].emoji}
                  {sip.message ? ` — «${sip.message}»` : ''}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => handleOpen(sip.id, sip.drink_type)}
                className="shrink-0 rounded-full bg-oks-gold px-3.5 text-oks-red-deep hover:bg-oks-gold/90"
              >
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                Åpne {DRINKS[sip.drink_type].noun}
              </Button>
            </div>
          ))}
        </section>
      )}

      {/* Velg leder */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-0.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Gi til en leder
          </p>
          <p className="text-[11px] text-muted-foreground">
            Fått totalt: <span className="font-bold text-foreground">{totalReceived}</span>
          </p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søk etter leder"
            className="rounded-2xl pl-9"
          />
        </div>
        <div className="overflow-hidden rounded-[20px] border border-border/60 bg-card/70">
          {[
            ...(favLeaders.length ? [{ label: 'Favoritter', rows: favLeaders }] : []),
            ...(restLeaders.length
              ? [{ label: favLeaders.length ? 'Alle ledere' : null, rows: restLeaders }]
              : []),
          ].map((group) => (
            <div key={group.label ?? 'all'}>
              {group.label && (
                <p className="border-b border-border/50 bg-muted/40 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  {group.label}
                </p>
              )}
              {group.rows.map((l, i) => (
                <div
                  key={l.id}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2',
                    i > 0 && 'border-t border-border/40',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      hapticImpact('light');
                      setAmount(1);
                      setMessage('');
                      setTarget({ id: l.id, name: l.name, image: l.profile_image_url });
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={l.profile_image_url ?? undefined} alt="" />
                      <AvatarFallback className="text-[11px]">{initials(l.name)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-foreground">
                      {l.name}
                    </span>
                    {!l.is_active && (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">
                        Off
                      </span>
                    )}
                    <span className="shrink-0 text-[16px] leading-none">{DRINKS[myDrink].emoji}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(l.id)}
                    aria-label={favSet.has(l.id) ? `Fjern ${l.name} som favoritt` : `Gjør ${l.name} til favoritt`}
                    aria-pressed={favSet.has(l.id)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full active:scale-95"
                  >
                    <Star
                      className={cn(
                        'h-4 w-4',
                        favSet.has(l.id)
                          ? 'fill-oks-gold text-oks-gold'
                          : 'text-muted-foreground/50',
                      )}
                    />
                  </button>
                </div>
              ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Ingen ledere funnet.</p>
          )}
        </div>
      </section>

      {/* Gitt-logg */}
      {given.length > 0 && (
        <section className="space-y-2">
          <p className="px-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Du har gitt
          </p>
          {given.map((sip) => (
            <div
              key={sip.id}
              className="flex items-center gap-3 rounded-[18px] border border-border/50 bg-card/60 px-3 py-2.5"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={sip.toImage ?? undefined} alt="" />
                <AvatarFallback>{initials(sip.toName)}</AvatarFallback>
              </Avatar>
              <p className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">
                {sip.toName}
                {sip.message ? <span className="text-muted-foreground"> — «{sip.message}»</span> : null}
              </p>
              <span className="shrink-0 rounded-full bg-oks-gold/15 px-2 py-0.5 text-[11px] font-bold text-oks-gold">
                {sip.amount} {DRINKS[sip.drink_type].emoji}
              </span>
            </div>
          ))}
        </section>
      )}

      {/* Gi-arket */}
      <Sheet open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <SheetContent side="bottom" className="rounded-t-[28px] pb-[calc(1.25rem+var(--safe-bottom))]">
          <SheetHeader className="text-left">
            <SheetTitle className="font-heading">Gi slurker til {target?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-center gap-5">
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={() => setAmount((a) => Math.max(1, a - 1))}
                aria-label="Mindre"
              >
                <Minus className="h-5 w-5" />
              </Button>
              <div className="text-center">
                <p className="font-heading text-[44px] font-bold leading-none text-foreground">
                  {amount}
                </p>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {amount === 1 ? 'slurk' : 'slurker'} {DRINKS[myDrink].label.toLowerCase()}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={() =>
                  setAmount((a) => {
                    if (a + 1 > left) {
                      setPlusOpen(true);
                      return a;
                    }
                    return a + 1;
                  })
                }
                aria-label="Mer"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
            <p className="text-center text-[12px] text-muted-foreground">
              Du sender {DRINKS[myDrink].label.toLowerCase()} {DRINKS[myDrink].emoji} — endre drikke øverst på siden.
            </p>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Melding (valgfritt)"
              rows={2}
              className="rounded-2xl"
            />
            <Button
              onClick={handleGive}
              disabled={give.isPending || left < 1}
              className={cn('h-12 w-full rounded-2xl text-[15px] font-bold')}
            >
              {give.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Beer className="mr-2 h-4 w-4" />
              )}
              {left < 1 ? 'Tom for slurker' : `Send ${amount} ${DRINKS[myDrink].emoji}`}
            </Button>
            {left < 1 && (
              <button
                type="button"
                onClick={() => setPlusOpen(true)}
                className="w-full text-center text-[12px] font-bold uppercase tracking-wide oks-gold-text"
              >
                Få flere slurker med Øksnøen +
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Min drikke */}
      <Sheet open={drinkOpen} onOpenChange={setDrinkOpen}>
        <SheetContent side="bottom" className="rounded-t-[28px] pb-[calc(1.25rem+var(--safe-bottom))]">
          <SheetHeader className="text-left">
            <SheetTitle className="font-heading">Hva drikker du?</SheetTitle>
          </SheetHeader>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Alle slurker du gir vises og høres som denne drikken. Du kan endre den når som helst
            øverst på siden.
          </p>
          <DrinkPicker
            className="mt-4"
            value={myDrink}
            onChange={(d) => {
              setDrink.mutate(d, { onError: () => toast.error('Klarte ikke å lagre drikken') });
            }}
          />
          <Button
            className="mt-4 h-12 w-full rounded-2xl text-[15px] font-bold"
            onClick={() => setDrinkOpen(false)}
          >
            Ferdig {DRINKS[myDrink].emoji}
          </Button>
        </SheetContent>
      </Sheet>

      <OksnoenPlusDialog open={plusOpen} onOpenChange={setPlusOpen} />
    </div>
  );
}
