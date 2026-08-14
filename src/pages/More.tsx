import { NavLink, useNavigate } from 'react-router-dom';
import {
  User,
  Building2,
  ClipboardList,
  Anchor,
  Shirt,
  Calendar,
  AlertTriangle,
  Wrench,
  Map,
  BookOpen,
  Heart,
  BarChart2,
  LayoutDashboard,
  Settings,
  LogOut,
  Bell,
  Skull,
  ShoppingBasket,
  ChefHat,
  Mail,
  HeartHandshake,
  Flame,
  Lightbulb,
  LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSweatersEnabled } from '@/hooks/useSweatersEnabled';
import { QuickNotificationSheet } from '@/components/admin/QuickNotificationSheet';
import { useMyMurderState } from '@/hooks/useMurderGame';
import { cn } from '@/lib/utils';
import { hapticImpact } from '@/lib/capacitorHaptics';
import { LederPassMini } from '@/components/passport/LederPassMini';
import { useMailboxUnreadCount } from '@/hooks/useMailbox';
import { useHookupsEnabled, useIncomingHookupCount } from '@/hooks/useHookups';
import { useAppMode } from '@/hooks/useAppMode';
import { isLimitedAccessRoute } from '@/lib/limitedAccess';
import { IdCard, MessageCircle, Circle, Crown, Camera } from 'lucide-react';
import { OksnoenPlusDialog } from '@/components/offseason/OksnoenPlusDialog';
import { PlusPerkTiles } from '@/components/offseason/PlusPerkTiles';
import { BentoTile, type BentoTone, type BentoSize } from '@/components/offseason/BentoTile';
import povHero from '@/assets/pov-hero.jpg.asset.json';

type MoreItem = {
  to?: string;
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  badge?: number;
  desc?: string;
  tone?: BentoTone;
  size?: BentoSize;
  image?: string;
};

type MoreSection = {
  label: string;
  items: MoreItem[];
};

function Tile({ item }: { item: MoreItem }) {
  const content = (
    <div className="relative flex flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card/70 backdrop-blur px-3 py-5 text-center shadow-sm hover:bg-card transition-colors active:scale-[0.98]">
      {!!item.badge && item.badge > 0 && (
        <span className="absolute right-2 top-2 min-w-[1.25rem] rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold leading-none text-destructive-foreground">
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
      <item.icon className="w-6 h-6 text-primary" strokeWidth={1.8} />
      <span className="text-xs font-medium text-foreground leading-tight">
        {item.label}
      </span>
    </div>
  );
  if (item.to) {
    return (
      <NavLink to={item.to} onClick={() => hapticImpact('light')} className="block">
        {content}
      </NavLink>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        hapticImpact('light');
        item.onClick?.();
      }}
      className="block w-full text-left"
    >
      {content}
    </button>
  );
}

export default function More() {
  const { isAdmin, isNurse, isKitchen, isSuperAdmin, isLimitedAccess, logout, leader, effectiveLeader } = useAuth();
  const navigate = useNavigate();
  const { mode: appMode } = useAppMode();
  const limited = (appMode === 'inactive' || isLimitedAccess) && !isSuperAdmin;
  const sweatersEnabled = useSweatersEnabled();
  const { data: murderState } = useMyMurderState();
  const { data: mailboxUnread } = useMailboxUnreadCount(!!isAdmin);
  const hookupsEnabled = useHookupsEnabled();
  const incomingHookups = useIncomingHookupCount();
  const [hasScheduleImage, setHasScheduleImage] = useState(false);
  const [notificationSheetOpen, setNotificationSheetOpen] = useState(false);
  const [periodLabel, setPeriodLabel] = useState<string | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('periods')
      .select('name')
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setPeriodLabel(data?.name ?? null);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchScheduleImage = async () => {
      const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'schedule_image_url')
        .maybeSingle();
      if (!cancelled) setHasScheduleImage(!!data?.value);
    };
    fetchScheduleImage();
    const channel = supabase
      .channel('more-schedule-image')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_config',
          filter: 'key=eq.schedule_image_url',
        },
        () => fetchScheduleImage(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const adminTopItems: MoreItem[] = [
    ...(isAdmin
      ? [
          {
            to: '/admin/dashboard',
            icon: LayoutDashboard,
            label: 'Dashboard',
          } as MoreItem,
          {
            icon: Bell,
            label: 'Varslinger',
            onClick: () => setNotificationSheetOpen(true),
          } as MoreItem,
        ]
      : []),
    ...(isNurse || isAdmin
      ? [{ to: '/nurse', icon: Heart, label: 'Nurse' } as MoreItem]
      : []),
    ...(isAdmin
      ? [{ to: '/participant-stats', icon: BarChart2, label: 'Deltagere' } as MoreItem]
      : []),
  ];

  const fullSections: MoreSection[] = [
    ...(adminTopItems.length > 0
      ? [{ label: 'Admin', items: adminTopItems }]
      : []),
    {
      label: 'Min side',
      items: [
        { to: '/profile', icon: User, label: 'Min Profil' },
        { to: '/chat', icon: MessageCircle, label: 'Lederhuset' },
        { to: '/my-cabins', icon: Building2, label: 'Din Hytte' },
        { to: '/my-shifts', icon: ClipboardList, label: 'Min vakt' },
      ],
    },
    {
      label: 'Ledelse',
      items: [
        { to: '/rope-control', icon: Anchor, label: 'Tau Kontroll' },
        { to: '/kiosk', icon: ShoppingBasket, label: 'Gomla' },
        { to: '/gjenglemt', icon: Shirt, label: 'Gjenglemt' },
        ...(sweatersEnabled
          ? [{ to: '/gensere', icon: Shirt, label: 'Gensere' } as MoreItem]
          : []),
        ...(hasScheduleImage
          ? [{ to: '/schedule', icon: Calendar, label: 'Vaktplan' } as MoreItem]
          : []),
      ],
    },
    {
      label: 'Innhold',
      items: [
        { to: '/important-info', icon: AlertTriangle, label: 'Viktig info' },
        { to: '/fix', icon: Wrench, label: 'FIX' },
        {
          to: '/postkasse',
          icon: Mail,
          label: 'Postkasse',
          ...(isAdmin ? { badge: mailboxUnread ?? 0 } : {}),
        },
        ...(isAdmin
          ? [
              { to: '/skjaer', icon: Map, label: 'Skjær' } as MoreItem,
              { to: '/stories', icon: BookOpen, label: 'Historier' } as MoreItem,
            ]
          : []),
      ],
    },
    {
      label: 'Spesial',
      items: [
        ...(murderState?.is_active
          ? [{ to: '/morder', icon: Skull, label: 'Morderleken' } as MoreItem]
          : []),
        ...(isKitchen || isAdmin
          ? [{ to: '/kjokken', icon: ChefHat, label: 'Kjøkken' } as MoreItem]
          : []),
        ...(hookupsEnabled || isAdmin
          ? [
              {
                to: '/klineliste',
                icon: HeartHandshake,
                label: 'Klineliste',
                badge: incomingHookups,
              } as MoreItem,
            ]
          : []),
        { to: '/kline-tinder', icon: Flame, label: 'Øksnøen Tinder' } as MoreItem,
        { to: '/pov', icon: Camera, label: 'Øksnøen POV' } as MoreItem,
        { icon: Crown, label: 'Øksnøen +', onClick: () => setPlusOpen(true) } as MoreItem,
        { to: '/feedback', icon: Lightbulb, label: 'Feedback' } as MoreItem,
      ],
    },
    {
      label: 'Konto',
      items: [{ icon: LogOut, label: 'Logg ut', onClick: () => logout() }],
    },
  ];

  const firstName = (leader?.name || '').split(' ')[0] || '';

  // Off-season / inactive leaders: only the allowed surfaces.
  const limitedSections: MoreSection[] = [
    {
      label: 'Off-season',
      items: [
        {
          to: '/pov',
          icon: Camera,
          label: 'Øksnøen POV',
          desc: 'Engangskamera',
          tone: 'paper',
          size: 'lg',
          image: povHero.url,
        },
        { to: '/kline-tinder', icon: Flame, label: 'Øksnøen Tinder', desc: 'Sveip på ledere', tone: 'sunset', size: 'lg' },
        { to: '/lederpass', icon: IdCard, label: 'Lederpass', desc: 'Stempler', tone: 'red' },
        {
          to: '/klineliste',
          icon: HeartHandshake,
          label: 'Klineliste',
          desc: 'Kartet',
          tone: 'night',
          badge: incomingHookups,
        },
        { to: '/snus', icon: Circle, label: 'Snus', desc: 'Din boks', tone: 'night' },
        { to: '/chat', icon: MessageCircle, label: 'Lederhuset', desc: 'Chatten', tone: 'forest' },
        { to: '/profile', icon: User, label: 'Min Profil', desc: 'Bilde og info', tone: 'cream' },
        { icon: Crown, label: 'Øksnøen +', desc: 'Se abonnementet', tone: 'gold', onClick: () => setPlusOpen(true) },
        { to: '/feedback', icon: Lightbulb, label: 'Feedback', desc: 'Nye ideer', tone: 'paper' },
      ],
    },
    {
      label: 'Konto',
      items: [{ icon: LogOut, label: 'Logg ut', tone: 'cream', onClick: () => logout() }],
    },
  ];

  const sections: MoreSection[] = limited
    ? limitedSections.map((s) => ({
        ...s,
        items: s.items.filter((i) => !i.to || isLimitedAccessRoute(i.to)),
      }))
    : fullSections;

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-2xl space-y-6 pb-8',
        limited && 'pt-1',
      )}
    >
      <header className="pt-1">
        {limited && (
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-oks-gold/40 bg-[var(--gradient-oks-red)] px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-oks-cream shadow-oks">
            <span className="h-1.5 w-1.5 rounded-full bg-oks-gold" />
            Off-season
          </span>
        )}
        <h1 className="text-[26px] font-heading font-bold leading-tight text-foreground">
          Hei{firstName ? `, ${firstName}` : ''} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Alle sider og funksjoner</p>
      </header>

      {isAdmin && !limited && (
        <NavLink
          to="/admin"
          onClick={() => hapticImpact('medium')}
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground px-4 py-4 shadow-md active:scale-[0.99] transition-transform"
        >
          <Settings className="w-5 h-5" strokeWidth={2} />
          <span className="text-base font-semibold">Admin</span>
        </NavLink>
      )}

      <LederPassMini leader={effectiveLeader ?? leader} periodLabel={periodLabel} />

      {sections.map((section) =>
        section.items.length === 0 ? null : (
          <section key={section.label} className="space-y-2.5">
            <div className="px-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {section.label}
            </div>
            {limited ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {section.items.map((item, i) => (
                  <BentoTile
                    key={`${section.label}-${i}`}
                    icon={item.icon}
                    label={item.label}
                    desc={item.desc}
                    tone={item.tone ?? 'cream'}
                    size={item.size ?? 'sm'}
                    image={item.image}
                    count={item.badge || undefined}
                    onClick={() => {
                      if (item.to) navigate(item.to);
                      else item.onClick?.();
                    }}
                    className={
                      item.size === 'lg' || item.size === 'md' ? 'sm:col-span-2' : undefined
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
                {section.items.map((item, i) => (
                  <Tile key={`${section.label}-${i}`} item={item} />
                ))}
              </div>
            )}
          </section>
        ),
      )}

      {limited && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Øksnøen <span className="oks-gold-text">+</span>
            </div>
            <button
              type="button"
              onClick={() => setPlusOpen(true)}
              className="text-[11px] font-semibold oks-gold-text"
            >
              Se abonnement
            </button>
          </div>
          <PlusPerkTiles onLocked={() => setPlusOpen(true)} />
        </section>
      )}

      <QuickNotificationSheet
        open={notificationSheetOpen}
        onOpenChange={setNotificationSheetOpen}
      />

      <OksnoenPlusDialog open={plusOpen} onOpenChange={setPlusOpen} />
    </div>
  );
}