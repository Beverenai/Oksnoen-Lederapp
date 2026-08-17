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
  Beer,
  LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { uniqueRealtimeChannelName } from '@/lib/realtimeChannel';
import { useSweatersEnabled } from '@/hooks/useSweatersEnabled';
import { QuickNotificationSheet } from '@/components/admin/QuickNotificationSheet';
import { useMyMurderState } from '@/hooks/useMurderGame';
import { cn } from '@/lib/utils';
import { hapticImpact } from '@/lib/capacitorHaptics';
import { LederPassMini } from '@/components/passport/LederPassMini';
import { useMailboxUnreadCount } from '@/hooks/useMailbox';
import { useHookupsEnabled, useIncomingHookupCount } from '@/hooks/useHookups';
import { useUnopenedSipCount } from '@/hooks/useSips';
import { useAppMode } from '@/hooks/useAppMode';
import { isLimitedAccessRoute, isLeirskoleRoute } from '@/lib/limitedAccess';
import { useAccessMode } from '@/hooks/useViewMode';
import ViewModeSwitcher from '@/components/layout/ViewModeSwitcher';
import { IdCard, MessageCircle, Circle, Crown, Camera, ChevronRight, Tent, Users, CalendarDays } from 'lucide-react';
import { OksnoenPlusDialog } from '@/components/offseason/OksnoenPlusDialog';
import { TinderIcon } from '@/components/icons/TinderIcon';
import { usePovCurrentRoll } from '@/hooks/usePov';
import { PlusPerkTiles } from '@/components/offseason/PlusPerkTiles';
import { BentoTile, type BentoTone, type BentoSize } from '@/components/offseason/BentoTile';
import povHeroUrl from '@/assets/pov-hero-local.jpg';

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
  const { isAdmin, isNurse, isKitchen, isSuperAdmin, isLimitedAccess, isLeirskole, logout, leader, effectiveLeader } = useAuth();
  const navigate = useNavigate();
  const { mode: appMode } = useAppMode();
  const { limited, leirskoleView, mode: accessMode } = useAccessMode();
  const sweatersEnabled = useSweatersEnabled();
  const { data: murderState } = useMyMurderState();
  const { data: mailboxUnread } = useMailboxUnreadCount(!!isAdmin);
  const hookupsEnabled = useHookupsEnabled();
  const incomingHookups = useIncomingHookupCount();
  const unopenedSips = useUnopenedSipCount();
  const { data: povRoll } = usePovCurrentRoll();
  const povShotsLeft = povRoll?.my_shots_left ?? 0;
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
      .channel(uniqueRealtimeChannelName('more-schedule-image'))
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
    ...(isAdmin
      ? [{ to: '/admin/leirskole', icon: Tent, label: 'Leirskole' } as MoreItem]
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
        ...(leirskoleView
          ? [{ to: '/leirskole', icon: Tent, label: 'Leirskole' } as MoreItem]
          : []),
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
        { to: '/kline-tinder', icon: TinderIcon, label: 'Tinder' } as MoreItem,
        { to: '/pov', icon: Camera, label: 'POV' } as MoreItem,
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
  // Off-season: hjemskjermen har allerede POV, Tinder, Slurker, Klineliste og Snus,
  // så «Mer» er en kompakt liste med resten – ingen doble knapper.
  const limitedSections: MoreSection[] = [
    {
      label: 'Ditt',
      items: [
        { to: '/lederpass', icon: IdCard, label: 'Lederpass', desc: 'Stemplene dine' },
        { to: '/profile', icon: User, label: 'Min Profil', desc: 'Bilde, snus og drikke' },
        { to: '/chat', icon: MessageCircle, label: 'Lederhuset', desc: 'Off-season-chatten' },
      ],
    },
    {
      label: 'Mer moro',
      items: [
        { icon: Crown, label: 'Øksnøen +', desc: 'Se abonnementet', onClick: () => setPlusOpen(true) },
        { to: '/feedback', icon: Lightbulb, label: 'Feedback', desc: 'Foreslå nye funksjoner' },
      ],
    },
    {
      label: 'Konto',
      items: [{ icon: LogOut, label: 'Logg ut', onClick: () => logout() }],
    },
  ];

  const leirskoleSections: MoreSection[] = [
    ...(isAdmin
      ? [{
          label: 'Admin',
          items: [
            {
              to: '/admin/leirskole',
              icon: LayoutDashboard,
              label: 'Leirskole-admin',
              desc: 'Vaktplan, ledere og oppgaver',
            } as MoreItem,
          ],
        }]
      : []),
    {
      label: 'Leirskole',
      items: [
        { to: '/leirskole', icon: Tent, label: 'Leirskole', desc: 'Uke, neste vakt og mine vakter' },
        { to: '/leirskole/vaktplan', icon: CalendarDays, label: 'Hele vaktplanen', desc: 'Alle vakter og aktiviteter' },
        { to: '/leirskole/oppgaver', icon: ClipboardList, label: 'Oppgaver', desc: 'Oppgaver og min kompetanse' },
        { to: '/leaders', icon: Users, label: 'Ledere', desc: 'Kontakt og vakter' },
        { to: '/chat', icon: MessageCircle, label: 'Leirskole-chat', desc: 'Egen kanal i Lederhuset' },
      ],
    },
    {
      label: 'Ditt',
      items: [
        { to: '/profile', icon: User, label: 'Min Profil', desc: 'Bilde og innstillinger' },
      ],
    },
    {
      label: 'Konto',
      items: [{ icon: LogOut, label: 'Logg ut', onClick: () => logout() }],
    },
  ];

  const sections: MoreSection[] = accessMode === 'leirskole'
    ? leirskoleSections
    : limited
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
        {accessMode === 'leirskole' ? (
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Leirskole
          </span>
        ) : limited ? (
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-oks-gold/40 bg-[var(--gradient-oks-red)] px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-oks-cream shadow-oks">
            <span className="h-1.5 w-1.5 rounded-full bg-oks-gold" />
            Off-season
          </span>
        ) : null}
        <h1 className="text-[26px] font-heading font-bold leading-tight text-foreground">
          Hei{firstName ? `, ${firstName}` : ''} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Alle sider og funksjoner</p>
      </header>

      <ViewModeSwitcher />

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

      {accessMode !== 'leirskole' && (
        <LederPassMini leader={effectiveLeader ?? leader} periodLabel={periodLabel} />
      )}

      {sections.map((section) =>
        section.items.length === 0 ? null : (
          <section key={section.label} className="space-y-2.5">
            <div className="px-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {section.label}
            </div>
            {limited ? (
              <div className="overflow-hidden rounded-[22px] border border-border/60 bg-card/70 backdrop-blur">
                {section.items.map((item, i) => (
                  <button
                    key={`${section.label}-${i}`}
                    type="button"
                    onClick={() => {
                      hapticImpact('light');
                      if (item.to) navigate(item.to);
                      else item.onClick?.();
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-muted/40',
                      i > 0 && 'border-t border-border/50',
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-oks-gold/15 text-oks-gold">
                      <item.icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold text-foreground">
                        {item.label}
                      </span>
                      {item.desc && (
                        <span className="block truncate text-[11.5px] text-muted-foreground">
                          {item.desc}
                        </span>
                      )}
                    </span>
                    {!!item.badge && item.badge > 0 && (
                      <span className="min-w-[1.25rem] rounded-full bg-destructive px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-destructive-foreground">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
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

      {limited && accessMode !== 'leirskole' && (
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
