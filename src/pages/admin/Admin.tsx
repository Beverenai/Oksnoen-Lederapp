import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Progress } from '@/components/ui/progress';
import {
  Settings, Loader2, Shield, Calendar,
  Save, LayoutGrid, List, Sparkles, CalendarDays, RefreshCw,
} from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { LeaderDashboard } from '@/components/admin/LeaderDashboard';
import { LeaderListView } from '@/components/admin/LeaderListView';
import { SessionActivitiesSheet } from '@/components/admin/SessionActivitiesSheet';
import { AdminNotesPanel } from '@/components/admin/notes/AdminNotesPanel';
import type { Tables } from '@/integrations/supabase/types';
import { hapticSuccess, hapticError } from '@/lib/capacitorHaptics';


type Leader = Tables<'leaders'>;
type AppRole = 'superadmin' | 'admin' | 'nurse' | 'leader';

interface LeaderWithRole extends Leader {
  role: AppRole;
}

interface HomeScreenConfig {
  id: string;
  element_key: string;
  label: string;
  is_visible: boolean;
  sort_order: number;
  title: string | null;
  icon: string | null;
  bg_color: string | null;
  text_size: string | null;
  is_bold: boolean | null;
  is_italic: boolean | null;
}

export default function Admin() {
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const { isAdmin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const rqClient = useQueryClient();
  const [leaders, setLeaders] = useState<LeaderWithRole[]>([]);
  const [homeConfig, setHomeConfig] = useState<HomeScreenConfig[]>([]);
  const [localHomeConfig, setLocalHomeConfig] = useState<HomeScreenConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // UI state
  const [leaderViewMode, setLeaderViewMode] = useState<'grid' | 'list'>('grid');
  const [isActivitiesSheetOpen, setIsActivitiesSheetOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    loadData();
  }, [isAdmin]);

  // Realtime: refresh leader list when n8n sync (or any other source) writes to leaders / leader_cabins.
  useEffect(() => {
    if (!isAdmin) return;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => { loadData(); }, 600);
    };
    const channel = supabase
      .channel('admin-leaders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaders' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leader_cabins' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leader_content' }, scheduleReload)
      .subscribe();
    return () => {
      if (debounce) clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);



  const loadData = async () => {
    setIsLoading(true);
    try {
      const [leadersRes, rolesRes, configRes] = await Promise.all([
        supabase.from('leaders').select('*').order('created_at'),
        supabase.rpc('get_all_leader_roles'),
        supabase.from('home_screen_config').select('*').order('sort_order'),
      ]);
      const roleMap = new Map<string, AppRole>();
      const rolePriority: Record<string, number> = { superadmin: 0, admin: 1, nurse: 2, leader: 3 };
      (rolesRes.data || []).forEach((r: { leader_id: string; role: string }) => {
        const existing = roleMap.get(r.leader_id);
        if (!existing || (rolePriority[r.role] ?? 3) < (rolePriority[existing] ?? 3)) {
          roleMap.set(r.leader_id, r.role as AppRole);
        }
      });
      const leadersWithRoles: LeaderWithRole[] = (leadersRes.data || []).map(leader => ({ ...leader, role: roleMap.get(leader.id) || 'leader' }));
      setLeaders(leadersWithRoles);
      const homeConfigData = configRes.data || [];
      setHomeConfig(homeConfigData);
      setLocalHomeConfig(homeConfigData);
    } catch { showError('Kunne ikke laste data'); } finally { setIsLoading(false); }
  };

  const handleSyncFromSheet = async () => {
    setIsSyncing(true);
    try {
      const { data: cfgRow } = await supabase
        .from('app_config').select('value').eq('key', 'google_sheet_sync').maybeSingle();
      if (!cfgRow?.value) {
        showError('Konfigurer Google Sheet i Innstillinger først');
        return;
      }
      let cfg: { spreadsheetId?: string; range?: string } = {};
      try { cfg = JSON.parse(cfgRow.value); } catch { /* ignore */ }
      if (!cfg.spreadsheetId) {
        showError('Mangler Spreadsheet-ID i innstillinger');
        return;
      }
      const legacyDefaultRange = /^'?Sheet1'?!A1:Z{1,2}1000$/i.test((cfg.range || '').trim());
      const { data, error } = await supabase.functions.invoke('sync-leaders-from-sheet', {
        body: { spreadsheetId: cfg.spreadsheetId, range: legacyDefaultRange ? '' : (cfg.range || ''), dryRun: false },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      const r = data as { saved?: number; failed?: number; unmatched?: string[]; range?: string };
      hapticSuccess();
      const failed = r.failed || 0;
      const unmatched = r.unmatched?.length || 0;
      const parts = [`${r.saved ?? 0} oppdatert`];
      if (r.range) parts.push(r.range.split('!')[0].replace(/^'|'$/g, ''));
      if (failed > 0) parts.push(`${failed} feilet`);
      if (unmatched > 0) parts.push(`${unmatched} ikke matchet`);
      if (failed > 0) showError(parts.join(' · '));
      else showSuccess(parts.join(' · '));
      await loadData();
      rqClient.invalidateQueries();
    } catch (err) {
      console.error('Sync error:', err);
      hapticError();
      const msg = err instanceof Error ? err.message : 'Synk feilet';
      showError(msg);
    } finally {
      setIsSyncing(false);
    }
  };


  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-heading font-semibold">Ingen tilgang</h2>
            <p className="text-muted-foreground mt-2">Du har ikke tilgang til admin-panelet.</p>
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
    <div className="space-y-3 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl lg:text-3xl font-heading font-bold text-foreground">Admin</h1>
          <p className="hidden sm:block text-sm sm:text-base text-muted-foreground mt-1">
            Administrer ledere, aktiviteter og innhold
          </p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Link to="/admin/settings">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline sm:ml-2">Innstillinger</span>
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncFromSheet}
            disabled={isSyncing}
            title="Synk ledere fra Google Sheet (lagret kobling)"
          >
            {isSyncing
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <RefreshCw className="h-4 w-4" />}
            <span className="hidden sm:inline sm:ml-2">Synk</span>
          </Button>
        </div>
      </div>


      {/* Lederoversikt header with toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-semibold">Lederoversikt</h2>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsActivitiesSheetOpen(true)} className="h-8 px-2 sm:px-3">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline sm:ml-2">Aktiviteter</span>
          </Button>
          <ToggleGroup type="single" value={leaderViewMode} onValueChange={(v) => v && setLeaderViewMode(v as 'grid' | 'list')} className="bg-muted rounded-lg p-0.5 sm:p-1">
            <ToggleGroupItem value="grid" aria-label="Rutenettvisning" className="px-2 sm:px-3 h-7 sm:h-8">
              <LayoutGrid className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Listevisning" className="px-2 sm:px-3 h-7 sm:h-8">
              <List className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Leader Dashboard or List View */}
      {leaderViewMode === 'grid' ? (
        <LeaderDashboard leaders={leaders} homeConfig={localHomeConfig} onLeaderUpdated={loadData} />
      ) : (
        <LeaderListView leaders={leaders} homeConfig={localHomeConfig} onLeaderUpdated={loadData} />
      )}

      {/* Activities Sheet */}
      <SessionActivitiesSheet open={isActivitiesSheetOpen} onOpenChange={setIsActivitiesSheetOpen} />

      {/* Delte notater / whiteboard */}
      <AdminNotesPanel />
    </div>
  );
}
