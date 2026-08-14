import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Circle, HeartHandshake, IdCard, Crown, Flame, Camera, Lightbulb } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LederPass } from '@/components/passport/LederPass';
import { SnusCan3D } from '@/components/snus/SnusCan3D';
import { getSnusProduct, customSnusProduct } from '@/lib/snusCatalog';
import { useIncomingHookupCount } from '@/hooks/useHookups';
import { OksnoenPlusDialog } from '@/components/offseason/OksnoenPlusDialog';
import { PlusPerkTiles } from '@/components/offseason/PlusPerkTiles';
import { BentoTile } from '@/components/offseason/BentoTile';
import type { Leader } from '@/types/database';

/**
 * Hjem-siden off-season / for ledere som ikke er aktive i perioden.
 * Lederpasset er hovedattraksjonen, med snarveier til de morsomme
 * funksjonene som fortsatt er åpne (snus, klineliste, ledersnakk).
 */
export function OffSeasonHome({
  leader,
  periodLabel,
}: {
  leader: Leader | null | undefined;
  periodLabel?: string | null;
}) {
  const navigate = useNavigate();
  const incomingHookups = useIncomingHookupCount();
  const [mySnus, setMySnus] = useState<{ productId: string | null; customLabel: string | null } | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!leader?.id) { setMySnus(null); return; }
      const { data } = await supabase
        .from('leaders')
        .select('snus_user, snus_product_id, snus_custom_label')
        .eq('id', leader.id)
        .maybeSingle();
      if (cancelled) return;
      setMySnus(
        data?.snus_user
          ? { productId: data.snus_product_id ?? null, customLabel: data.snus_custom_label ?? null }
          : null,
      );
    };
    run();
    return () => { cancelled = true; };
  }, [leader?.id]);

  const firstName = (leader?.name || '').split(' ')[0] || '';

  return (
    <div className="oks-offseason-bg animate-fade-in -mx-4 space-y-7 px-4 pb-8 pt-1">
      <header className="pt-1">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-oks-gold/40 bg-[var(--gradient-oks-red)] px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-oks-cream shadow-oks">
          <span className="h-1.5 w-1.5 rounded-full bg-oks-gold" />
          Off-season
        </span>
        <h1 className="mt-3 text-[28px] font-heading font-bold leading-tight text-foreground">
          Hei{firstName ? `, ${firstName}` : ''} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1 max-w-[26rem] text-sm text-muted-foreground">
          Passet ditt, snusen og klinelista er åpne året rundt.
        </p>
      </header>

      {/* Bento-grid med off-season-funksjonene */}
      <div className="grid grid-cols-2 gap-3">
        <BentoTile
          icon={Flame}
          label="Øksnøen Tinder"
          desc="Sveip på ledere — match hvis begge sveiper ja"
          tone="sunset"
          size="lg"
          onClick={() => navigate('/kline-tinder')}
        />
        <BentoTile
          icon={Circle}
          label="Snus"
          desc="Din boks"
          tone="navy"
          visual={
            mySnus ? (
              <SnusCan3D
                product={getSnusProduct(mySnus.productId) ?? customSnusProduct(mySnus.customLabel || 'Snus')}
                size={34}
                interactive={false}
                spin={-22}
                hideHint
              />
            ) : undefined
          }
          onClick={() => navigate('/snus')}
        />
        <BentoTile
          icon={HeartHandshake}
          label="Klineliste"
          desc="Kartet"
          tone="red"
          count={incomingHookups || undefined}
          onClick={() => navigate('/klineliste')}
        />
        <BentoTile
          icon={MessageCircle}
          label="Lederhuset"
          desc="Off-season-chatten"
          tone="cream"
          onClick={() => navigate('/chat')}
        />
        <BentoTile
          icon={Camera}
          label="Øksnøen POV"
          desc="Engangskamera"
          tone="cream"
          onClick={() => navigate('/pov')}
        />
        <BentoTile
          icon={Crown}
          label="Øksnøen +"
          desc="Se abonnementet"
          tone="gold"
          dot
          onClick={() => setPlusOpen(true)}
        />
        <BentoTile
          icon={Lightbulb}
          label="Feedback"
          desc="Foreslå nye funksjoner"
          tone="cream"
          onClick={() => navigate('/feedback')}
        />
      </div>

      {/* Låste «premium»-flater — åpner Øksnøen + (kun for gøy) */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-0.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Øksnøen <span className="oks-gold-text">+</span>
          </p>
          <button
            type="button"
            onClick={() => setPlusOpen(true)}
            className="text-[11px] font-bold uppercase tracking-wide oks-gold-text"
          >
            Se alt
          </button>
        </div>
        <PlusPerkTiles variant="row" onLocked={() => setPlusOpen(true)} />
      </section>

      <button
        type="button"
        onClick={() => navigate('/lederpass')}
        aria-label="Åpne lederpasset"
        className="w-full overflow-hidden rounded-[26px] border border-oks-gold/35 bg-card/70 shadow-oks transition-transform active:scale-[0.99]"
      >
        <div className="h-[60dvh] min-h-[380px] pointer-events-none">
          <LederPass leader={leader} fill periodLabel={periodLabel} />
        </div>
        <div className="flex items-center justify-center gap-2 border-t border-oks-gold/25 py-3.5 text-sm font-semibold text-oks-red">
          <IdCard className="h-4 w-4" />
          Åpne lederpasset
        </div>
      </button>

      <OksnoenPlusDialog open={plusOpen} onOpenChange={setPlusOpen} />
    </div>
  );
}