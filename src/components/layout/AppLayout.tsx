import { ReactNode, useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Home, 
  Users, 
  ClipboardCheck, 
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
  BarChart2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import oksnoenLogo from '@/assets/oksnoen-logo.png';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

interface AppLayoutProps {
  children: ReactNode;
}

// All navigation items for sidebar/menu
const allNavItems = [
  { to: '/', icon: Home, label: 'Hjem' },
  { to: '/profile', icon: User, label: 'Min Profil' },
  { to: '/leaders', icon: Users, label: 'Ledere' },
  { to: '/passport', icon: ClipboardCheck, label: 'Passkontroll' },
  { to: '/cabin', icon: Building2, label: 'Din Hytte' },
  { to: '/schedule', icon: Calendar, label: 'Vaktplan' },
  { to: '/important-info', icon: AlertTriangle, label: 'Viktig info' },
  { to: '/wall', icon: Megaphone, label: 'Den store veggen' },
  { to: '/fix', icon: Wrench, label: 'Rapporter' },
];

// Navigation items for mobile slide-out menu only (simplified)
const mobileMenuItems = [
  { to: '/profile', icon: User, label: 'Min Profil' },
  { to: '/cabin', icon: Building2, label: 'Din Hytte' },
  { to: '/schedule', icon: Calendar, label: 'Vaktplan' },
];

// Bottom nav items type
type BottomNavItem = {
  to: string;
  icon: typeof Home;
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
      { to: '/passport', icon: ClipboardCheck, label: 'Passkontor' },
      { to: '/fix', icon: Wrench, label: 'Fix' },
    ];
  } else if (isNurse) {
    // Nurse gets Nurse in the middle
    return [
      { to: '/', icon: Home, label: 'Hjem' },
      { to: '/leaders', icon: Users, label: 'Ledere' },
      { to: '/nurse', icon: Heart, label: 'Nurse' },
      { to: '/passport', icon: ClipboardCheck, label: 'Passkontor' },
      { to: '/fix', icon: Wrench, label: 'Fix' },
    ];
  } else {
    // Regular users get Hajolo in the middle
    return [
      { to: '/', icon: Home, label: 'Hjem' },
      { to: '/leaders', icon: Users, label: 'Ledere' },
      { to: '#', icon: Check, label: 'Hajolo', isHajolo: true },
      { to: '/passport', icon: ClipboardCheck, label: 'Passkontor' },
      { to: '/fix', icon: Wrench, label: 'Fix' },
    ];
  }
};

const nurseNavItems = [
  { to: '/nurse', icon: Heart, label: 'Nurse' },
];

const adminNavItems = [
  { to: '/participant-stats', icon: BarChart2, label: 'Deltagere' },
  { to: '/admin', icon: Settings, label: 'Admin' },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const { leader, isAdmin, isNurse, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasRead, setHasRead] = useState(false);
  const [showHajoloSuccess, setShowHajoloSuccess] = useState(false);
  const location = useLocation();

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
    <div className="min-h-screen bg-background">
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
      {/* Mobile Header - smaller, just menu + logo - with safe area for Dynamic Island */}
      <header className="lg:hidden fixed top-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-b border-border z-50 px-4 pt-safe flex items-center justify-between h-[calc(3.5rem+env(safe-area-inset-top,0px))]">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="shrink-0"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          <img src={oksnoenLogo} alt="Oksnøen" className="h-8 w-8 object-contain" />
        </div>
        <span className="text-sm text-muted-foreground truncate max-w-[140px]">
          {leader?.name}
        </span>
      </header>

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

        <div className="p-4 border-t border-border">
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

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-foreground/20 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Slide-out Menu */}
      <div
        className={cn(
          'lg:hidden fixed left-0 top-14 bottom-20 w-72 bg-card border-r border-border z-40 transform transition-transform duration-200 overflow-y-auto',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <nav className="p-4 space-y-1">
          {mobileMenuItems.map((item) => (
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
          
          <div className="pt-4">
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
        </nav>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-card border-t border-border z-50 flex items-center justify-around px-2 pb-safe">
        {getBottomNavItems(isAdmin, isNurse).map((item) => {
          const isActive = location.pathname === item.to;
          
          // Special rendering for Hajolo button
          if (item.isHajolo) {
            return (
              <button
                key="hajolo"
                onClick={handleHajoloClick}
                className="flex flex-col items-center justify-center gap-1 px-4 py-2"
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
                    hasRead ? 'bg-green-500' : 'bg-red-500'
                  )}
                >
                  <Check className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          }
          
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-colors min-w-[60px]',
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className={cn('w-6 h-6', isActive && 'text-primary')} />
              <span className="text-xs font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Main Content - adjusted for safe area header */}
      <main className="lg:ml-64 pt-[calc(3.5rem+env(safe-area-inset-top,0px))] lg:pt-0 pb-20 lg:pb-0 min-h-screen">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}