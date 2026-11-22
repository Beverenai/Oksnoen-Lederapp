import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { normalizePhone } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import {
  ChevronRight,
  ToggleRight,
  Shield,
  ArrowLeft,
  Users,
  Home,
  Calendar,
  Bell,
  Anchor,
  Dumbbell,
  MapIcon,
  LayoutGrid,
  FileSpreadsheet,
  Bed,
  Shirt,
  Heart,
  Skull,
  ClipboardList,
  ShoppingBasket,
  Archive,
  Camera,
  Flame,
} from 'lucide-react';
import { LeaderDetailDialog } from '@/components/admin/LeaderDetailDialog';
import { AdminSettingsContent } from '@/components/admin/settings/AdminSettingsContent';
import type { Tables } from '@/integrations/supabase/types';
import { confirmDialog } from '@/components/ui/confirm-sheet';

type Leader = Tables<'leaders'>;
type UserRole = Tables<'user_roles'>;
type AppRole = 'superadmin' | 'admin' | 'nurse' | 'leader';

interface LeaderWithRole extends Leader {
  role: AppRole;
}

// Innstillingene i grupper, iOS-stil (som Innstillinger-appen).
type NavItem = { key: string; label: string; icon: typeof Users; tint: string; path?: string };

const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: 'Periode',
    items: [
      { key: 'features', label: 'Funksjoner denne perioden', icon: ToggleRight, tint: 'bg-green-500' },
      { key: 'nurse-periods', label: 'Aktiv periode og app av/på', icon: Heart, tint: 'bg-rose-500' },
      { key: 'home-config', label: 'Forsiden', icon: LayoutGrid, tint: 'bg-cyan-500' },
      { key: 'push', label: 'Send varsel', icon: Bell, tint: 'bg-red-500' },
    ],
  },
  {
    title: 'Folk',
    items: [
      { key: 'leaders', label: 'Ledere', icon: Users, tint: 'bg-blue-500' },
      { key: 'participants', label: 'Deltakere', icon: Users, tint: 'bg-green-600' },
      { key: 'bookings', label: 'Booking-info', icon: ClipboardList, tint: 'bg-sky-500' },
      { key: 'cabins', label: 'Hytter og rom', icon: Home, tint: 'bg-amber-500' },
      { key: 'google-sheet', label: 'Synk ledere fra Google Sheet', icon: FileSpreadsheet, tint: 'bg-emerald-600' },
    ],
  },
  {
    title: 'Plan',
    items: [
      { key: 'schedule', label: 'Vaktplan', icon: Calendar, tint: 'bg-purple-500' },
      { key: 'activities', label: 'Aktiviteter', icon: Dumbbell, tint: 'bg-pink-500' },
      { key: 'rope-control', label: 'Taukontroll', icon: Anchor, tint: 'bg-red-600' },
      { key: 'skjaer', label: 'Skjær', icon: MapIcon, tint: 'bg-teal-500' },
    ],
  },
  {
    title: 'Drift',
    items: [
      { key: 'kiosk', label: 'Gomla', icon: ShoppingBasket, tint: 'bg-emerald-500' },
      { key: 'sweaters', label: 'Gensere', icon: Shirt, tint: 'bg-lime-600' },
      { key: 'gjenglemt', label: 'Gjenglemt', icon: Shirt, tint: 'bg-fuchsia-500' },
      { key: 'overnatting', label: 'Overnatting', icon: Bed, tint: 'bg-indigo-500' },
    ],
  },
  {
    title: 'Moro',
    items: [
      { key: 'murder', label: 'Morderleken', icon: Skull, tint: 'bg-stone-600' },
      { key: 'pov', label: 'Øksnøen POV', icon: Camera, tint: 'bg-amber-600' },
      { key: 'tinder', label: 'Øksnøen Tinder', icon: Flame, tint: 'bg-rose-500' },
    ],
  },
  {
    title: 'Historikk',
    items: [
      { key: 'season-view', label: 'Hele sesongen', icon: Archive, tint: 'bg-zinc-500' },
      { key: 'archive', label: 'Periodearkiv', icon: Archive, tint: 'bg-slate-500', path: '/arkiv' },
    ],
  },
];

const sectionLabels: Record<string, string> = {
  leaders: 'Ledere', participants: 'Deltakere', cabins: 'Hytter', schedule: 'Vaktplan',
  activities: 'Aktiviteter', skjaer: 'Skjær', push: 'Send varsel', features: 'Funksjoner denne perioden',
  'rope-control': 'Tau-kontroll', 'home-config': 'Forsiden',
  gjenglemt: 'Gjenglemt',
  'google-sheet': 'Google Sheet sync',
  overnatting: 'Overnatting',
  'nurse-periods': 'Periode',
  murder: 'Morder-leken',
  pov: 'Øksnøen POV',
  bookings: 'Booking-info',
  sweaters: 'Gensere',
  'season-view': 'Hele sesongen',
  tinder: 'Øksnøen Tinder',
};

export default function AdminSettings() {
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const navigate = useNavigate();
  const { isAdmin, isSuperAdmin } = useAuth();
  const [activeSection, setActiveSection] = useState('');
  
  const [leaders, setLeaders] = useState<LeaderWithRole[]>([]);
  const [editingLeader, setEditingLeader] = useState<LeaderWithRole | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [leaderSearch, setLeaderSearch] = useState('');
  const [homeConfig, setHomeConfig] = useState<any[]>([]);
  const [localHomeConfig, setLocalHomeConfig] = useState<any[]>([]);
  
  // New leader form
  const [newLeaderName, setNewLeaderName] = useState('');
  const [newLeaderPhone, setNewLeaderPhone] = useState('');
  const [newLeaderIsAdmin, setNewLeaderIsAdmin] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Mobil: appens tilbake-pil lukker seksjonen i stedet for å forlate siden,
  // så vi slipper to piler på skjermen.
  useEffect(() => {
    if (!activeSection) return;
    window.history.pushState({ adminSection: activeSection }, '');
    const onPop = () => setActiveSection('');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [activeSection]);

  const deactivateAllLeaders = async () => {
    if (!(await confirmDialog('Reset periode: Dette vil deaktivere alle nåværende ledere.\n\nNår du syncer nye ledere, vil de som matcher (basert på telefonnummer) automatisk bli aktivert igjen med sin lagrede info (profilbilde, notater osv).'))) return;

    setIsDeactivating(true);
    try {
      const { error } = await supabase
        .from('leaders')
        .update({ is_active: false })
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;
      
      loadData();
      showSuccess('Alle ledere er nå deaktivert');
    } catch (error) {
      console.error('Error deactivating leaders:', error);
      showError('Kunne ikke deaktivere ledere');
    } finally {
      setIsDeactivating(false);
    }
  };

  const activateAllLeaders = async () => {
    if (!(await confirmDialog('Er du sikker på at du vil aktivere alle ledere?'))) return;

    setIsDeactivating(true);
    try {
      const { error } = await supabase
        .from('leaders')
        .update({ is_active: true })
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;
      
      loadData();
      showSuccess('Alle ledere er nå aktivert');
    } catch (error) {
      console.error('Error activating leaders:', error);
      showError('Kunne ikke aktivere ledere');
    } finally {
      setIsDeactivating(false);
    }
  };

  const toggleLeaderActive = async (leader: Leader) => {
    let newValue: boolean;

    // Optimistic update using functional setState so we always flip the *current* value
    setLeaders(prev => {
      const current = prev.find(l => l.id === leader.id);
      newValue = !(current?.is_active ?? true);
      return prev.map(l =>
        l.id === leader.id ? { ...l, is_active: newValue } : l
      );
    });

    try {
      const { error } = await supabase
        .from('leaders')
        .update({ is_active: newValue! })
        .eq('id', leader.id);

      if (error) throw error;
      showSuccess(newValue! ? 'Leder aktivert' : 'Leder deaktivert');
    } catch (error) {
      console.error('Error toggling leader active:', error);
      showError('Kunne ikke oppdatere leder');
      // Rollback on error
      setLeaders(prev => prev.map(l =>
        l.id === leader.id ? { ...l, is_active: !newValue! } : l
      ));
    }
  };

  /**
   * Henter admin-data. `quiet` brukes ved oppfriskning etter en endring —
   * da unngår vi skjelettvisningen som ellers river ned åpne dialoger.
   */
  const loadData = async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setIsLoading(true);
    try {
      const [leadersRes, rolesRes, configRes] = await Promise.all([
        supabase.from('leaders').select('*').order('created_at'),
        supabase.rpc('get_all_leader_roles'),
        supabase.from('home_screen_config').select('*').order('sort_order'),
      ]);

      const roleMap = new Map<string, AppRole>();
      (rolesRes.data || []).forEach((r: { leader_id: string; role: string }) => {
        roleMap.set(r.leader_id, r.role as AppRole);
      });

      const leadersWithRoles: LeaderWithRole[] = (leadersRes.data || []).map((leader) => ({
        ...leader,
        role: roleMap.get(leader.id) || 'leader',
      }));

      setLeaders(leadersWithRoles);
      const homeData = configRes.data || [];
      setHomeConfig(homeData);
      setLocalHomeConfig(homeData);
    } catch (error) {
      console.error('Error loading admin data:', error);
      showError('Kunne ikke laste data');
    } finally {
      if (!opts?.quiet) setIsLoading(false);
    }
  };

  /** Oppdater én leder lokalt (optimistisk) uten å hente alt på nytt. */
  const updateLeaderInList = (id: string, patch: Partial<LeaderWithRole>) => {
    setLeaders((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    setEditingLeader((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
  };

  const quietReload = () => loadData({ quiet: true });

  const addLeader = async () => {
    if (!newLeaderName || !newLeaderPhone) {
      showError('Fyll inn navn og telefon');
      return;
    }

    try {
      const { data: leader, error } = await supabase
        .from('leaders')
        .insert({ name: newLeaderName, phone: normalizePhone(newLeaderPhone) })
        .select()
        .single();

      if (error) throw error;

      if (newLeaderIsAdmin && leader) {
        await supabase.functions.invoke('manage-roles', {
          body: { action: 'set', leader_id: leader.id, role: 'admin' }
        });
      }

      setNewLeaderName('');
      setNewLeaderPhone('');
      setNewLeaderIsAdmin(false);
      loadData();
      showSuccess('Leder lagt til!');
    } catch (error: any) {
      if (error.code === '23505') {
        showError('Dette telefonnummeret finnes allerede');
      } else {
        showError('Kunne ikke legge til leder');
      }
    }
  };

  const handleEditLeader = (leader: LeaderWithRole) => {
    setEditingLeader(leader);
    setIsEditDialogOpen(true);
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-heading font-semibold">Ingen tilgang</h2>
            <p className="text-muted-foreground mt-2">
              Du har ikke tilgang til admin-panelet.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (activeSection) {
    return (
      <>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-heading font-bold text-foreground">
              {sectionLabels[activeSection] || 'Innstillinger'}
            </h1>
          </div>

          <AdminSettingsContent
            activeSection={activeSection}
            leaders={leaders}
            leaderSearch={leaderSearch}
            setLeaderSearch={setLeaderSearch}
            isDeactivating={isDeactivating}
            deactivateAllLeaders={deactivateAllLeaders}
            activateAllLeaders={activateAllLeaders}
            toggleLeaderActive={toggleLeaderActive}
            onEditLeader={handleEditLeader}
            newLeaderName={newLeaderName}
            setNewLeaderName={setNewLeaderName}
            newLeaderPhone={newLeaderPhone}
            setNewLeaderPhone={setNewLeaderPhone}
            newLeaderIsAdmin={newLeaderIsAdmin}
            setNewLeaderIsAdmin={setNewLeaderIsAdmin}
            addLeader={addLeader}
            isSuperAdmin={isSuperAdmin}
            homeConfig={homeConfig}
            localHomeConfig={localHomeConfig}
            setLocalHomeConfig={setLocalHomeConfig}
            setHomeConfig={setHomeConfig}
            onLeaderUpdated={quietReload}
            onOpenSection={setActiveSection}
          />
        </div>

        <LeaderDetailDialog
          leader={editingLeader}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSaved={quietReload}
          onRoleChanged={(role) => editingLeader && updateLeaderInList(editingLeader.id, { role } as Partial<LeaderWithRole>)}
          currentRole={(editingLeader as any)?.role || 'leader'}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/admin" className="hidden lg:block">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
              Innstillinger
            </h1>
            <p className="text-muted-foreground mt-1">
              Oppsett, synkronisering og lederadministrasjon
            </p>
          </div>
        </div>

        {navGroups.map((group) => (
          <section key={group.title} className="space-y-1.5">
            <h2 className="px-4 text-[13px] font-normal uppercase tracking-wide text-muted-foreground">{group.title}</h2>
            <div className="overflow-hidden rounded-2xl bg-card divide-y divide-border/60">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-muted"
                    onClick={() => (item.path ? navigate(item.path) : setActiveSection(item.key))}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white ${item.tint}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 text-[17px]">{item.label}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
