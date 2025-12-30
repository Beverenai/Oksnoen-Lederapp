import { ReactNode, useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  Home, 
  Users, 
  Building2, 
  Calendar, 
  AlertTriangle,
  Settings,
  LogOut,
  Menu,
  X,
  Heart,
  User,
  Wrench,
  Check,
  BarChart2,
  Bell,
  Anchor,
  Map,
  BookOpen,
  LucideIcon,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import oksnoenLogo from '@/assets/oksnoen-logo.png';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { PassIcon } from '@/components/icons/PassIcon';
import { QuickNotificationSheet } from '@/components/admin/QuickNotificationSheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface AppLayoutProps {
  children: ReactNode;
}

// Type for nav items that can use either Lucide icons or custom components
type NavItem = {
  to: string;
  icon: LucideIcon | typeof PassIcon;
  label: string;
};

// Navigation groups
const mainNavItems: NavItem[] = [
  { to: '/', icon: Home, label: 'Hjem' },
  { to: '/profile', icon: User, label: 'Min Profil' },
  { to: '/my-cabins', icon: Building2, label: 'Din Hytte' },
];

const leaderNavItems: NavItem[] = [
  { to: '/leaders', icon: Users, label: 'Ledere' },
  { to: '/passport', icon: PassIcon, label: 'Passkontroll' },
  { to: '/rope-control', icon: Anchor, label: 'Tau Kontroll' },
];

// Dynamic content items
const scheduleNavItem: NavItem = { to: '/schedule', icon: Calendar, label: 'Vaktplan' };
const importantInfoNavItem: NavItem = { to: '/important-info', icon: AlertTriangle, label: 'Viktig info' };
const fixNavItem: NavItem = { to: '/fix', icon: Wrench, label: 'FIX' };
const skjaerNavItem: NavItem = { to: '/skjaer', icon: Map, label: 'Skjær' };
const storiesNavItem: NavItem = { to: '/stories', icon: BookOpen, label: 'Historier' };

// Special access items
const nurseNavItem: NavItem = { to: '/nurse', icon: Heart, label: 'Nurse' };
const participantsNavItem: NavItem = { to: '/participant-stats', icon: BarChart2, label: 'Deltagere' };
const adminNavItem: NavItem = { to: '/admin', icon: Settings, label: 'Admin' };

// Bottom nav items type
type BottomNavItem = {
  to: string;
  icon: LucideIcon | typeof PassIcon;
  label: string;
  isHajolo?: boolean;
};

// Base bottom nav items - will be adjusted based on role
const getBottomNavItems = (isAdmin: boolean, isNurse: boolean): BottomNavItem[] => {
  if (isAdmin) {
    return [
      { to: '/', icon: Home, label: 'Hjem' },
      { to: '/leaders', icon: Users, label: 'Ledere' },
      { to: '/admin', icon: Settings, label: 'Dashboard' },
      { to: '/passport', icon: PassIcon, label: 'Passkontor' },
      { to: '/fix', icon: Wrench, label: 'Fix' },
    ];
  } else if (isNurse) {
    return [
      { to: '/', icon: Home, label: 'Hjem' },
      { to: '/leaders', icon: Users, label: 'Ledere' },
      { to: '/nurse', icon: Heart, label: 'Nurse' },
      { to: '/passport', icon: PassIcon, label: 'Passkontor' },
      { to: '/fix', icon: Wrench, label: 'Fix' },
    ];
  } else {
    return [
      { to: '/', icon: Home, label: 'Hjem' },
      { to: '/leaders', icon: Users, label: 'Ledere' },
      { to: '#', icon: Check, label: 'Hajolo', isHajolo: true },
      { to: '/passport', icon: PassIcon, label: 'Passkontor' },
      { to: '/fix', icon: Wrench, label: 'Fix' },
    ];
  }
};

// Helper component for rendering nav links
const NavLinkItem = ({ 
  item, 
  onClick 
}: { 
  item: NavItem; 
  onClick?: () => void;
}) => (
  <NavLink
    to={item.to}
    onClick={onClick}
    className={({ isActive }) =>
      cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-foreground hover:bg-muted'
      )
    }
  >
    <item.icon className="w-5 h-5" />
    {item.label}
  </NavLink>
);

// Collapsible group component
const NavGroup = ({
  label,
  items,
  isOpen,
  onOpenChange,
  onItemClick,
}: {
  label: string;
  items: NavItem[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onItemClick?: () => void;
}) => {
  if (items.length === 0) return null;
  
  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
        {label}
        <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isOpen && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1">
        {items.map((item) => (
          <NavLinkItem key={item.to} item={item} onClick={onItemClick} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default function AppLayout({ children }: AppLayoutProps) {
  const { leader, isAdmin, isNurse, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasRead, setHasRead] = useState(false);
  const [showHajoloSuccess, setShowHajoloSuccess] = useState(false);
  const [hasScheduleImage, setHasScheduleImage] = useState(false);
  const [notificationSheetOpen, setNotificationSheetOpen] = useState(false);
  const location = useLocation();

  // Collapsible group states
  const [openGroups, setOpenGroups] = useState({
    leader: true,
    content: false,
    special: false,
  });

  // Build dynamic content items based on schedule image availability
  const contentNavItems = [
    ...(hasScheduleImage ? [scheduleNavItem] : []),
    importantInfoNavItem,
    skjaerNavItem,
    storiesNavItem,
    fixNavItem,
  ];

  // Build special access items based on role (only for nurse, not admin)
  const specialAccessItems = isNurse && !isAdmin ? [nurseNavItem] : [];

  // Auto-expand groups based on current route
  useEffect(() => {
    const leaderPaths = leaderNavItems.map(i => i.to);
    const contentPaths = contentNavItems.map(i => i.to);
    const specialPaths = ['/nurse', '/participant-stats', '/admin'];

    if (leaderPaths.includes(location.pathname)) {
      setOpenGroups(prev => ({ ...prev, leader: true }));
    }
    if (contentPaths.includes(location.pathname)) {
      setOpenGroups(prev => ({ ...prev, content: true }));
    }
    if (specialPaths.includes(location.pathname)) {
      setOpenGroups(prev => ({ ...prev, special: true }));
    }
  }, [location.pathname, hasScheduleImage]);

  // Fetch schedule image availability and subscribe to changes
  useEffect(() => {
    const fetchScheduleImage = async () => {
      const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'schedule_image_url')
        .maybeSingle();
      
      setHasScheduleImage(!!data?.value);
    };

    fetchScheduleImage();

    const channel = supabase
      .channel('schedule-image-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_config',
          filter: 'key=eq.schedule_image_url'
        },
        () => fetchScheduleImage()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Fetch has_read status for regular leaders
  const fetchHasReadStatus = useCallback(async () => {
    if (!leader || isAdmin || isNurse) return;
    
    const { data } = await supabase
      .from('leader_content')
      .select('has_read')
      .eq('leader_id', leader.id)
      .maybeSingle();
    
    setHasRead(data?.has_read ?? false);
  }, [leader, isAdmin, isNurse]);

  // Fetch and subscribe to has_read status for regular leaders
  useEffect(() => {
    if (!leader || isAdmin || isNurse) return;

    fetchHasReadStatus();

    const channel = supabase
      .channel('hajolo-status')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leader_content',
          filter: `leader_id=eq.${leader.id}`
        },
        () => fetchHasReadStatus()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leader, isAdmin, isNurse, fetchHasReadStatus]);

  // Handle Hajolo click
  const handleHajoloClick = async () => {
    if (!leader) return;

    const { error } = await supabase
      .from('leader_content')
      .upsert(
        { leader_id: leader.id, has_read: true },
        { onConflict: 'leader_id' }
      );

    if (error) {
      toast.error('Kunne ikke bekrefte');
      return;
    }

    setHasRead(true);
    setShowHajoloSuccess(true);
    
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 }
    });
    
    setTimeout(() => setShowHajoloSuccess(false), 3000);
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-[100dvh] lg:min-h-screen bg-background flex flex-col">
      {/* Hajolo Success Overlay */}
      {showHajoloSuccess && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowHajoloSuccess(false)}
        >
          <div className="animate-scale-in bg-card rounded-3xl p-10 text-center shadow-2xl border border-border">
            <div className="text-7xl mb-4">🎉</div>
            <h2 className="text-3xl font-heading font-bold text-green-600">Hajolo!</h2>
            <p className="text-muted-foreground mt-3 text-lg">Du har bekreftet at du har lest informasjonen</p>
            <p className="text-sm text-muted-foreground/70 mt-4">Trykk hvor som helst for å lukke</p>
          </div>
        </div>
      )}

      {/* Mobile Header - hidden when menu is open */}
      {!mobileMenuOpen && (
        <header 
          className="lg:hidden fixed top-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-b border-border z-50 px-4 pt-safe flex items-center justify-between h-[calc(3.5rem+env(safe-area-inset-top,0px))]"
          style={{ transform: 'translate3d(0,0,0)', WebkitTransform: 'translate3d(0,0,0)' }}
        >
          <div className="flex items-center gap-3">
            <img src={oksnoenLogo} alt="Oksnøen" className="h-8 w-8 object-contain" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground truncate max-w-[140px]">
              {leader?.name}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              className="shrink-0"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </header>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border flex-col">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <img src={oksnoenLogo} alt="Oksnøen" className="h-10 w-10 object-contain" />
          <div>
            <h1 className="text-xl font-heading font-bold text-foreground">Oksnøen</h1>
            <p className="text-sm text-muted-foreground truncate">{leader?.name}</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {/* Main navigation - always visible */}
          <div className="space-y-1">
            {mainNavItems.map((item) => (
              <NavLinkItem key={item.to} item={item} />
            ))}
          </div>

          {/* Leader functions - collapsible */}
          <NavGroup
            label="Lederfunksjoner"
            items={leaderNavItems}
            isOpen={openGroups.leader}
            onOpenChange={(open) => setOpenGroups(prev => ({ ...prev, leader: open }))}
          />

          {/* Content - collapsible */}
          <NavGroup
            label="Innhold"
            items={contentNavItems}
            isOpen={openGroups.content}
            onOpenChange={(open) => setOpenGroups(prev => ({ ...prev, content: open }))}
          />

          {/* Special access for nurse only (not admin) - collapsible */}
          {isNurse && !isAdmin && (
            <NavGroup
              label="Spesielle tilganger"
              items={specialAccessItems}
              isOpen={openGroups.special}
              onOpenChange={(open) => setOpenGroups(prev => ({ ...prev, special: open }))}
            />
          )}

          {/* Admin items - always visible for admin */}
          {isAdmin && (
            <div className="pt-2 space-y-1">
              <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Admin
              </div>
              <NavLinkItem item={nurseNavItem} />
              <NavLinkItem item={participantsNavItem} />
              <NavLinkItem item={adminNavItem} />
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-border space-y-1">
          {isAdmin && (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
              onClick={() => setNotificationSheetOpen(true)}
            >
              <Bell className="w-5 h-5" />
              Hurtigvarslinger
            </Button>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
            onClick={logout}
          >
            <LogOut className="w-5 h-5" />
            Logg ut
          </Button>
        </div>
      </aside>

      {/* Mobile Slide-out Menu - True fullscreen from right */}
      <div
        className={cn(
          'lg:hidden fixed inset-0 bg-card z-[70] transform transition-transform duration-300 ease-out',
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        style={{ overscrollBehavior: 'contain' }}
      >
        {/* Menu Header with close button */}
        <header 
          className="fixed top-0 left-0 right-0 bg-card border-b border-border px-4 pt-safe flex items-center justify-between h-[calc(3.5rem+env(safe-area-inset-top,0px))] z-10"
        >
          <div className="flex items-center gap-3">
            <img src={oksnoenLogo} alt="Oksnøen" className="h-8 w-8 object-contain" />
            <span className="font-heading font-bold text-foreground">Oksnøen</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeMobileMenu}
            className="shrink-0"
          >
            <X className="w-5 h-5" />
          </Button>
        </header>

        {/* Menu Content - scrollable */}
        <nav className="pt-[calc(3.5rem+env(safe-area-inset-top,0px))] pb-safe overflow-y-auto h-full">
          <div className="p-4 space-y-2">
            {/* Main navigation - always visible */}
            <div className="space-y-1">
              {mainNavItems.map((item) => (
                <NavLinkItem key={item.to} item={item} onClick={closeMobileMenu} />
              ))}
            </div>

            {/* Leader functions - collapsible */}
            <NavGroup
              label="Lederfunksjoner"
              items={leaderNavItems}
              isOpen={openGroups.leader}
              onOpenChange={(open) => setOpenGroups(prev => ({ ...prev, leader: open }))}
              onItemClick={closeMobileMenu}
            />

            {/* Content - collapsible */}
            <NavGroup
              label="Innhold"
              items={contentNavItems}
              isOpen={openGroups.content}
              onOpenChange={(open) => setOpenGroups(prev => ({ ...prev, content: open }))}
              onItemClick={closeMobileMenu}
            />

            {/* Special access for nurse only (not admin) - collapsible */}
            {isNurse && !isAdmin && (
              <NavGroup
                label="Spesielle tilganger"
                items={specialAccessItems}
                isOpen={openGroups.special}
                onOpenChange={(open) => setOpenGroups(prev => ({ ...prev, special: open }))}
                onItemClick={closeMobileMenu}
              />
            )}

            {/* Admin items - always visible for admin */}
            {isAdmin && (
              <div className="pt-2 space-y-1">
                <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Admin
                </div>
                <NavLinkItem item={nurseNavItem} onClick={closeMobileMenu} />
                <NavLinkItem item={participantsNavItem} onClick={closeMobileMenu} />
                <NavLinkItem item={adminNavItem} onClick={closeMobileMenu} />
              </div>
            )}
            
            <div className="pt-4 space-y-1">
              {isAdmin && (
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    closeMobileMenu();
                    setNotificationSheetOpen(true);
                  }}
                >
                  <Bell className="w-5 h-5" />
                  Hurtigvarslinger
                </Button>
              )}
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  closeMobileMenu();
                  logout();
                }}
              >
                <LogOut className="w-5 h-5" />
                Logg ut
              </Button>
            </div>
          </div>
        </nav>
      </div>

      {/* Mobile Bottom Navigation - iOS-style floating tab bar */}
      {!mobileMenuOpen && (
        <nav 
          className="lg:hidden mobile-bottom-nav fixed bottom-0 left-0 right-0 z-30"
          style={{ 
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            WebkitTransform: 'translate3d(0,0,0)',
            transform: 'translate3d(0,0,0)'
          }}
        >
          {/* Blurred background layer */}
          <div 
            className="absolute inset-0 bg-card/80 backdrop-blur-xl border-t border-border/50"
            style={{ WebkitBackdropFilter: 'blur(20px)', backdropFilter: 'blur(20px)' }}
          />
          
          {/* Tab bar content */}
          <div className="relative h-[52px] flex items-center justify-evenly px-2">
            {getBottomNavItems(isAdmin, isNurse).map((item) => {
              const isActive = location.pathname === item.to;
              
              if (item.isHajolo) {
                return (
                  <button
                    key="hajolo"
                    onClick={handleHajoloClick}
                    className="flex flex-col items-center justify-center min-w-[64px] min-h-[48px] -mt-3"
                  >
                    <div
                      className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-elevated border-[3px] border-card',
                        hasRead ? 'bg-success' : 'bg-destructive'
                      )}
                    >
                      <Check className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-[10px] font-medium mt-0.5 text-foreground">{item.label}</span>
                  </button>
                );
              }
              
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="flex flex-col items-center justify-center min-w-[64px] min-h-[48px] transition-colors"
                >
                  <item.icon 
                    className={cn(
                      'w-[22px] h-[22px] transition-colors',
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    )} 
                    size={22}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span className={cn(
                    'text-[10px] font-medium mt-0.5 transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}>
                    {item.label}
                  </span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="lg:ml-64 pt-[calc(3.5rem+env(safe-area-inset-top,0px))] lg:pt-0 pb-[calc(52px+env(safe-area-inset-bottom,0px)+16px)] lg:pb-0 flex-1 lg:min-h-screen">
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>

      {/* Quick Notification Sheet for Admin */}
      <QuickNotificationSheet 
        open={notificationSheetOpen} 
        onOpenChange={setNotificationSheetOpen} 
      />
    </div>
  );
}
