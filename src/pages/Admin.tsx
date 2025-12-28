import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, 
  Home, 
  Plus, 
  Trash2, 
  Save, 
  Megaphone,
  Settings,
  Loader2,
  Shield,
  Calendar,
  RefreshCw,
  Info,
  Star,
  Heart,
  Bell,
  Zap,
  Activity,
  MessageSquare,
  FileSpreadsheet,
  CheckCircle2
} from 'lucide-react';
import { SyncErrorDetails } from '@/components/admin/SyncErrorDetails';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type Leader = Tables<'leaders'>;
type LeaderContent = Tables<'leader_content'>;
type SessionActivity = Tables<'session_activities'>;
type HomeScreenConfig = Tables<'home_screen_config'>;
type Announcement = Tables<'announcements'>;

interface ExtraFieldConfig {
  id: string;
  field_key: string;
  title: string;
  icon: string;
  is_visible: boolean;
  sort_order: number;
}

const availableIcons = [
  { value: 'info', label: 'Info', icon: Info },
  { value: 'star', label: 'Stjerne', icon: Star },
  { value: 'heart', label: 'Hjerte', icon: Heart },
  { value: 'bell', label: 'Bjelle', icon: Bell },
  { value: 'zap', label: 'Lyn', icon: Zap },
  { value: 'activity', label: 'Aktivitet', icon: Activity },
  { value: 'plus', label: 'Pluss', icon: Plus },
  { value: 'message', label: 'Melding', icon: MessageSquare },
];

export default function Admin() {
  const { isAdmin } = useAuth();
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [selectedLeader, setSelectedLeader] = useState<Leader | null>(null);
  const [leaderContent, setLeaderContent] = useState<Partial<LeaderContent>>({});
  const [sessionActivities, setSessionActivities] = useState<SessionActivity[]>([]);
  const [homeConfig, setHomeConfig] = useState<HomeScreenConfig[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [extraFieldsConfig, setExtraFieldsConfig] = useState<ExtraFieldConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSyncInstructions, setShowSyncInstructions] = useState(false);

  // New leader form
  const [newLeaderName, setNewLeaderName] = useState('');
  const [newLeaderPhone, setNewLeaderPhone] = useState('');
  const [newLeaderIsAdmin, setNewLeaderIsAdmin] = useState(false);

  // New activity form
  const [newActivityTitle, setNewActivityTitle] = useState('');
  const [newActivityTime, setNewActivityTime] = useState('');

  // New announcement form
  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState('');
  const [newAnnouncementContent, setNewAnnouncementContent] = useState('');

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

  useEffect(() => {
    loadData();
    loadWebhookUrl();
  }, []);

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
      toast.success('Webhook URL lagret!');
    } catch (error) {
      console.error('Error saving webhook URL:', error);
      toast.error('Kunne ikke lagre webhook URL');
    } finally {
      setIsSavingWebhook(false);
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
    console.log('Triggering sync via backend function');

    try {
      const { data, error } = await supabase.functions.invoke('trigger-sync');

      if (error) {
        console.error('Error calling trigger-sync:', error);
        setSyncError({ error: 'Kunne ikke kontakte backend' });
        toast.error('Kunne ikke starte synkronisering');
        return;
      }

      console.log('trigger-sync response:', data);

      if (data?.success) {
        setLastSyncSuccess(true);
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

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [leadersRes, activitiesRes, configRes, announcementsRes, extraConfigRes] = await Promise.all([
        supabase.from('leaders').select('*').order('name'),
        supabase.from('session_activities').select('*').order('sort_order'),
        supabase.from('home_screen_config').select('*').order('sort_order'),
        supabase.from('announcements').select('*').order('created_at', { ascending: false }),
        supabase.from('extra_fields_config').select('*').order('sort_order'),
      ]);

      setLeaders(leadersRes.data || []);
      setSessionActivities(activitiesRes.data || []);
      setHomeConfig(configRes.data || []);
      setAnnouncements(announcementsRes.data || []);
      setExtraFieldsConfig((extraConfigRes.data || []) as ExtraFieldConfig[]);
    } catch (error) {
      console.error('Error loading admin data:', error);
      toast.error('Kunne ikke laste data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadLeaderContent = async (leader: Leader) => {
    setSelectedLeader(leader);
    const { data } = await supabase
      .from('leader_content')
      .select('*')
      .eq('leader_id', leader.id)
      .maybeSingle();
    
    setLeaderContent(data || { leader_id: leader.id });
  };

  const saveLeaderContent = async () => {
    if (!selectedLeader) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('leader_content')
        .upsert({
          leader_id: selectedLeader.id,
          current_activity: leaderContent.current_activity || null,
          extra_activity: leaderContent.extra_activity || null,
          personal_notes: leaderContent.personal_notes || null,
          obs_message: leaderContent.obs_message || null,
        });

      if (error) throw error;
      toast.success('Innhold lagret!');
    } catch (error) {
      console.error('Error saving content:', error);
      toast.error('Kunne ikke lagre');
    } finally {
      setIsSaving(false);
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

  const deleteLeader = async (leaderId: string) => {
    if (!confirm('Er du sikker på at du vil slette denne lederen?')) return;

    try {
      await supabase.from('leaders').delete().eq('id', leaderId);
      if (selectedLeader?.id === leaderId) {
        setSelectedLeader(null);
        setLeaderContent({});
      }
      loadData();
      toast.success('Leder slettet');
    } catch (error) {
      toast.error('Kunne ikke slette leder');
    }
  };

  const addSessionActivity = async () => {
    if (!newActivityTitle) {
      toast.error('Skriv inn en tittel');
      return;
    }

    try {
      await supabase.from('session_activities').insert({
        title: newActivityTitle,
        time_slot: newActivityTime || null,
        sort_order: sessionActivities.length,
      });

      setNewActivityTitle('');
      setNewActivityTime('');
      loadData();
      toast.success('Aktivitet lagt til!');
    } catch (error) {
      toast.error('Kunne ikke legge til aktivitet');
    }
  };

  const toggleActivityActive = async (activity: SessionActivity) => {
    try {
      await supabase
        .from('session_activities')
        .update({ is_active: !activity.is_active })
        .eq('id', activity.id);
      loadData();
    } catch (error) {
      toast.error('Kunne ikke oppdatere aktivitet');
    }
  };

  const deleteActivity = async (activityId: string) => {
    try {
      await supabase.from('session_activities').delete().eq('id', activityId);
      loadData();
      toast.success('Aktivitet slettet');
    } catch (error) {
      toast.error('Kunne ikke slette aktivitet');
    }
  };

  const toggleHomeConfigVisibility = async (config: HomeScreenConfig) => {
    try {
      await supabase
        .from('home_screen_config')
        .update({ is_visible: !config.is_visible })
        .eq('id', config.id);
      loadData();
    } catch (error) {
      toast.error('Kunne ikke oppdatere konfigurasjon');
    }
  };

  const addAnnouncement = async () => {
    if (!newAnnouncementTitle) {
      toast.error('Skriv inn en tittel');
      return;
    }

    try {
      await supabase.from('announcements').insert({
        title: newAnnouncementTitle,
        content: newAnnouncementContent || null,
      });

      setNewAnnouncementTitle('');
      setNewAnnouncementContent('');
      loadData();
      toast.success('Beskjed lagt til!');
    } catch (error) {
      toast.error('Kunne ikke legge til beskjed');
    }
  };

  const toggleAnnouncementActive = async (announcement: Announcement) => {
    try {
      await supabase
        .from('announcements')
        .update({ is_active: !announcement.is_active })
        .eq('id', announcement.id);
      loadData();
    } catch (error) {
      toast.error('Kunne ikke oppdatere beskjed');
    }
  };

  const deleteAnnouncement = async (id: string) => {
    try {
      await supabase.from('announcements').delete().eq('id', id);
      loadData();
      toast.success('Beskjed slettet');
    } catch (error) {
      toast.error('Kunne ikke slette beskjed');
    }
  };

  const updateExtraFieldConfig = async (fieldId: string, updates: Partial<ExtraFieldConfig>) => {
    try {
      await supabase
        .from('extra_fields_config')
        .update(updates)
        .eq('id', fieldId);
      loadData();
      toast.success('Oppdatert');
    } catch (error) {
      toast.error('Kunne ikke oppdatere');
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
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
          Admin
        </h1>
        <p className="text-muted-foreground mt-1">
          Administrer ledere, aktiviteter og innhold
        </p>
      </div>

      <Tabs defaultValue="leaders" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
          <TabsTrigger value="leaders" className="gap-2">
            <Users className="w-4 h-4 hidden sm:block" />
            Ledere
          </TabsTrigger>
          <TabsTrigger value="content" className="gap-2">
            <Home className="w-4 h-4 hidden sm:block" />
            Innhold
          </TabsTrigger>
          <TabsTrigger value="activities" className="gap-2">
            <Calendar className="w-4 h-4 hidden sm:block" />
            Aktiviteter
          </TabsTrigger>
          <TabsTrigger value="announcements" className="gap-2">
            <Megaphone className="w-4 h-4 hidden sm:block" />
            Veggen
          </TabsTrigger>
          <TabsTrigger value="setup" className="gap-2">
            <Settings className="w-4 h-4 hidden sm:block" />
            Oppsett
          </TabsTrigger>
          <TabsTrigger value="sync" className="gap-2">
            <RefreshCw className="w-4 h-4 hidden sm:block" />
            Synk
          </TabsTrigger>
        </TabsList>

        {/* Leaders Tab */}
        <TabsContent value="leaders" className="space-y-4">
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

          <Card>
            <CardHeader>
              <CardTitle>Alle ledere ({leaders.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {leaders.map((leader) => (
                  <div
                    key={leader.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{leader.name}</p>
                      <p className="text-sm text-muted-foreground">{leader.phone}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteLeader(leader.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {leaders.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">
                    Ingen ledere registrert enda
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Leader list */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Velg leder</CardTitle>
                <CardDescription>Klikk for å redigere innhold</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {leaders.map((leader) => (
                    <button
                      key={leader.id}
                      onClick={() => loadLeaderContent(leader)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedLeader?.id === leader.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 hover:bg-muted'
                      }`}
                    >
                      <p className="font-medium">{leader.name}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Content editor */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>
                  {selectedLeader ? `Innhold for ${selectedLeader.name}` : 'Velg en leder'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedLeader ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Aktivitet</Label>
                      <Input
                        placeholder="Hva skal lederen gjøre nå?"
                        value={leaderContent.current_activity || ''}
                        onChange={(e) =>
                          setLeaderContent({ ...leaderContent, current_activity: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ekstra aktivitet</Label>
                      <Input
                        placeholder="Eventuelle tilleggsoppgaver"
                        value={leaderContent.extra_activity || ''}
                        onChange={(e) =>
                          setLeaderContent({ ...leaderContent, extra_activity: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Notater til lederen</Label>
                      <Textarea
                        placeholder="Personlige beskjeder"
                        value={leaderContent.personal_notes || ''}
                        onChange={(e) =>
                          setLeaderContent({ ...leaderContent, personal_notes: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-warning">OBS-melding</Label>
                      <Textarea
                        placeholder="Kritisk informasjon (vises øverst)"
                        value={leaderContent.obs_message || ''}
                        onChange={(e) =>
                          setLeaderContent({ ...leaderContent, obs_message: e.target.value })
                        }
                      />
                    </div>
                    <Button onClick={saveLeaderContent} disabled={isSaving}>
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Lagre
                    </Button>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Velg en leder fra listen for å redigere innhold
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Home screen config */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Hjemskjerm-konfigurasjon
              </CardTitle>
              <CardDescription>
                Velg hvilke elementer som vises på ledernes hjemskjerm
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {homeConfig.map((config) => (
                  <div
                    key={config.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <span className="font-medium">{config.label}</span>
                    <Switch
                      checked={config.is_visible || false}
                      onCheckedChange={() => toggleHomeConfigVisibility(config)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activities Tab */}
        <TabsContent value="activities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Ny aktivitet
              </CardTitle>
              <CardDescription>
                Aktiviteter som vises under "Aktiviteter denne økten"
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tittel</Label>
                  <Input
                    placeholder="F.eks. Frokost"
                    value={newActivityTitle}
                    onChange={(e) => setNewActivityTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tidspunkt (valgfritt)</Label>
                  <Input
                    placeholder="F.eks. 08:00"
                    value={newActivityTime}
                    onChange={(e) => setNewActivityTime(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={addSessionActivity}>
                <Plus className="w-4 h-4 mr-2" />
                Legg til
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alle aktiviteter</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sessionActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={activity.is_active || false}
                        onCheckedChange={() => toggleActivityActive(activity)}
                      />
                      <div>
                        <p className="font-medium">{activity.title}</p>
                        {activity.time_slot && (
                          <Badge variant="secondary" className="mt-1">
                            {activity.time_slot}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteActivity(activity.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {sessionActivities.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">
                    Ingen aktiviteter enda
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Announcements Tab */}
        <TabsContent value="announcements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Ny beskjed
              </CardTitle>
              <CardDescription>
                Beskjeder som vises på "Den store veggen"
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tittel</Label>
                <Input
                  placeholder="Overskrift på beskjeden"
                  value={newAnnouncementTitle}
                  onChange={(e) => setNewAnnouncementTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Innhold (valgfritt)</Label>
                <Textarea
                  placeholder="Mer detaljer..."
                  value={newAnnouncementContent}
                  onChange={(e) => setNewAnnouncementContent(e.target.value)}
                />
              </div>
              <Button onClick={addAnnouncement}>
                <Plus className="w-4 h-4 mr-2" />
                Publiser
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alle beskjeder</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {announcements.map((announcement) => (
                  <div
                    key={announcement.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={announcement.is_active || false}
                        onCheckedChange={() => toggleAnnouncementActive(announcement)}
                      />
                      <div>
                        <p className="font-medium">{announcement.title}</p>
                        {announcement.content && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {announcement.content}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteAnnouncement(announcement.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {announcements.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">
                    Ingen beskjeder enda
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Setup Tab */}
        <TabsContent value="setup" className="space-y-4">
          {/* Webhook Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Webhook konfigurasjon
              </CardTitle>
              <CardDescription>
                Konfigurer n8n webhook URL for synkronisering fra Google Sheets
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
                <Label htmlFor="webhookUrl">n8n Webhook URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="webhookUrl"
                    placeholder="https://n8n.example.com/webhook/abc123"
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
                  Tlf | Navn | Hytte Ansvar | Ministerpost | Team
                </code>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">Google Sheet-kolonne</th>
                      <th className="text-left py-2 px-3 font-medium">Database-felt</th>
                      <th className="text-left py-2 px-3 font-medium">Beskrivelse</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">Tlf</code></td>
                      <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">phone</code></td>
                      <td className="py-2 px-3 text-muted-foreground">Unik ID for å matche ledere (påkrevd)</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">Navn</code></td>
                      <td className="py-2 px-3"><code className="text-xs bg-muted px-1 rounded">name</code></td>
                      <td className="py-2 px-3 text-muted-foreground">Fullt navn (påkrevd for nye ledere)</td>
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

              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  <strong>Tips:</strong> Telefonnummer brukes som unik nøkkel. Hvis en leder med samme telefonnummer 
                  allerede finnes, oppdateres informasjonen. Ellers opprettes en ny leder.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Extra Fields Config */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Ekstra-felter konfigurasjon
              </CardTitle>
              <CardDescription>
                Konfigurer tittel og ikon for ekstra-feltene fra Google Sheet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {extraFieldsConfig.map((field) => (
                  <div
                    key={field.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Switch
                        checked={field.is_visible}
                        onCheckedChange={(checked) => 
                          updateExtraFieldConfig(field.id, { is_visible: checked })
                        }
                      />
                      <Badge variant="outline">{field.field_key.replace('_', ' #')}</Badge>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <Input
                        placeholder="Tittel"
                        value={field.title}
                        onChange={(e) => 
                          updateExtraFieldConfig(field.id, { title: e.target.value })
                        }
                        className="w-full sm:w-40"
                      />
                      
                      <Select
                        value={field.icon}
                        onValueChange={(value) => 
                          updateExtraFieldConfig(field.id, { icon: value })
                        }
                      >
                        <SelectTrigger className="w-full sm:w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableIcons.map(({ value, label, icon: Icon }) => (
                            <SelectItem key={value} value={value}>
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4" />
                                {label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Leader Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Leder-oversikt ({leaders.length})
              </CardTitle>
              <CardDescription>
                Oversikt over alle importerte ledere med detaljer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">Navn</th>
                      <th className="text-left py-2 px-3 font-medium">Telefon</th>
                      <th className="text-left py-2 px-3 font-medium hidden sm:table-cell">Team</th>
                      <th className="text-left py-2 px-3 font-medium hidden md:table-cell">Hytte</th>
                      <th className="text-left py-2 px-3 font-medium hidden lg:table-cell">Ministerpost</th>
                      <th className="text-right py-2 px-3 font-medium">Handling</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {leaders.map((leader) => (
                      <tr key={leader.id} className="hover:bg-muted/50">
                        <td className="py-2 px-3 font-medium">{leader.name}</td>
                        <td className="py-2 px-3 text-muted-foreground">{leader.phone}</td>
                        <td className="py-2 px-3 text-muted-foreground hidden sm:table-cell">
                          {leader.team || '-'}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground hidden md:table-cell">
                          {leader.cabin_info || leader.cabin || '-'}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground hidden lg:table-cell">
                          {leader.ministerpost || '-'}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteLeader(leader.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {leaders.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">
                    Ingen ledere importert enda. Sett opp webhook og kjør første synkronisering.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sync Tab */}
        <TabsContent value="sync" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                Synkroniser data
              </CardTitle>
              <CardDescription>
                Kjør synkronisering fra Google Sheet for å oppdatere lederinformasjon
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!storedWebhookUrl && (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-700 dark:text-yellow-400">
                  <p className="text-sm">
                    <strong>Ikke konfigurert:</strong> Gå til Oppsett-fanen for å legge inn webhook URL først.
                  </p>
                </div>
              )}

              <Button 
                onClick={triggerSync} 
                disabled={isSyncing || !storedWebhookUrl}
                className="w-full sm:w-auto"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Synkroniserer...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Synk nå
                  </>
                )}
              </Button>

              {lastSyncSuccess && !syncError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-medium">Siste synkronisering fullført!</span>
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

              <div className="border-t pt-4 mt-4">
                <Button 
                  variant="ghost" 
                  onClick={() => setShowSyncInstructions(!showSyncInstructions)}
                  className="w-full justify-start"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  {showSyncInstructions ? 'Skjul n8n-instruksjoner' : 'Vis n8n-instruksjoner'}
                </Button>
              </div>

              {showSyncInstructions && (
                <div className="p-4 rounded-lg bg-muted/50 space-y-4">
                  <h4 className="font-semibold">n8n Workflow oppsett:</h4>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium">n8n AI Builder prompt:</p>
                    <code className="block text-xs bg-background p-2 rounded whitespace-pre-wrap">
{`Lag en workflow som:
1. Starter med Webhook trigger
2. Henter alle rader fra Google Sheets
3. Transformerer hver rad til dette format:
   {
     phone: [Tlf - fjern mellomrom],
     name: [Navn],
     cabin_info: [Hytte Ansvar],
     ministerpost: [Ministerpost],
     team: [Team]
   }
4. Sender HTTP POST til:
   https://noxnbtvxksgjsqzfdgcd.supabase.co/functions/v1/sync-leaders-import
   
   Med body: { "leaders": [array av transformerte objekter] }`}
                    </code>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Viktig:</p>
                    <ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Send alltid alle ledere fra Google Sheet</li>
                      <li>Nye ledere opprettes automatisk (krever navn + telefon)</li>
                      <li>Eksisterende ledere oppdateres basert på telefonnummer</li>
                      <li>Telefonnummer uten mellomrom brukes som unik nøkkel</li>
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
