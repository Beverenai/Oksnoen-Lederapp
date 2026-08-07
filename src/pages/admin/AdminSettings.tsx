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
  Shield,
  ArrowLeft,
  Users,
  Home,
  Calendar,
  Bell,
  Anchor,
  Dumbbell,
  MapIcon,
  BookOpen,
  LayoutGrid,
  FileSpreadsheet,
  Bed,
  Shirt,
  Heart,
  Dices,
  Skull,
  ClipboardList,
  ShoppingBasket,
  Archive,
} from 'lucide-react';
import { LeaderDetailDialog } from '@/components/admin/LeaderDetailDialog';
import { AdminSettingsContent } from '@/components/admin/settings/AdminSettingsContent';
import type { Tables } from '@/integrations/supabase/types';

type Leader = Tables<'leaders'>;
type UserRole = Tables<'user_roles'>;
type AppRole = 'superadmin' | 'admin' | 'nurse' | 'leader';

interface LeaderWithRole extends Leader {
  role: AppRole;
}

// Navigation card definitions
const topNavItems = [
  { key: 'leaders', label: 'Ledere', desc: 'Administrer ledere og roller', icon: Users, color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  { key: 'participants', label: 'Deltakere', desc: 'Importer og håndter deltakere', icon: Users, color: 'bg-green-500/15 text-green-600 dark:text-green-400' },
];

const navItems = [
  { key: 'cabins', label: 'Hytter', desc: 'Administrer hytter', icon: Home, color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  { key: 'schedule', label: 'Vaktplan', desc: 'Sett opp vaktplan', icon: Calendar, color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400' },
  { key: 'activities', label: 'Aktiviteter', desc: 'Administrer aktiviteter', icon: Dumbbell, color: 'bg-pink-500/15 text-pink-600 dark:text-pink-400' },
  { key: 'skjaer', label: 'Skjær', desc: 'Skjæraktiviteter', icon: MapIcon, color: 'bg-teal-500/15 text-teal-600 dark:text-teal-400' },
  { key: 'stories', label: 'Historier', desc: 'Administrer historier', icon: BookOpen, color: 'bg-orange-500/15 text-orange-600 dark:text-orange-400' },
  { key: 'push', label: 'Push-varsler', desc: 'Send push-varsler', icon: Bell, color: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' },
  { key: 'rope-control', label: 'Tau-kontroll', desc: 'Tau-kontroll oppsett', icon: Anchor, color: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  { key: 'home-config', label: 'Hjemskjerm', desc: 'Tittel, ikon og synlighet', icon: LayoutGrid, color: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400' },
  { key: 'google-sheet', label: 'Google Sheet sync', desc: 'Synk ledere fra Google Sheet', icon: FileSpreadsheet, color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  { key: 'overnatting', label: 'Overnatting', desc: 'Se hvem som vil overnatte', icon: Bed, color: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' },
  { key: 'gjenglemt', label: 'Gjenglemt', desc: 'Perioder og offentlige lenker', icon: Shirt, color: 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400' },
  { key: 'nurse-periods', label: 'Periode', desc: 'Velg aktiv periode (1–7)', icon: Heart, color: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' },
  { key: 'roulette', label: 'Oppgave-roulette', desc: 'Legg inn senior/U18-oppgaver', icon: Dices, color: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
  { key: 'murder', label: 'Morder-leken', desc: 'Start spillet og se hele kjeden', icon: Skull, color: 'bg-stone-500/15 text-stone-600 dark:text-stone-300' },
  { key: 'bookings', label: 'Booking-info', desc: 'Importer booking-data per periode', icon: ClipboardList, color: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  { key: 'sweaters', label: 'Gensere', desc: 'Hentet / kjøpt genser dag 1', icon: Shirt, color: 'bg-lime-500/15 text-lime-600 dark:text-lime-400' },
  { key: 'kiosk', label: 'Gomla', desc: 'Varer og priser i Gomla', icon: ShoppingBasket, color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  { key: 'archive', label: 'Periodearkiv', desc: 'Se data fra alle perioder', icon: Archive, color: 'bg-slate-500/15 text-slate-600 dark:text-slate-300', path: '/arkiv' },
];

const sectionLabels: Record<string, string> = {
  leaders: 'Ledere', participants: 'Deltakere', cabins: 'Hytter', schedule: 'Vaktplan',
  activities: 'Aktiviteter', skjaer: 'Skjær', stories: 'Historier', push: 'Push-varsler',
  'rope-control': 'Tau-kontroll', 'home-config': 'Hjemskjerm-elementer',
  gjenglemt: 'Gjenglemt',
  'google-sheet': 'Google Sheet sync',
  overnatting: 'Overnatting',
  'nurse-periods': 'Periode',
  roulette: 'Oppgave-roulette',
  murder: 'Morder-leken',
  bookings: 'Booking-info',
  sweaters: 'Gensere',
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
  const deactivateAllLeaders = async () => {
    if (!confirm('Reset periode: Dette vil deaktivere alle nåværende ledere.\n\nNår du syncer nye ledere, vil de som matcher (basert på telefonnummer) automatisk bli aktivert igjen med sin lagrede info (profilbilde, notater osv).')) return;

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
    if (!confirm('Er du sikker på at du vil aktivere alle ledere?')) return;

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

  const loadData = async () => {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  };

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
            <Button variant="ghost" size="icon" onClick={() => setActiveSection('')}>
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
            onLeaderUpdated={loadData}
          />
        </div>

        <LeaderDetailDialog
          leader={editingLeader}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSaved={loadData}
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

        {/* Top cards - Ledere & Deltakere */}
        <div className="grid grid-cols-2 gap-3">
          {topNavItems.map(({ key, label, desc, icon: Icon, color }) => (
            <Card
              key={key}
              className={`p-5 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform ${color}`}
              onClick={() => setActiveSection(key)}
            >
              <Icon className="h-8 w-8 mb-2" />
              <p className="font-semibold">{label}</p>
              <p className="text-xs opacity-70 mt-0.5">{desc}</p>
            </Card>
          ))}
        </div>

        {/* Rest of nav cards */}
        <div className="grid grid-cols-2 gap-3">
          {navItems.map((item) => {
            const { key, label, desc, color } = item;
            const Icon = item.icon;
            const path = (item as { path?: string }).path;
            return (
              <Card
                key={key}
                className={`p-4 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform ${color}`}
                onClick={() => (path ? navigate(path) : setActiveSection(key))}
              >
                <Icon className="h-7 w-7 mb-2" />
                <p className="font-semibold text-sm">{label}</p>
                <p className="text-xs opacity-70 mt-0.5">{desc}</p>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
