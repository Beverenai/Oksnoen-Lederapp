import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
];

const sectionLabels: Record<string, string> = {
  leaders: 'Ledere', participants: 'Deltakere', cabins: 'Hytter', schedule: 'Vaktplan',
  activities: 'Aktiviteter', skjaer: 'Skjær', stories: 'Historier', push: 'Push-varsler',
  'rope-control': 'Tau-kontroll',
};

export default function AdminSettings() {
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const { isAdmin } = useAuth();
  const [activeSection, setActiveSection] = useState('');
  
  const [leaders, setLeaders] = useState<LeaderWithRole[]>([]);
  const [editingLeader, setEditingLeader] = useState<LeaderWithRole | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [leaderSearch, setLeaderSearch] = useState('');
  
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
    try {
      const { error } = await supabase
        .from('leaders')
        .update({ is_active: !leader.is_active })
        .eq('id', leader.id);

      if (error) throw error;
      
      loadData();
      showSuccess(leader.is_active ? 'Leder deaktivert' : 'Leder aktivert');
    } catch (error) {
      console.error('Error toggling leader active:', error);
      showError('Kunne ikke oppdatere leder');
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [leadersRes, rolesRes] = await Promise.all([
        supabase.from('leaders').select('*').order('created_at'),
        supabase.rpc('get_all_leader_roles'),
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
        .insert({ name: newLeaderName, phone: newLeaderPhone.replace(/\s/g, '') })
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
            cabinStatusRef={cabinStatusRef}
            isSyncing={isSyncing}
            storedWebhookUrl={storedWebhookUrl}
            lastSyncSuccess={lastSyncSuccess}
            lastSyncTime={lastSyncTime}
            syncError={syncError}
            triggerSync={triggerSync}
            formatSyncTime={formatSyncTime}
            isExporting={isExporting}
            storedExportWebhookUrl={storedExportWebhookUrl}
            lastExportSuccess={lastExportSuccess}
            lastExportTime={lastExportTime}
            exportError={exportError}
            pendingExport={pendingExport}
            exportCountdown={exportCountdown}
            triggerExport={triggerExport}
            cancelPendingExport={cancelPendingExport}
            webhookUrl={webhookUrl}
            setWebhookUrl={setWebhookUrl}
            isSavingWebhook={isSavingWebhook}
            saveWebhookUrl={saveWebhookUrl}
            exportWebhookUrl={exportWebhookUrl}
            setExportWebhookUrl={setExportWebhookUrl}
            isSavingExportWebhook={isSavingExportWebhook}
            saveExportWebhookUrl={saveExportWebhookUrl}
            showSyncInstructions={showSyncInstructions}
            setShowSyncInstructions={setShowSyncInstructions}
          />
        </div>

        <LeaderDetailDialog
          leader={editingLeader}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSaved={loadData}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/admin">
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
          {navItems.map(({ key, label, desc, icon: Icon, color }) => (
            <Card
              key={key}
              className={`p-4 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform ${color}`}
              onClick={() => setActiveSection(key)}
            >
              <Icon className="h-7 w-7 mb-2" />
              <p className="font-semibold text-sm">{label}</p>
              <p className="text-xs opacity-70 mt-0.5">{desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
