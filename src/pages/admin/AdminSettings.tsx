import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  RefreshCw,
  Settings,
} from 'lucide-react';
import { LeaderDetailDialog } from '@/components/admin/LeaderDetailDialog';
import { CabinAssignmentStatusRef } from '@/components/admin/CabinAssignmentStatus';
import { AdminSettingsContent } from '@/components/admin/settings/AdminSettingsContent';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type Leader = Tables<'leaders'>;
type UserRole = Tables<'user_roles'>;
type AppRole = 'admin' | 'nurse' | 'leader';

interface LeaderWithRole extends Leader {
  role: AppRole;
}

// Tab definitions - split into two rows
const settingsTabsRow1 = [
  { id: 'leaders', label: 'Ledere', icon: Users },
  { id: 'participants', label: 'Deltakere', icon: Users },
  { id: 'cabins', label: 'Hytter', icon: Home },
  { id: 'schedule', label: 'Vaktplan', icon: Calendar },
  { id: 'activities', label: 'Aktiviteter', icon: Dumbbell },
];

const settingsTabsRow2 = [
  { id: 'skjaer', label: 'Skjær', icon: MapIcon },
  { id: 'stories', label: 'Historier', icon: BookOpen },
  { id: 'push', label: 'Push-varsler', icon: Bell },
  { id: 'rope-control', label: 'Tau-kontroll', icon: Anchor },
  { id: 'sync', label: 'Synkronisering', icon: RefreshCw },
  { id: 'setup', label: 'Oppsett', icon: Settings },
];

export default function AdminSettings() {
  const { isAdmin } = useAuth();
  const [activeSection, setActiveSection] = useState('leaders');
  
  const [leaders, setLeaders] = useState<LeaderWithRole[]>([]);
  const [editingLeader, setEditingLeader] = useState<LeaderWithRole | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSyncInstructions, setShowSyncInstructions] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [leaderSearch, setLeaderSearch] = useState('');
  
  // New leader form
  const [newLeaderName, setNewLeaderName] = useState('');
  const [newLeaderPhone, setNewLeaderPhone] = useState('');
  const [newLeaderIsAdmin, setNewLeaderIsAdmin] = useState(false);

  // Sync webhook
  const [webhookUrl, setWebhookUrl] = useState('');
  const [storedWebhookUrl, setStoredWebhookUrl] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [syncError, setSyncError] = useState<{
    error: string;
    webhookStatus?: number;
    webhookUrl?: string;
    correlationId?: string;
    rawResponse?: string;
    n8nError?: string | null;
    n8nStackTrace?: string[] | null;
  } | null>(null);
  const [lastSyncSuccess, setLastSyncSuccess] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Export webhook
  const [exportWebhookUrl, setExportWebhookUrl] = useState('');
  const [storedExportWebhookUrl, setStoredExportWebhookUrl] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isSavingExportWebhook, setIsSavingExportWebhook] = useState(false);
  const [lastExportSuccess, setLastExportSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [lastExportTime, setLastExportTime] = useState<string | null>(null);
  
  // Auto-export state
  const [pendingExport, setPendingExport] = useState(false);
  const [exportCountdown, setExportCountdown] = useState(0);
  const exportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cabinStatusRef = useRef<CabinAssignmentStatusRef>(null);

  useEffect(() => {
    loadData();
    loadWebhookUrl();
    loadExportWebhookUrl();
    loadLastSyncTime();
    loadLastExportTime();
    
    return () => {
      if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const loadLastSyncTime = async () => {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'last_sync_timestamp')
      .maybeSingle();
    
    if (data?.value) {
      setLastSyncTime(data.value);
    }
  };

  const loadLastExportTime = async () => {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'last_export_timestamp')
      .maybeSingle();
    
    if (data?.value) {
      setLastExportTime(data.value);
    }
  };

  const formatSyncTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('nb-NO', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return null;
    }
  };

  const loadWebhookUrl = async () => {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'sync_webhook_url')
      .maybeSingle();
    
    if (data?.value) {
      setWebhookUrl(data.value);
      setStoredWebhookUrl(data.value);
    }
  };

  const loadExportWebhookUrl = async () => {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'export_webhook_url')
      .maybeSingle();
    
    if (data?.value) {
      setExportWebhookUrl(data.value);
      setStoredExportWebhookUrl(data.value);
    }
  };

  const saveWebhookUrl = async () => {
    setIsSavingWebhook(true);
    try {
      const { error } = await supabase
        .from('app_config')
        .upsert({ 
          key: 'sync_webhook_url', 
          value: webhookUrl, 
          updated_at: new Date().toISOString() 
        }, { onConflict: 'key' });
      
      if (error) throw error;
      setStoredWebhookUrl(webhookUrl);
      toast.success('Import webhook URL lagret!');
    } catch (error) {
      console.error('Error saving webhook URL:', error);
      toast.error('Kunne ikke lagre webhook URL');
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const saveExportWebhookUrl = async () => {
    setIsSavingExportWebhook(true);
    try {
      const { error } = await supabase
        .from('app_config')
        .upsert({ 
          key: 'export_webhook_url', 
          value: exportWebhookUrl, 
          updated_at: new Date().toISOString() 
        }, { onConflict: 'key' });
      
      if (error) throw error;
      setStoredExportWebhookUrl(exportWebhookUrl);
      toast.success('Eksport webhook URL lagret!');
    } catch (error) {
      console.error('Error saving export webhook URL:', error);
      toast.error('Kunne ikke lagre eksport webhook URL');
    } finally {
      setIsSavingExportWebhook(false);
    }
  };

  const triggerExport = useCallback(async (isAutoExport = false) => {
    if (!storedExportWebhookUrl) {
      if (!isAutoExport) toast.error('Legg inn eksport webhook URL først');
      return;
    }

    setPendingExport(false);
    setExportCountdown(0);
    if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    setIsExporting(true);
    setExportError(null);
    setLastExportSuccess(false);

    try {
      const { data, error } = await supabase.functions.invoke('trigger-export');

      if (error) {
        console.error('Error calling trigger-export:', error);
        setExportError('Kunne ikke kontakte backend');
        if (!isAutoExport) toast.error('Kunne ikke starte eksport');
        return;
      }

      if (data?.success) {
        setLastExportSuccess(true);
        const exportTime = new Date().toISOString();
        setLastExportTime(exportTime);
        toast.success(`Eksport fullført! ${data.leadersExported} ledere sendt til Google Sheets`);
      } else {
        setExportError(data?.error || 'Ukjent feil');
        if (!isAutoExport) toast.error(`Eksport feilet: ${data?.error || 'Ukjent feil'}`);
      }
    } catch (error) {
      console.error('Error triggering export:', error);
      setExportError('Nettverksfeil ved eksport');
      if (!isAutoExport) toast.error('Kunne ikke starte eksport');
    } finally {
      setIsExporting(false);
    }
  }, [storedExportWebhookUrl]);

  const cancelPendingExport = useCallback(() => {
    if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setPendingExport(false);
    setExportCountdown(0);
    toast.info('Auto-eksport avbrutt');
  }, []);

  // Cabin aliases for matching cabin names to actual cabins
  const CABIN_ALIASES: Record<string, string[]> = {
    'balder': ['balder bak', 'balder front'],
    'hulder': ['hulder bak', 'hulder front'],
    'seilern': ['seileren'],
    'seileren': ['seileren'],
  };

  // Teams that don't have cabin responsibility
  const TEAMS_WITHOUT_CABIN_RESPONSIBILITY = ['kjøkken', 'kitchen', 'tech'];
  const ROLES_WITHOUT_CABIN_RESPONSIBILITY = ['admin', 'nurse'];

  const syncLeaderCabins = async () => {
    console.log('[syncLeaderCabins] Starting cabin sync...');
    
    try {
      const { data: leadersData, error: leadersError } = await supabase
        .from('leaders')
        .select('id, name, cabin, team')
        .eq('is_active', true);
      
      if (leadersError) {
        console.error('[syncLeaderCabins] Error fetching leaders:', leadersError);
        return;
      }

      const { data: cabinsData, error: cabinsError } = await supabase
        .from('cabins')
        .select('id, name');
      
      if (cabinsError) {
        console.error('[syncLeaderCabins] Error fetching cabins:', cabinsError);
        return;
      }

      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('leader_id, role');
      
      if (rolesError) {
        console.error('[syncLeaderCabins] Error fetching roles:', rolesError);
        return;
      }

      const cabinsByName = new Map<string, string>();
      cabinsData?.forEach(c => {
        cabinsByName.set(c.name.toLowerCase(), c.id);
      });

      const rolesMap = new Map<string, string[]>();
      userRoles?.forEach(r => {
        const existing = rolesMap.get(r.leader_id) || [];
        rolesMap.set(r.leader_id, [...existing, r.role]);
      });

      let synced = 0;
      let skipped = 0;

      for (const leader of leadersData || []) {
        if (!leader.cabin?.trim()) {
          skipped++;
          continue;
        }

        const teamLower = leader.team?.toLowerCase() || '';
        if (TEAMS_WITHOUT_CABIN_RESPONSIBILITY.some(t => teamLower.includes(t))) {
          console.log(`[syncLeaderCabins] Skipping ${leader.name} - exempt team: ${leader.team}`);
          skipped++;
          continue;
        }

        const leaderRoles = rolesMap.get(leader.id) || [];
        if (leaderRoles.some(r => ROLES_WITHOUT_CABIN_RESPONSIBILITY.includes(r))) {
          console.log(`[syncLeaderCabins] Skipping ${leader.name} - exempt role`);
          skipped++;
          continue;
        }

        const cabinNames = leader.cabin.split(/[&,]/).map(s => s.trim()).filter(Boolean);
        
        await supabase.from('leader_cabins').delete().eq('leader_id', leader.id);

        for (const cabinName of cabinNames) {
          const normalized = cabinName.toLowerCase();
          
          const aliasesToTry = CABIN_ALIASES[normalized] || [normalized];
          
          for (const alias of aliasesToTry) {
            const cabinId = cabinsByName.get(alias);
            if (cabinId) {
              const { error: insertError } = await supabase
                .from('leader_cabins')
                .insert({ leader_id: leader.id, cabin_id: cabinId });
              
              if (insertError) {
                console.error(`[syncLeaderCabins] Error inserting link for ${leader.name} -> ${alias}:`, insertError);
              } else {
                console.log(`[syncLeaderCabins] Linked ${leader.name} -> ${alias}`);
              }
            }
          }
        }
        synced++;
      }

      console.log(`[syncLeaderCabins] Complete. Synced: ${synced}, Skipped: ${skipped}`);
    } catch (error) {
      console.error('[syncLeaderCabins] Unexpected error:', error);
    }
  };

  const triggerSync = async () => {
    if (!webhookUrl) {
      toast.error('Legg inn webhook URL først');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    setLastSyncSuccess(false);

    try {
      const { data, error } = await supabase.functions.invoke('trigger-sync');

      if (error) {
        console.error('Error calling trigger-sync:', error);
        setSyncError({ error: 'Kunne ikke kontakte backend' });
        toast.error('Kunne ikke starte synkronisering');
        return;
      }

      if (data?.success) {
        await syncLeaderCabins();
        
        setLastSyncSuccess(true);
        setLastSyncTime(new Date().toISOString());
        toast.success(`Synkronisering fullført! (Status: ${data.webhookStatus})`);
        
        cabinStatusRef.current?.refresh();
        loadData();
      } else {
        setSyncError({
          error: data?.error || 'Ukjent feil',
          webhookStatus: data?.webhookStatus,
          webhookUrl: data?.webhookUrl,
          correlationId: data?.correlationId,
          rawResponse: data?.rawResponse,
          n8nError: data?.n8nError,
          n8nStackTrace: data?.n8nStackTrace,
        });
        toast.error(`Synkronisering feilet: ${data?.n8nError || data?.error || 'Ukjent feil'}`);
      }
    } catch (error) {
      console.error('Error triggering sync:', error);
      setSyncError({ error: 'Nettverksfeil ved synkronisering' });
      toast.error('Kunne ikke starte synkronisering');
    } finally {
      setIsSyncing(false);
    }
  };

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
      toast.success('Alle ledere er nå deaktivert');
    } catch (error) {
      console.error('Error deactivating leaders:', error);
      toast.error('Kunne ikke deaktivere ledere');
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
      toast.success('Alle ledere er nå aktivert');
    } catch (error) {
      console.error('Error activating leaders:', error);
      toast.error('Kunne ikke aktivere ledere');
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
      toast.success(leader.is_active ? 'Leder deaktivert' : 'Leder aktivert');
    } catch (error) {
      console.error('Error toggling leader active:', error);
      toast.error('Kunne ikke oppdatere leder');
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [leadersRes, rolesRes] = await Promise.all([
        supabase.from('leaders').select('*').order('created_at'),
        supabase.from('user_roles').select('*'),
      ]);

      const roleMap = new Map<string, AppRole>();
      (rolesRes.data || []).forEach((r: UserRole) => {
        roleMap.set(r.leader_id, r.role as AppRole);
      });

      const leadersWithRoles: LeaderWithRole[] = (leadersRes.data || []).map((leader) => ({
        ...leader,
        role: roleMap.get(leader.id) || 'leader',
      }));

      setLeaders(leadersWithRoles);
    } catch (error) {
      console.error('Error loading admin data:', error);
      toast.error('Kunne ikke laste data');
    } finally {
      setIsLoading(false);
    }
  };

  const addLeader = async () => {
    if (!newLeaderName || !newLeaderPhone) {
      toast.error('Fyll inn navn og telefon');
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
        await supabase.from('user_roles').insert({ leader_id: leader.id, role: 'admin' });
      }

      setNewLeaderName('');
      setNewLeaderPhone('');
      setNewLeaderIsAdmin(false);
      loadData();
      toast.success('Leder lagt til!');
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Dette telefonnummeret finnes allerede');
      } else {
        toast.error('Kunne ikke legge til leder');
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

        {/* Tab navigation - two rows */}
        <Tabs value={activeSection} onValueChange={setActiveSection}>
          <div className="space-y-1">
            {/* Row 1: Users and camp */}
            <TabsList className="w-full justify-start h-auto p-1 bg-muted/50">
              {settingsTabsRow1.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="gap-1.5 data-[state=active]:bg-background text-xs sm:text-sm"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* Row 2: Content and system */}
            <TabsList className="w-full justify-start h-auto p-1 bg-muted/50">
              {settingsTabsRow2.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="gap-1.5 data-[state=active]:bg-background text-xs sm:text-sm"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <div className="mt-6">
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
        </Tabs>
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
