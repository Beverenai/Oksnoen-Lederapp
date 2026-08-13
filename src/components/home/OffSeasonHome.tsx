import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Circle, HeartHandshake, IdCard, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LederPass } from '@/components/passport/LederPass';
import { HomeQuickActions, type QuickAction } from '@/components/home/HomeQuickActions';
import { SnusCan3D } from '@/components/snus/SnusCan3D';
import { getSnusProduct, customSnusProduct } from '@/lib/snusCatalog';
import { useIncomingHookupCount } from '@/hooks/useHookups';
import { OksnoenPlusDialog } from '@/components/offseason/OksnoenPlusDialog';
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

  const actions: QuickAction[] = [
    {
      key: 'snus',
      icon: Circle,
      label: 'Snus',
      visual: mySnus ? (
        <SnusCan3D
          product={getSnusProduct(mySnus.productId) ?? customSnusProduct(mySnus.customLabel || 'Snus')}
          size={36}
          interactive={false}
          spin={-22}
          hideHint
        />
      ) : undefined,
      onClick: () => navigate('/snus'),
    },
    {
      key: 'klineliste',
      icon: HeartHandshake,
      label: 'Klineliste',
      count: incomingHookups || undefined,
      onClick: () => navigate('/klineliste'),
    },
    {
      key: 'chat',
      icon: MessageCircle,
      label: 'Lederhuset',
      onClick: () => navigate('/chat'),
    },
    {
      key: 'plus',
      icon: Crown,
      label: 'Øksnøen +',
      badge: true,
      onClick: () => setPlusOpen(true),
    },
  ];

  return (
    <div className="animate-fade-in space-y-5 pb-6">
      <header className="pt-1 text-center">
        <Badge variant="secondary" className="text-xs">Off-season</Badge>
        <h1 className="mt-2 text-2xl font-heading font-bold text-foreground">
          Hei{firstName ? `, ${firstName}` : ''} <span aria-hidden>👋</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Passet ditt, snusen og klinelista er åpne året rundt.
        </p>
      </header>

      <HomeQuickActions actions={actions} />

      <button
        type="button"
        onClick={() => navigate('/lederpass')}
        aria-label="Åpne lederpasset"
        className="w-full rounded-3xl overflow-hidden border border-border/60 bg-card/60 shadow-sm active:scale-[0.99] transition-transform"
      >
        <div className="h-[60dvh] min-h-[380px] pointer-events-none">
          <LederPass leader={leader} fill periodLabel={periodLabel} />
        </div>
        <div className="flex items-center justify-center gap-2 py-3 text-sm font-medium text-muted-foreground">
          <IdCard className="h-4 w-4" />
          Åpne lederpasset
        </div>
      </button>

      <OksnoenPlusDialog open={plusOpen} onOpenChange={setPlusOpen} />
    </div>
  );
}