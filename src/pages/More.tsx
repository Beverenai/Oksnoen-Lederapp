import { NavLink } from 'react-router-dom';
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
  Settings,
  LogOut,
  Bell,
  Skull,
  ShoppingBasket,
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

type MoreItem = {
  to?: string;
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
};

type MoreSection = {
  label: string;
  items: MoreItem[];
};

function Tile({ item }: { item: MoreItem }) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card/70 backdrop-blur px-3 py-5 text-center shadow-sm hover:bg-card transition-colors active:scale-[0.98]">
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
  const { isAdmin, isNurse, logout, leader, effectiveLeader } = useAuth();
  const sweatersEnabled = useSweatersEnabled();
  const { data: murderState } = useMyMurderState();
  const [hasScheduleImage, setHasScheduleImage] = useState(false);
  const [notificationSheetOpen, setNotificationSheetOpen] = useState(false);
  const [periodLabel, setPeriodLabel] = useState<string | null>(null);

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

  const sections: MoreSection[] = [
    {
      label: 'Min side',
      items: [
        { to: '/profile', icon: User, label: 'Min Profil' },
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
        ...(isNurse || isAdmin
          ? [{ to: '/nurse', icon: Heart, label: 'Nurse' } as MoreItem]
          : []),
        ...(isAdmin
          ? [
              { to: '/participant-stats', icon: BarChart2, label: 'Deltagere' } as MoreItem,
            ]
          : []),
      ],
    },
    {
      label: 'Konto',
      items: [
        ...(isAdmin
          ? [
              {
                icon: Bell,
                label: 'Hurtigvarslinger',
                onClick: () => setNotificationSheetOpen(true),
              } as MoreItem,
            ]
          : []),
        { icon: LogOut, label: 'Logg ut', onClick: () => logout() },
      ],
    },
  ];

  const firstName = (leader?.name || '').split(' ')[0] || '';

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 pb-6">
      <header className="pt-1">
        <h1 className="text-2xl font-heading font-bold text-foreground">
          Hei{firstName ? `, ${firstName}` : ''} <span aria-hidden>👋</span>
        </h1>
        <p className="text-sm text-muted-foreground">Alle sider og funksjoner</p>
      </header>

      {isAdmin && (
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
          <section key={section.label} className="space-y-2">
            <div className={cn(
              'px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground',
            )}>
              {section.label}
            </div>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {section.items.map((item, i) => (
                <Tile key={`${section.label}-${i}`} item={item} />
              ))}
            </div>
          </section>
        ),
      )}

      <QuickNotificationSheet
        open={notificationSheetOpen}
        onOpenChange={setNotificationSheetOpen}
      />
    </div>
  );
}