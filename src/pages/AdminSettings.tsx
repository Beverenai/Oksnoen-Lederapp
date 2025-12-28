import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Users, 
  Plus, 
  Save, 
  Settings,
  Loader2,
  Shield,
  RefreshCw,
  Heart,
  FileSpreadsheet,
  CheckCircle2,
  Upload,
  UserCheck,
  Search,
  Check,
  ArrowLeft,
  Home
} from 'lucide-react';
import { SyncErrorDetails } from '@/components/admin/SyncErrorDetails';
import { LeaderDetailDialog } from '@/components/admin/LeaderDetailDialog';
import { CabinsTab } from '@/components/admin/CabinsTab';
import { ParticipantImportTab } from '@/components/admin/ParticipantImportTab';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type Leader = Tables<'leaders'>;
type UserRole = Tables<'user_roles'>;
type AppRole = 'admin' | 'nurse' | 'leader';

interface LeaderWithRole extends Leader {
  role: AppRole;
}

export default function AdminSettings() {
  const { isAdmin } = useAuth();
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
  const exportTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
        setLastSyncSuccess(true);
        setLastSyncTime(new Date().toISOString());
        toast.success(`Synkronisering fullført! (Status: ${data.webhookStatus})`);
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
    <div className="space-y-6 animate-fade-in">
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

      <Tabs defaultValue="leaders" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="leaders" className="gap-2">
            <Users className="w-4 h-4 hidden sm:block" />
            Ledere
          </TabsTrigger>
          <TabsTrigger value="cabins" className="gap-2">
            <Home className="w-4 h-4 hidden sm:block" />
            Hytter
          </TabsTrigger>
          <TabsTrigger value="participants" className="gap-2">
            <Users className="w-4 h-4 hidden sm:block" />
            Deltakere
          </TabsTrigger>
          <TabsTrigger value="sync" className="gap-2">
            <RefreshCw className="w-4 h-4 hidden sm:block" />
            Synk
          </TabsTrigger>
          <TabsTrigger value="setup" className="gap-2">
            <Settings className="w-4 h-4 hidden sm:block" />
            Oppsett
          </TabsTrigger>
        </TabsList>

        {/* Cabins Tab */}
        <TabsContent value="cabins" className="space-y-4">
          <CabinsTab />
        </TabsContent>

        {/* Participants Tab */}
        <TabsContent value="participants" className="space-y-4">
          <ParticipantImportTab />
        </TabsContent>

        {/* Setup Tab */}
        <TabsContent value="setup" className="space-y-4">
          {/* Import Webhook Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                Import Webhook (Google Sheets → App)
              </CardTitle>
              <CardDescription>
                Konfigurer n8n webhook URL for import fra Google Sheets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {storedWebhookUrl && (
                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                  <p className="text-muted-foreground">Lagret URL:</p>
                  <code className="text-xs break-all">{storedWebhookUrl}</code>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="webhookUrl">n8n Import Webhook URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="webhookUrl"
                    placeholder="https://n8n.example.com/webhook/import"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    onClick={saveWebhookUrl} 
                    disabled={isSavingWebhook}
                    variant="outline"
                  >
                    {isSavingWebhook ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Export Webhook Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Eksport Webhook (App → Google Sheets)
              </CardTitle>
              <CardDescription>
                Konfigurer n8n webhook URL for eksport til Google Sheets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {storedExportWebhookUrl && (
                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                  <p className="text-muted-foreground">Lagret URL:</p>
                  <code className="text-xs break-all">{storedExportWebhookUrl}</code>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="exportWebhookUrl">n8n Eksport Webhook URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="exportWebhookUrl"
                    placeholder="https://n8n.example.com/webhook/export"
                    value={exportWebhookUrl}
                    onChange={(e) => setExportWebhookUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    onClick={saveExportWebhookUrl} 
                    disabled={isSavingExportWebhook}
                    variant="outline"
                  >
                    {isSavingExportWebhook ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  <strong>n8n eksport workflow:</strong> Lag en workflow som mottar data via webhook og oppdaterer Google Sheet basert på telefonnummer.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Field Mapping Documentation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                Felt-mapping fra Google Sheet
              </CardTitle>
              <CardDescription>
                Forventet format i Google Sheet for leder-import
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Google Sheet-kolonner:</p>
                <code className="block text-xs bg-muted p-3 rounded overflow-x-auto">
                  Tlf | Navn | Hytte Ansvar | Ministerpost | Team | Aktivitet | Notater Til deg | OBS! | Ekstra #1 | Ekstra #2 | Ekstra #3 | Ekstra #4 | Ekstra #5
                </code>
              </div>
              
              <div className="space-y-3">
                <p className="text-sm font-medium">Lederinfo (leaders-tabellen):</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium">Google Sheet</th>
                        <th className="text-left py-2 px-3 font-medium">JSON-felt</th>
                        <th className="text-left py-2 px-3 font-medium">Beskrivelse</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <tr>
                        <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">Tlf</code></td>
                        <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">phone</code></td>
                        <td className="py-2 px-3 text-muted-foreground">Unik ID for å matche ledere <Badge variant="destructive" className="ml-1 text-[10px]">Påkrevd</Badge></td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">Navn</code></td>
                        <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">name</code></td>
                        <td className="py-2 px-3 text-muted-foreground">Fullt navn <Badge variant="destructive" className="ml-1 text-[10px]">Påkrevd for nye</Badge></td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">Hytte Ansvar</code></td>
                        <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">cabin_info</code></td>
                        <td className="py-2 px-3 text-muted-foreground">Hvilken hytte lederen har ansvar for</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">Ministerpost</code></td>
                        <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">ministerpost</code></td>
                        <td className="py-2 px-3 text-muted-foreground">Lederens rolle/stilling</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">Team</code></td>
                        <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">team</code></td>
                        <td className="py-2 px-3 text-muted-foreground">Hvilket team lederen tilhører</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Innhold (leader_content-tabellen):</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium">Google Sheet</th>
                        <th className="text-left py-2 px-3 font-medium">JSON-felt</th>
                        <th className="text-left py-2 px-3 font-medium">Beskrivelse</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <tr>
                        <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">Aktivitet</code></td>
                        <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">current_activity</code></td>
                        <td className="py-2 px-3 text-muted-foreground">Nåværende aktivitet</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">Notater Til deg</code></td>
                        <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">personal_notes</code></td>
                        <td className="py-2 px-3 text-muted-foreground">Personlige notater</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">OBS!</code></td>
                        <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">obs_message</code></td>
                        <td className="py-2 px-3 text-muted-foreground">OBS-melding</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">Ekstra #1-5</code></td>
                        <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">extra_1 - extra_5</code></td>
                        <td className="py-2 px-3 text-muted-foreground">Ekstra felter</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sync Tab */}
        <TabsContent value="sync" className="space-y-4">
          {/* Import from Google Sheets */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                Import fra Google Sheets
              </CardTitle>
              <CardDescription>
                Hent ledere fra Google Sheets via n8n webhook
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={triggerSync}
                  disabled={isSyncing || !storedWebhookUrl}
                  variant={lastSyncSuccess ? "default" : "outline"}
                  className={lastSyncSuccess ? "bg-green-600 hover:bg-green-700" : ""}
                >
                  {isSyncing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : lastSyncSuccess ? (
                    <Check className="w-4 h-4 mr-2" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  {isSyncing ? 'Synkroniserer...' : lastSyncSuccess ? 'Synket!' : 'Start import'}
                </Button>

                <Button 
                  variant="outline" 
                  onClick={deactivateAllLeaders}
                  disabled={isDeactivating}
                >
                  {isDeactivating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Users className="w-4 h-4 mr-2" />
                  )}
                  Reset periode
                </Button>
              </div>

              {!storedWebhookUrl && (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-700 dark:text-yellow-400">
                  <p className="text-sm">Konfigurer import webhook URL i Oppsett-fanen først.</p>
                </div>
              )}

              {lastSyncTime && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>Sist importert: {formatSyncTime(lastSyncTime)}</span>
                </div>
              )}

              {syncError && (
                <SyncErrorDetails
                  error={syncError.error}
                  webhookStatus={syncError.webhookStatus}
                  webhookUrl={syncError.webhookUrl}
                  correlationId={syncError.correlationId}
                  rawResponse={syncError.rawResponse}
                  n8nError={syncError.n8nError}
                  n8nStackTrace={syncError.n8nStackTrace}
                />
              )}
            </CardContent>
          </Card>

          {/* Export to Google Sheets */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Eksport til Google Sheets
              </CardTitle>
              <CardDescription>
                Send lederdata tilbake til Google Sheets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => triggerExport(false)}
                  disabled={isExporting || !storedExportWebhookUrl}
                  variant={lastExportSuccess ? "default" : "outline"}
                  className={lastExportSuccess ? "bg-green-600 hover:bg-green-700" : ""}
                >
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : lastExportSuccess ? (
                    <Check className="w-4 h-4 mr-2" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  {isExporting ? 'Eksporterer...' : lastExportSuccess ? 'Eksportert!' : 'Start eksport'}
                </Button>

                {pendingExport && (
                  <Button
                    variant="outline"
                    onClick={cancelPendingExport}
                  >
                    Avbryt auto-eksport ({exportCountdown}s)
                  </Button>
                )}
              </div>

              {!storedExportWebhookUrl && (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-700 dark:text-yellow-400">
                  <p className="text-sm">Konfigurer eksport webhook URL i Oppsett-fanen først.</p>
                </div>
              )}

              {lastExportTime && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>Sist eksportert: {formatSyncTime(lastExportTime)}</span>
                </div>
              )}

              {exportError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400">
                  <p className="text-sm"><strong>Feil:</strong> {exportError}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* n8n Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                n8n Workflow instruksjoner
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                variant="ghost" 
                onClick={() => setShowSyncInstructions(!showSyncInstructions)}
                className="w-full justify-start"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                {showSyncInstructions ? 'Skjul instruksjoner' : 'Vis instruksjoner'}
              </Button>

              {showSyncInstructions && (
                <div className="p-4 rounded-lg bg-muted/50 space-y-6">
                  <div>
                    <h4 className="font-semibold mb-3">Import Workflow (Google Sheets → App):</h4>
                    
                    <div className="space-y-2">
                      <p className="text-sm font-medium">JSON-format for HTTP Request body:</p>
                      <code className="block text-xs bg-background p-3 rounded whitespace-pre-wrap overflow-x-auto">
{`{
  "leaders": [
    {
      "phone": {{ $json['Tlf'].replace(/\\s/g, '') }},
      "name": {{ $json['Navn'] }},
      "cabin_info": {{ $json['Hytte Ansvar'] }},
      "ministerpost": {{ $json['Ministerpost'] }},
      "team": {{ $json['Team'] }},
      "current_activity": {{ $json['Aktivitet'] }},
      "personal_notes": {{ $json['Notater Til deg'] }},
      "obs_message": {{ $json['OBS!'] }},
      "extra_1": {{ $json['Ekstra #1'] }},
      "extra_2": {{ $json['Ekstra #2'] }},
      "extra_3": {{ $json['Ekstra #3'] }},
      "extra_4": {{ $json['Ekstra #4'] }},
      "extra_5": {{ $json['Ekstra #5'] }}
    }
  ]
}`}
                      </code>
                    </div>

                    <div className="space-y-2 mt-3">
                      <p className="text-sm font-medium">Import Endpoint:</p>
                      <code className="block text-xs bg-background p-2 rounded break-all">
                        POST https://noxnbtvxksgjsqzfdgcd.supabase.co/functions/v1/sync-leaders-import
                      </code>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3">Eksport Workflow (App → Google Sheets):</h4>
                    
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Mottatt data fra appen:</p>
                      <code className="block text-xs bg-background p-3 rounded whitespace-pre-wrap overflow-x-auto">
{`{
  "timestamp": "2024-01-15T10:30:00Z",
  "correlationId": "1234567890",
  "leaders": [
    {
      "phone": "12345678",
      "name": "Ola Nordmann",
      "cabin_info": "Hytte 1",
      "ministerpost": "Leder",
      "team": "Team A",
      "current_activity": "Frokost",
      "personal_notes": "Husk møte kl 10",
      "obs_message": "",
      "extra_1": "", "extra_2": "", ...
    }
  ]
}`}
                      </code>
                    </div>

                    <div className="space-y-2 mt-3">
                      <p className="text-sm font-medium">n8n workflow steg:</p>
                      <ol className="text-sm list-decimal list-inside space-y-1 text-muted-foreground">
                        <li>Webhook node: Motta data fra appen</li>
                        <li>Loop: For hver leder i "leaders" array</li>
                        <li>Google Sheets: Finn rad basert på telefonnummer</li>
                        <li>Google Sheets: Oppdater celler med ny data</li>
                      </ol>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                      <strong>Tips:</strong> Telefonnummer brukes som unik nøkkel. Bruk Google Sheets "Lookup" for å finne riktig rad.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>

        {/* Leaders Tab */}
        <TabsContent value="leaders" className="space-y-4">
          {/* Leader Overview Stats and Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Ledere ({leaders.filter(l => l.phone !== '12345678').length})
              </CardTitle>
              <CardDescription className="flex flex-wrap gap-2 items-center">
                <span>Aktive: {leaders.filter(l => l.is_active !== false && l.phone !== '12345678').length}</span>
                <span className="text-muted-foreground">•</span>
                <span>Inaktive: {leaders.filter(l => l.is_active === false && l.phone !== '12345678').length}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={deactivateAllLeaders}
                  disabled={isDeactivating}
                >
                  {isDeactivating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Users className="w-4 h-4 mr-2" />
                  )}
                  Deaktiver alle
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={activateAllLeaders}
                  disabled={isDeactivating}
                >
                  {isDeactivating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <UserCheck className="w-4 h-4 mr-2" />
                  )}
                  Aktiver alle
                </Button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Søk etter leder..."
                  value={leaderSearch}
                  onChange={(e) => setLeaderSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              {/* Leaders Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">Status</th>
                      <th className="text-left py-2 px-3 font-medium">Bilde</th>
                      <th className="text-left py-2 px-3 font-medium">Navn</th>
                      <th className="text-left py-2 px-3 font-medium">Rolle</th>
                      <th className="text-left py-2 px-3 font-medium">Telefon</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {leaders
                      .filter((leader) =>
                        leader.phone !== '12345678' &&
                        (leader.name.toLowerCase().includes(leaderSearch.toLowerCase()) ||
                        leader.phone.includes(leaderSearch))
                      )
                      .map((leader) => (
                      <tr 
                        key={leader.id} 
                        className={`hover:bg-muted/50 cursor-pointer ${leader.is_active === false ? 'opacity-50' : ''}`}
                        onClick={() => {
                          setEditingLeader(leader);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <td className="py-2 px-3">
                          <Switch
                            checked={leader.is_active !== false}
                            onCheckedChange={() => toggleLeaderActive(leader)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <Avatar className="h-8 w-8">
                            {leader.profile_image_url ? (
                              <AvatarImage src={leader.profile_image_url} alt={leader.name} />
                            ) : null}
                            <AvatarFallback className="text-xs">
                              {leader.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </td>
                        <td className="py-2 px-3 font-medium">{leader.name}</td>
                        <td className="py-2 px-3">
                          {leader.role === 'admin' && (
                            <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
                              <Shield className="w-3 h-3 mr-1" />
                              Admin
                            </Badge>
                          )}
                          {leader.role === 'nurse' && (
                            <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                              <Heart className="w-3 h-3 mr-1" />
                              Sykepleier
                            </Badge>
                          )}
                          {leader.role === 'leader' && (
                            <span className="text-muted-foreground">Leder</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">{leader.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {leaders.filter(l => l.phone !== '12345678').length === 0 && (
                  <p className="text-muted-foreground text-center py-8">
                    Ingen ledere registrert enda
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Add New Leader */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Legg til ny leder
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Navn</Label>
                  <Input
                    id="name"
                    placeholder="Ola Nordmann"
                    value={newLeaderName}
                    onChange={(e) => setNewLeaderName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    placeholder="12345678"
                    value={newLeaderPhone}
                    onChange={(e) => setNewLeaderPhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="isAdmin"
                  checked={newLeaderIsAdmin}
                  onCheckedChange={setNewLeaderIsAdmin}
                />
                <Label htmlFor="isAdmin">Admin-tilgang</Label>
              </div>
              <Button onClick={addLeader}>
                <Plus className="w-4 h-4 mr-2" />
                Legg til leder
              </Button>
            </CardContent>
          </Card>

          <LeaderDetailDialog
            leader={editingLeader}
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            onSaved={loadData}
            currentRole={editingLeader?.role || 'leader'}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
