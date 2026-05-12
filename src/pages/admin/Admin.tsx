import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState, useEffect, lazy, Suspense } from 'react';
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
  Save, ChevronDown, ChevronUp, LayoutGrid, List, UserCog, Sparkles, ClipboardPaste,
} from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LeaderDashboard } from '@/components/admin/LeaderDashboard';
import { LeaderListView } from '@/components/admin/LeaderListView';
import { LeaderActivationTab } from '@/components/admin/LeaderActivationTab';
import { PasteLeaderContentSheet } from '@/components/admin/PasteLeaderContentSheet';
import type { Tables } from '@/integrations/supabase/types';
import { hapticSuccess, hapticError, hapticImpact } from '@/lib/capacitorHaptics';


// Lazy-load the heavy HomeConfig section (includes @dnd-kit)
const HomeConfigSection = lazy(() => import('@/components/admin/HomeConfigTab'));

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

  // Session activities
  const [sessionActivitiesText, setSessionActivitiesText] = useState('');
  const [isSavingActivities, setIsSavingActivities] = useState(false);

  // UI state
  const [isHomeConfigOpen, setIsHomeConfigOpen] = useState(false);
  const [isActivationOpen, setIsActivationOpen] = useState(false);
  const [leaderViewMode, setLeaderViewMode] = useState<'grid' | 'list'>('grid');
  const [isActivitiesSheetOpen, setIsActivitiesSheetOpen] = useState(false);
  const [isPasteSheetOpen, setIsPasteSheetOpen] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    loadData();
    loadSessionActivitiesText();
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
      showSuccess('Aktiviteter lagret!');
    } catch {
      showError('Kunne ikke lagre aktiviteter');
    } finally {
      setIsSavingActivities(false);
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
            onClick={() => setIsPasteSheetOpen(true)}
            title="Lim inn rader fra Google Sheets/Excel for å oppdatere ledere raskt"
          >
            <ClipboardPaste className="h-4 w-4" />
            <span className="hidden sm:inline sm:ml-2">Lim inn</span>
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

      {/* Leader activation management */}
      <Collapsible open={isActivationOpen} onOpenChange={setIsActivationOpen}>
        <Card>
          <CardHeader>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <UserCog className="w-5 h-5" />
                <div className="text-left">
                  <CardTitle>Lederaktivering</CardTitle>
                  <CardDescription>Styr hvem som kan logge inn i appen</CardDescription>
                </div>
              </div>
              {isActivationOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <LeaderActivationTab leaders={leaders} onLeaderUpdated={loadData} isSuperAdmin={isSuperAdmin} />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>


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

      <PasteLeaderContentSheet
        open={isPasteSheetOpen}
        onOpenChange={setIsPasteSheetOpen}
        leaders={leaders}
        onSaved={loadData}
      />
    </div>
  );
}
