import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Settings, Loader2, Shield, Calendar, RefreshCw, Check,
  Save, ChevronDown, ChevronUp, LayoutGrid, List, UserCog
} from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LeaderDashboard } from '@/components/admin/LeaderDashboard';
import { LeaderListView } from '@/components/admin/LeaderListView';
import { LeaderActivationTab } from '@/components/admin/LeaderActivationTab';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import { hapticSuccess, hapticError, hapticImpact } from '@/lib/capacitorHaptics';

// Lazy-load the heavy HomeConfig section (includes @dnd-kit)
const HomeConfigSection = lazy(() => import('@/components/admin/HomeConfigTab'));

type Leader = Tables<'leaders'>;
type AppRole = 'admin' | 'nurse' | 'leader';

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
  const { isAdmin } = useAuth();
  const [leaders, setLeaders] = useState<LeaderWithRole[]>([]);
  const [homeConfig, setHomeConfig] = useState<HomeScreenConfig[]>([]);
  const [localHomeConfig, setLocalHomeConfig] = useState<HomeScreenConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Session activities
  const [sessionActivitiesText, setSessionActivitiesText] = useState('');
  const [isSavingActivities, setIsSavingActivities] = useState(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncSuccess, setLastSyncSuccess] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [storedExportWebhookUrl, setStoredExportWebhookUrl] = useState('');

  // Auto-export
  const [pendingExport, setPendingExport] = useState(false);
  const [exportCountdown, setExportCountdown] = useState(0);
  const exportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // UI state
  const [isHomeConfigOpen, setIsHomeConfigOpen] = useState(false);
  const [isActivationOpen, setIsActivationOpen] = useState(false);
  const [leaderViewMode, setLeaderViewMode] = useState<'grid' | 'list'>('grid');
  const [isActivitiesSheetOpen, setIsActivitiesSheetOpen] = useState(false);

  useEffect(() => {
    loadData();
    loadLastSyncTime();
    loadSessionActivitiesText();
    loadExportWebhookUrl();
    return () => {
      if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const loadSessionActivitiesText = async () => {
    const { data } = await supabase.from('app_config').select('value').eq('key', 'session_activities_text').maybeSingle();
    if (data?.value) setSessionActivitiesText(data.value);
  };

  const saveSessionActivitiesText = async () => {
    setIsSavingActivities(true);
    try {
      const { error } = await supabase.from('app_config').upsert({
        key: 'session_activities_text', value: sessionActivitiesText, updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
      if (error) throw error;
      hapticSuccess();
      toast.success('Aktiviteter lagret!');
    } catch {
      hapticError();
      toast.error('Kunne ikke lagre aktiviteter');
    } finally {
      setIsSavingActivities(false);
    }
  };

  const loadLastSyncTime = async () => {
    const { data } = await supabase.from('app_config').select('value').eq('key', 'last_sync_timestamp').maybeSingle();
    if (data?.value) setLastSyncTime(data.value);
  };

  const loadExportWebhookUrl = async () => {
    const { data } = await supabase.from('app_config').select('value').eq('key', 'export_webhook_url').maybeSingle();
    if (data?.value) setStoredExportWebhookUrl(data.value);
  };

  const formatSyncTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch { return null; }
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
    try {
      const { data, error } = await supabase.functions.invoke('trigger-export');
      if (error) { if (!isAutoExport) toast.error('Kunne ikke starte eksport'); return; }
      if (data?.success) toast.success(`Eksport fullført! ${data.leadersExported} ledere sendt til Google Sheets`);
      else if (!isAutoExport) toast.error(`Eksport feilet: ${data?.error || 'Ukjent feil'}`);
    } catch { if (!isAutoExport) toast.error('Kunne ikke starte eksport'); }
  }, [storedExportWebhookUrl]);

  const scheduleAutoExport = useCallback(() => {
    if (!storedExportWebhookUrl) return;
    if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setPendingExport(true);
    setExportCountdown(30);
    countdownIntervalRef.current = setInterval(() => {
      setExportCountdown(prev => {
        if (prev <= 1) { if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
    exportTimerRef.current = setTimeout(() => triggerExport(true), 30000);
  }, [storedExportWebhookUrl, triggerExport]);

  const triggerSync = async () => {
    setIsSyncing(true);
    setLastSyncSuccess(false);
    try {
      const { data, error } = await supabase.functions.invoke('trigger-sync');
      if (error) { toast.error('Kunne ikke starte synkronisering'); return; }
      if (data?.success) {
        setLastSyncSuccess(true);
        setLastSyncTime(new Date().toISOString());
        toast.success(`Synkronisering fullført! (Status: ${data.webhookStatus})`);
        loadData();
      } else {
        toast.error(`Synkronisering feilet: ${data?.n8nError || data?.error || 'Ukjent feil'}`);
      }
    } catch { toast.error('Kunne ikke starte synkronisering'); } finally { setIsSyncing(false); }
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
      (rolesRes.data || []).forEach((r: { leader_id: string; role: string }) => roleMap.set(r.leader_id, r.role as AppRole));
      const leadersWithRoles: LeaderWithRole[] = (leadersRes.data || []).map(leader => ({ ...leader, role: roleMap.get(leader.id) || 'leader' }));
      setLeaders(leadersWithRoles);
      const homeConfigData = configRes.data || [];
      setHomeConfig(homeConfigData);
      setLocalHomeConfig(homeConfigData);
    } catch { toast.error('Kunne ikke laste data'); } finally { setIsLoading(false); }
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
            onClick={triggerSync}
            disabled={isSyncing}
            variant={lastSyncSuccess ? "default" : "outline"}
            size="sm"
            className={lastSyncSuccess ? "bg-green-600 hover:bg-green-700" : ""}
          >
            {isSyncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : lastSyncSuccess ? <Check className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
            <span className="hidden sm:inline sm:ml-2">{isSyncing ? "Synkroniserer..." : lastSyncSuccess ? "Synket!" : "Synk ledere"}</span>
          </Button>
          {lastSyncTime && <span className="hidden sm:inline text-xs text-muted-foreground">{formatSyncTime(lastSyncTime)}</span>}
        </div>
      </div>

      {/* Lederoversikt header with toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-semibold">Lederoversikt</h2>
          {lastSyncTime && <span className="sm:hidden text-[10px] text-muted-foreground">{formatSyncTime(lastSyncTime)}</span>}
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
        <LeaderDashboard leaders={leaders} homeConfig={localHomeConfig} onLeaderUpdated={loadData} onScheduleAutoExport={scheduleAutoExport} />
      ) : (
        <LeaderListView leaders={leaders} homeConfig={localHomeConfig} onLeaderUpdated={loadData} />
      )}

      {/* Activities Sheet */}
      <Sheet open={isActivitiesSheetOpen} onOpenChange={setIsActivitiesSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2"><Calendar className="w-5 h-5" />Aktiviteter</SheetTitle>
            <SheetDescription>Skriv tekst som vises på hjemskjermen under "Aktiviteter denne økten"</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <Textarea
              placeholder={"Skriv aktiviteter for denne økten her...\n\nEksempel:\n• 09:00 - Frokost\n• 10:00 - Morgensamling\n• 11:00 - Aktiviteter"}
              value={sessionActivitiesText}
              onChange={(e) => setSessionActivitiesText(e.target.value)}
              className="min-h-[250px]"
            />
            <Button onClick={() => { saveSessionActivitiesText(); setIsActivitiesSheetOpen(false); }} disabled={isSavingActivities} className="w-full">
              {isSavingActivities ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Lagre aktiviteter
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Home screen config - lazy loaded */}
      <Collapsible open={isHomeConfigOpen} onOpenChange={setIsHomeConfigOpen}>
        <Card>
          <CardHeader>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                <div className="text-left">
                  <CardTitle>Hjemskjerm-elementer</CardTitle>
                  <CardDescription>Konfigurer tittel, ikon og synlighet for hvert element på hjemskjermen</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isHomeConfigOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
                <HomeConfigSection
                  homeConfig={homeConfig}
                  localHomeConfig={localHomeConfig}
                  setLocalHomeConfig={setLocalHomeConfig}
                  onSaved={loadData}
                  setHomeConfig={setHomeConfig}
                />
              </Suspense>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
