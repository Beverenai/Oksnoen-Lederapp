import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Circle, HeartHandshake, Beer } from 'lucide-react';
import { TinderIcon } from '@/components/icons/TinderIcon';
import { supabase } from '@/integrations/supabase/client';
import { SnusCan3D } from '@/components/snus/SnusCan3D';
import { getSnusProduct, customSnusProduct } from '@/lib/snusCatalog';
import { useIncomingHookupCount } from '@/hooks/useHookups';
import { useSipsLeft, useUnopenedSipCount, useMyDrink } from '@/hooks/useSips';
import { DRINKS } from '@/lib/drinkSounds';
import { OksnoenPlusDialog } from '@/components/offseason/OksnoenPlusDialog';
import { PlusPerkTiles } from '@/components/offseason/PlusPerkTiles';
import { BentoTile } from '@/components/offseason/BentoTile';
import { usePovCurrentRoll } from '@/hooks/usePov';
import povHero from '@/assets/pov-hero.jpg.asset.json';
import { Camera } from 'lucide-react';
import { LederpassStrip } from '@/components/offseason/LederpassStrip';
import { HomeNotifications } from '@/components/home/HomeNotifications';
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
  const { data: sipsLeft = 0 } = useSipsLeft();
  const { drink: myDrink } = useMyDrink();
  const unopenedSips = useUnopenedSipCount();
  const { data: povRoll } = usePovCurrentRoll();
  const povLeft = povRoll?.my_shots_left ?? 0;
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
    <div className="oks-offseason-bg animate-fade-in -mx-4 space-y-6 px-4 pb-8 pt-1">
      <header className="relative flex items-start justify-between pt-1">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-oks-gold/40 bg-[var(--gradient-oks-red)] px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-oks-cream shadow-oks">
            <span className="h-1.5 w-1.5 rounded-full bg-oks-gold" />
            Off-season
          </span>
          <h1 className="mt-3 font-heading text-[28px] font-bold leading-tight text-foreground">
            Hei{firstName ? ` ${firstName}` : ''}
          </h1>
        </div>
        <div className="pt-0.5">
          <HomeNotifications />
        </div>
      </header>

      {/* POV som fotokort — samme stil som i Mer-menyen */}
      <BentoTile
        icon={Camera}
        label="POV"
        desc={povRoll ? `${povLeft} bilder igjen` : 'Ingen film i kameraet'}
        tone="paper"
        size="lg"
        image={povHero.url}
        onClick={() => navigate('/pov')}
        className="mt-1"
      />

      {/* Avrevne papirstrimler */}
      <div className="grid grid-cols-2 gap-3">
        <BentoTile
          icon={TinderIcon}
          label="Tinder"
          desc="Sveip på ledere"
          tone="sunset"
          size="lg"
          visual={<TinderIcon className="h-6 w-6" />}
          className="bg-[linear-gradient(140deg,#ff6036_0%,#fd267d_55%,#e1136b_100%)] border-white/25 text-white [&_*]:!opacity-100"
          onClick={() => navigate('/kline-tinder')}
        />
        <BentoTile
          icon={Beer}
          label="Gi slurker"
          desc={`${DRINKS[myDrink].emoji.repeat(Math.min(sipsLeft, 5))} ${sipsLeft} igjen`}
          tone="red"
          size="lg"
          visual={<span className="text-[26px] leading-none">{DRINKS[myDrink].emoji}</span>}
          count={unopenedSips || undefined}
          className="bg-[linear-gradient(140deg,#f7b733_0%,#e08908_50%,#a8410a_100%)] border-oks-gold/50 text-white"
          onClick={() => navigate('/slurker')}
        />
        <BentoTile
          icon={HeartHandshake}
          label="Klineliste"
          desc="Kartet"
          tone="night"
          count={incomingHookups || undefined}
          onClick={() => navigate('/klineliste')}
        />
        <BentoTile
          icon={Circle}
          label="Snus"
          desc="Din boks"
          tone="night"
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
      </div>

      {/* Lederpasset som bokbind-bånd */}
      <LederpassStrip leader={leader} periodLabel={periodLabel} />

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

      <OksnoenPlusDialog open={plusOpen} onOpenChange={setPlusOpen} />
    </div>
  );
}