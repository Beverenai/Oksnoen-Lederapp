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
  Megaphone, 
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
  LucideIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import oksnoenLogo from '@/assets/oksnoen-logo.png';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { PassIcon } from '@/components/icons/PassIcon';
import { QuickNotificationSheet } from '@/components/admin/QuickNotificationSheet';

interface AppLayoutProps {
  children: ReactNode;
}

// Type for nav items that can use either Lucide icons or custom components
type NavItem = {
  to: string;
  icon: LucideIcon | typeof PassIcon;
  label: string;
};

// Navigation items that are always shown
const baseNavItems: NavItem[] = [
  { to: '/', icon: Home, label: 'Hjem' },
  { to: '/profile', icon: User, label: 'Min Profil' },
  { to: '/leaders', icon: Users, label: 'Ledere' },
  { to: '/passport', icon: PassIcon, label: 'Passkontroll' },
  { to: '/my-cabins', icon: Building2, label: 'Din Hytte' },
];

// Dynamic items that depend on state
const scheduleNavItem: NavItem = { to: '/schedule', icon: Calendar, label: 'Vaktplan' };
const importantInfoNavItem: NavItem = { to: '/important-info', icon: AlertTriangle, label: 'Viktig info' };
const wallNavItem: NavItem = { to: '/wall', icon: Megaphone, label: 'Den store veggen' };
const fixNavItem: NavItem = { to: '/fix', icon: Wrench, label: 'Rapporter' };

// Note: Mobile hamburger menu now uses allNavItems (same as desktop sidebar)

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
    // Admin gets Dashboard in the middle
    return [
      { to: '/', icon: Home, label: 'Hjem' },
      { to: '/leaders', icon: Users, label: 'Ledere' },
      { to: '/admin', icon: Settings, label: 'Dashboard' },
      { to: '/passport', icon: PassIcon, label: 'Passkontor' },
      { to: '/fix', icon: Wrench, label: 'Fix' },
    ];
  } else if (isNurse) {
    // Nurse gets Nurse in the middle
    return [
      { to: '/', icon: Home, label: 'Hjem' },
      { to: '/leaders', icon: Users, label: 'Ledere' },
      { to: '/nurse', icon: Heart, label: 'Nurse' },
      { to: '/passport', icon: PassIcon, label: 'Passkontor' },
      { to: '/fix', icon: Wrench, label: 'Fix' },
    ];
  } else {
    // Regular users get Hajolo in the middle
    return [
      { to: '/', icon: Home, label: 'Hjem' },
      { to: '/leaders', icon: Users, label: 'Ledere' },
      { to: '#', icon: Check, label: 'Hajolo', isHajolo: true },
      { to: '/passport', icon: PassIcon, label: 'Passkontor' },
      { to: '/fix', icon: Wrench, label: 'Fix' },
    ];
  }
};

const nurseNavItems: NavItem[] = [
  { to: '/nurse', icon: Heart, label: 'Nurse' },
];

const adminNavItems: NavItem[] = [
  { to: '/participant-stats', icon: BarChart2, label: 'Deltagere' },
  { to: '/admin', icon: Settings, label: 'Admin' },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const { leader, isAdmin, isNurse, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasRead, setHasRead] = useState(false);
  const [showHajoloSuccess, setShowHajoloSuccess] = useState(false);
  const [hasScheduleImage, setHasScheduleImage] = useState(false);
  const [notificationSheetOpen, setNotificationSheetOpen] = useState(false);
  const location = useLocation();

  // Build dynamic nav items based on schedule image availability
  const allNavItems = [
    ...baseNavItems,
    ...(hasScheduleImage ? [scheduleNavItem] : []),
    importantInfoNavItem,
    wallNavItem,
    fixNavItem,
  ];


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

    // Subscribe to realtime changes for schedule_image_url
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

    // Subscribe to realtime changes
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
    
    // Trigger confetti
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 }
    });
    
    // Auto-hide after 3 seconds
    setTimeout(() => setShowHajoloSuccess(false), 3000);
  };

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

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {allNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
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
          ))}
          
          {(isAdmin || isNurse) && (
            <>
              <div className="pt-4 pb-2">
                <span className="px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Spesielle tilganger
                </span>
              </div>
              {(isAdmin || isNurse) && nurseNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
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
              ))}
              {isAdmin && adminNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
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
              ))}
            </>
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
            onClick={() => setMobileMenuOpen(false)}
            className="shrink-0"
          >
            <X className="w-5 h-5" />
          </Button>
        </header>

        {/* Menu Content - scrollable */}
        <nav className="pt-[calc(3.5rem+env(safe-area-inset-top,0px))] pb-safe overflow-y-auto h-full">
          <div className="p-4 space-y-1">
            {allNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
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
            ))}
            
            {(isAdmin || isNurse) && (
              <>
                <div className="pt-4 pb-2">
                  <span className="px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Spesielle tilganger
                  </span>
                </div>
                {(isAdmin || isNurse) && nurseNavItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
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
                ))}
                {isAdmin && adminNavItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
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
                ))}
              </>
            )}
            
            <div className="pt-4 space-y-1">
              {isAdmin && (
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setMobileMenuOpen(false);
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
                  setMobileMenuOpen(false);
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

      {/* Mobile Bottom Navigation - hidden when menu is open */}
      {!mobileMenuOpen && (
        <nav 
          className="lg:hidden mobile-bottom-nav fixed inset-x-0 bottom-0 bg-card/95 backdrop-blur-md border-t border-border shadow-lg z-30"
          style={{ 
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            WebkitTransform: 'translate3d(0,0,0)',
            transform: 'translate3d(0,0,0)'
          }}
        >
        <div className="h-16 flex items-center justify-evenly">
          {getBottomNavItems(isAdmin, isNurse).map((item) => {
            const isActive = location.pathname === item.to;
            
            // Hajolo button - larger, centered, floating above nav
            if (item.isHajolo) {
              return (
                <button
                  key="hajolo"
                  onClick={handleHajoloClick}
                  className="flex flex-col items-center justify-center -mt-5 w-16"
                >
                  <div
                    className={cn(
                      'w-14 h-14 rounded-full flex items-center justify-center transition-colors shadow-lg border-4 border-card',
                      hasRead ? 'bg-green-500' : 'bg-red-500'
                    )}
                  >
                    <Check className="w-7 h-7 text-white" />
                  </div>
                  <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
                </button>
              );
            }
            
            // Regular nav items - equal width, clean design
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex flex-col items-center justify-center w-16"
              >
                <item.icon 
                  className={cn(
                    'w-6 h-6 transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )} 
                  size={24} 
                />
                <span className={cn(
                  'text-[10px] font-medium mt-1',
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

      {/* Main Content - mobile: scrollable content area; desktop: normal flow */}
      <main className="lg:ml-64 pt-[calc(3.5rem+env(safe-area-inset-top,0px))] lg:pt-0 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] lg:pb-0 flex-1 lg:min-h-screen">
        <div className="p-4 lg:p-8">
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