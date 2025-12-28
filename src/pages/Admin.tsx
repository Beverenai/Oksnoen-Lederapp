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
  CheckCircle2,
  UserCheck,
  Search,
  Check,
  AlertTriangle,
  Bold,
  Italic,
  GripVertical
} from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { SyncErrorDetails } from '@/components/admin/SyncErrorDetails';
import { LeaderDetailDialog } from '@/components/admin/LeaderDetailDialog';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Leader = Tables<'leaders'>;
type LeaderContent = Tables<'leader_content'>;
type UserRole = Tables<'user_roles'>;
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

const availableColors = [
  { value: 'default', label: 'Standard', class: 'bg-muted' },
  { value: 'green', label: 'Grønn', class: 'bg-emerald-500' },
  { value: 'yellow', label: 'Gul', class: 'bg-amber-500' },
  { value: 'blue', label: 'Blå', class: 'bg-blue-500' },
  { value: 'red', label: 'Rød', class: 'bg-red-500' },
  { value: 'purple', label: 'Lilla', class: 'bg-purple-500' },
  { value: 'orange', label: 'Oransje', class: 'bg-orange-500' },
];

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
  { value: 'alert-triangle', label: 'OBS', icon: AlertTriangle },
  { value: 'calendar', label: 'Kalender', icon: Calendar },
];

// Sortable item component for drag-and-drop
interface SortableItemProps {
  id: string;
  children: React.ReactNode;
}

function SortableItem({ id, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 999 : undefined,
    position: isDragging ? 'relative' as const : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-4 p-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

export default function Admin() {
  const { isAdmin } = useAuth();
  const [leaders, setLeaders] = useState<LeaderWithRole[]>([]);
  const [leaderRoles, setLeaderRoles] = useState<Map<string, AppRole>>(new Map());
  const [selectedLeader, setSelectedLeader] = useState<Leader | null>(null);
  const [editingLeader, setEditingLeader] = useState<LeaderWithRole | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [leaderContent, setLeaderContent] = useState<Partial<LeaderContent>>({});
  const [homeConfig, setHomeConfig] = useState<HomeScreenConfig[]>([]);
  const [localHomeConfig, setLocalHomeConfig] = useState<HomeScreenConfig[]>([]);
  const [extraFieldsConfig, setExtraFieldsConfig] = useState<ExtraFieldConfig[]>([]);
  const [localExtraConfig, setLocalExtraConfig] = useState<ExtraFieldConfig[]>([]);
  const [hasUnsavedConfigChanges, setHasUnsavedConfigChanges] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSyncInstructions, setShowSyncInstructions] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [leaderSearch, setLeaderSearch] = useState('');
  
  // New leader form
  const [newLeaderName, setNewLeaderName] = useState('');
  const [newLeaderPhone, setNewLeaderPhone] = useState('');
  const [newLeaderIsAdmin, setNewLeaderIsAdmin] = useState(false);

  // Session activities text (single textarea)
  const [sessionActivitiesText, setSessionActivitiesText] = useState('');
  const [isSavingActivities, setIsSavingActivities] = useState(false);

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

  useEffect(() => {
    loadData();
    loadWebhookUrl();
    loadLastSyncTime();
    loadSessionActivitiesText();
  }, []);

  const loadSessionActivitiesText = async () => {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'session_activities_text')
      .maybeSingle();
    
    if (data?.value) {
      setSessionActivitiesText(data.value);
    }
  };

  const saveSessionActivitiesText = async () => {
    setIsSavingActivities(true);
    try {
      const { error } = await supabase
        .from('app_config')
        .upsert({ 
          key: 'session_activities_text', 
          value: sessionActivitiesText, 
          updated_at: new Date().toISOString() 
        }, { onConflict: 'key' });
      
      if (error) throw error;
      toast.success('Aktiviteter lagret!');
    } catch (error) {
      console.error('Error saving activities text:', error);
      toast.error('Kunne ikke lagre aktiviteter');
    } finally {
      setIsSavingActivities(false);
    }
  };

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
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all

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
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all

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
      const [leadersRes, rolesRes, configRes, extraConfigRes] = await Promise.all([
        supabase.from('leaders').select('*').order('name'),
        supabase.from('user_roles').select('*'),
        supabase.from('home_screen_config').select('*').order('sort_order'),
        supabase.from('extra_fields_config').select('*').order('sort_order'),
      ]);

      // Create role map
      const roleMap = new Map<string, AppRole>();
      (rolesRes.data || []).forEach((r: UserRole) => {
        roleMap.set(r.leader_id, r.role as AppRole);
      });
      setLeaderRoles(roleMap);

      // Combine leaders with roles
      const leadersWithRoles: LeaderWithRole[] = (leadersRes.data || []).map((leader) => ({
        ...leader,
        role: roleMap.get(leader.id) || 'leader',
      }));

      setLeaders(leadersWithRoles);
      const homeConfigData = configRes.data || [];
      const extraConfigData = (extraConfigRes.data || []) as ExtraFieldConfig[];
      setHomeConfig(homeConfigData);
      setLocalHomeConfig(homeConfigData);
      setExtraFieldsConfig(extraConfigData);
      setLocalExtraConfig(extraConfigData);
      setHasUnsavedConfigChanges(false);
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

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setLocalHomeConfig((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Update sort_order based on new position
        return newItems.map((item, index) => ({
          ...item,
          sort_order: index
        }));
      });
      setHasUnsavedConfigChanges(true);
    }
  };

  // Default home config values for reset functionality
  const DEFAULT_HOME_CONFIG: Record<string, {
    title: string;
    icon: string;
    bg_color: string;
    text_size: string;
    is_bold: boolean;
    is_italic: boolean;
    is_visible: boolean;
    sort_order: number;
  }> = {
    current_activity: { title: 'Denne økten skal du:', icon: 'activity', bg_color: 'green', text_size: 'lg', is_bold: false, is_italic: false, is_visible: true, sort_order: 0 },
    extra_activity: { title: 'Ekstra aktivitet', icon: 'plus', bg_color: 'default', text_size: 'sm', is_bold: false, is_italic: false, is_visible: true, sort_order: 1 },
    personal_notes: { title: 'Notater til deg', icon: 'message', bg_color: 'blue', text_size: 'md', is_bold: false, is_italic: false, is_visible: true, sort_order: 2 },
    obs_message: { title: 'OBS', icon: 'alert-triangle', bg_color: 'yellow', text_size: 'sm', is_bold: false, is_italic: false, is_visible: true, sort_order: 3 },
    session_activities: { title: 'Aktiviteter denne økten', icon: 'calendar', bg_color: 'default', text_size: 'md', is_bold: false, is_italic: false, is_visible: true, sort_order: 4 },
    extra_1: { title: 'Ekstra 1', icon: 'info', bg_color: 'default', text_size: 'md', is_bold: false, is_italic: false, is_visible: true, sort_order: 5 },
    extra_2: { title: 'Ekstra 2', icon: 'info', bg_color: 'default', text_size: 'md', is_bold: false, is_italic: false, is_visible: true, sort_order: 6 },
    extra_3: { title: 'Ekstra 3', icon: 'info', bg_color: 'default', text_size: 'md', is_bold: false, is_italic: false, is_visible: true, sort_order: 7 },
    extra_4: { title: 'Ekstra 4', icon: 'info', bg_color: 'default', text_size: 'md', is_bold: false, is_italic: false, is_visible: true, sort_order: 8 },
    extra_5: { title: 'Ekstra 5', icon: 'info', bg_color: 'default', text_size: 'md', is_bold: false, is_italic: false, is_visible: true, sort_order: 9 },
  };

  // Reset home config to default values
  const resetHomeConfig = () => {
    const resetConfig = localHomeConfig.map(cfg => {
      const defaults = DEFAULT_HOME_CONFIG[cfg.element_key];
      if (defaults) {
        return {
          ...cfg,
          title: defaults.title,
          icon: defaults.icon,
          bg_color: defaults.bg_color,
          text_size: defaults.text_size,
          is_bold: defaults.is_bold,
          is_italic: defaults.is_italic,
          is_visible: defaults.is_visible,
          sort_order: defaults.sort_order,
        };
      }
      return cfg;
    });
    
    // Sort by sort_order
    resetConfig.sort((a, b) => a.sort_order - b.sort_order);
    
    setLocalHomeConfig(resetConfig);
    setHasUnsavedConfigChanges(true);
    toast.info('Konfigurasjon tilbakestilt til standard. Klikk "Lagre endringer" for å bekrefte.');
  };

  // Local state updates for home config (without saving to DB)
  const updateLocalHomeConfig = (configId: string, updates: Partial<HomeScreenConfig>) => {
    setLocalHomeConfig(prev => prev.map(cfg => 
      cfg.id === configId ? { ...cfg, ...updates } : cfg
    ));
    setHasUnsavedConfigChanges(true);
  };

  // Local state updates for extra field config (without saving to DB)
  const updateLocalExtraConfig = (fieldId: string, updates: Partial<ExtraFieldConfig>) => {
    setLocalExtraConfig(prev => prev.map(cfg => 
      cfg.id === fieldId ? { ...cfg, ...updates } : cfg
    ));
    setHasUnsavedConfigChanges(true);
  };

  // Save all config changes to database
  const saveAllConfigChanges = async () => {
    setIsSavingConfig(true);
    try {
      // Update home screen config
      for (const cfg of localHomeConfig) {
        const original = homeConfig.find(c => c.id === cfg.id);
        if (original && (
          original.title !== cfg.title || 
          original.icon !== cfg.icon || 
          original.is_visible !== cfg.is_visible ||
          original.bg_color !== cfg.bg_color ||
          original.text_size !== cfg.text_size ||
          original.is_bold !== cfg.is_bold ||
          original.is_italic !== cfg.is_italic ||
          original.sort_order !== cfg.sort_order
        )) {
          await supabase
            .from('home_screen_config')
            .update({ 
              title: cfg.title, 
              icon: cfg.icon, 
              is_visible: cfg.is_visible,
              bg_color: cfg.bg_color,
              text_size: cfg.text_size,
              is_bold: cfg.is_bold,
              is_italic: cfg.is_italic,
              sort_order: cfg.sort_order
            })
            .eq('id', cfg.id);
        }
      }

      // Update extra fields config
      for (const cfg of localExtraConfig) {
        const original = extraFieldsConfig.find(c => c.id === cfg.id);
        if (original && (
          original.title !== cfg.title || 
          original.icon !== cfg.icon || 
          original.is_visible !== cfg.is_visible
        )) {
          await supabase
            .from('extra_fields_config')
            .update({ title: cfg.title, icon: cfg.icon, is_visible: cfg.is_visible })
            .eq('id', cfg.id);
        }
      }

      setHasUnsavedConfigChanges(false);
      await loadData();
      toast.success('Konfigurasjon lagret!');
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Kunne ikke lagre konfigurasjon');
    } finally {
      setIsSavingConfig(false);
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
            Admin
          </h1>
          <p className="text-muted-foreground mt-1">
            Administrer ledere, aktiviteter og innhold
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            onClick={triggerSync}
            disabled={isSyncing}
            variant={lastSyncSuccess ? "default" : "outline"}
            className={lastSyncSuccess ? "bg-green-600 hover:bg-green-700" : ""}
          >
            {isSyncing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : lastSyncSuccess ? (
              <Check className="h-4 w-4" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {isSyncing ? "Synkroniserer..." : lastSyncSuccess ? "Synket!" : "Synk ledere"}
          </Button>
          {syncError ? (
            <span className="text-xs text-destructive">Feil ved synk</span>
          ) : lastSyncTime && (
            <span className="text-xs text-muted-foreground">
              Sist synket: {formatSyncTime(lastSyncTime)}
            </span>
          )}
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="dashboard" className="gap-2">
            <Home className="w-4 h-4 hidden sm:block" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="setup" className="gap-2">
            <Settings className="w-4 h-4 hidden sm:block" />
            Oppsett
          </TabsTrigger>
          <TabsTrigger value="sync" className="gap-2">
            <RefreshCw className="w-4 h-4 hidden sm:block" />
            Synk
          </TabsTrigger>
          <TabsTrigger value="leaders" className="gap-2">
            <Users className="w-4 h-4 hidden sm:block" />
            Ledere
          </TabsTrigger>
        </TabsList>

        {/* Admin Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-4">
          {/* Leader Content */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Leader list */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Velg leder</CardTitle>
                <CardDescription>Klikk for å redigere innhold</CardDescription>
              </CardHeader>
              <CardContent>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {leaders.filter(l => l.is_active !== false && l.phone !== '12345678').map((leader) => (
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

          {/* Session Activities Text - moved here after leader selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Aktiviteter denne økten
              </CardTitle>
              <CardDescription>
                Skriv tekst som vises på hjemskjermen til alle ledere under "Aktiviteter denne økten"
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Skriv aktiviteter for denne økten her...&#10;&#10;Eksempel:&#10;• 09:00 - Frokost&#10;• 10:00 - Morgensamling&#10;• 11:00 - Aktiviteter"
                value={sessionActivitiesText}
                onChange={(e) => setSessionActivitiesText(e.target.value)}
                className="min-h-[150px]"
              />
              <Button onClick={saveSessionActivitiesText} disabled={isSavingActivities}>
                {isSavingActivities ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Lagre aktiviteter
              </Button>
            </CardContent>
          </Card>

          {/* Home screen config */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Hjemskjerm-elementer
                  </CardTitle>
                  <CardDescription>
                    Konfigurer tittel, ikon og synlighet for hvert element på hjemskjermen
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetHomeConfig}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Tilbakestill til standard
                  </Button>
                  {hasUnsavedConfigChanges && (
                    <Button onClick={saveAllConfigChanges} disabled={isSavingConfig}>
                      {isSavingConfig ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Lagre endringer
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={localHomeConfig.map(cfg => cfg.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {localHomeConfig.map((cfg) => {
                      const currentIcon = availableIcons.find(i => i.value === cfg.icon) || availableIcons[0];
                      const IconComponent = currentIcon.icon;
                      
                      return (
                        <SortableItem key={cfg.id} id={cfg.id}>
                          <div className="p-4 rounded-lg bg-muted/50 space-y-4">
                            {/* Row 1: Toggle, icon, badge */}
                            <div className="flex items-center gap-3">
                              <Switch
                                checked={cfg.is_visible || false}
                                onCheckedChange={(checked) => 
                                  updateLocalHomeConfig(cfg.id, { is_visible: checked })
                                }
                              />
                              <div className="flex items-center gap-2">
                                <IconComponent className="w-4 h-4 text-muted-foreground" />
                                <Badge variant="outline">{cfg.label}</Badge>
                              </div>
                            </div>
                            
                            {/* Row 2: Title and icon selector */}
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Input
                                placeholder="Tittel"
                                value={cfg.title || ''}
                                onChange={(e) => 
                                  updateLocalHomeConfig(cfg.id, { title: e.target.value })
                                }
                                className="flex-1"
                              />
                              
                              <Select
                                value={cfg.icon || 'info'}
                                onValueChange={(value) => 
                                  updateLocalHomeConfig(cfg.id, { icon: value })
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
                            
                            {/* Row 3: Color picker */}
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground min-w-[50px]">Farge:</span>
                              <div className="flex gap-1.5">
                                {availableColors.map((color) => (
                                  <button
                                    key={color.value}
                                    type="button"
                                    onClick={() => updateLocalHomeConfig(cfg.id, { bg_color: color.value })}
                                    className={`w-6 h-6 rounded-full ${color.class} border-2 transition-all ${
                                      (cfg.bg_color || 'default') === color.value 
                                        ? 'border-foreground scale-110' 
                                        : 'border-transparent hover:scale-105'
                                    }`}
                                    title={color.label}
                                  />
                                ))}
                              </div>
                            </div>
                            
                            {/* Row 4: Text size and bold/italic */}
                            <div className="flex flex-wrap items-center gap-4">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Størrelse:</span>
                                <ToggleGroup 
                                  type="single" 
                                  value={cfg.text_size || 'md'}
                                  onValueChange={(value) => {
                                    if (value) updateLocalHomeConfig(cfg.id, { text_size: value });
                                  }}
                                  className="bg-background rounded-md"
                                >
                                  <ToggleGroupItem value="sm" size="sm" className="text-xs px-2">S</ToggleGroupItem>
                                  <ToggleGroupItem value="md" size="sm" className="text-xs px-2">M</ToggleGroupItem>
                                  <ToggleGroupItem value="lg" size="sm" className="text-xs px-2">L</ToggleGroupItem>
                                </ToggleGroup>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Stil:</span>
                                <ToggleGroup 
                                  type="multiple" 
                                  value={[
                                    ...(cfg.is_bold ? ['bold'] : []),
                                    ...(cfg.is_italic ? ['italic'] : [])
                                  ]}
                                  onValueChange={(values) => {
                                    updateLocalHomeConfig(cfg.id, { 
                                      is_bold: values.includes('bold'),
                                      is_italic: values.includes('italic')
                                    });
                                  }}
                                  className="bg-background rounded-md"
                                >
                                  <ToggleGroupItem value="bold" size="sm" className="px-2">
                                    <Bold className="w-3.5 h-3.5" />
                                  </ToggleGroupItem>
                                  <ToggleGroupItem value="italic" size="sm" className="px-2">
                                    <Italic className="w-3.5 h-3.5" />
                                  </ToggleGroupItem>
                                </ToggleGroup>
                              </div>
                            </div>
                          </div>
                        </SortableItem>
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
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
                        <td className="py-2 px-3 text-muted-foreground">Konfigurerbare ekstra-felt</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Ekstra-felter konfigurasjon
                  </CardTitle>
                  <CardDescription>
                    Konfigurer tittel og ikon for ekstra-feltene fra Google Sheet
                  </CardDescription>
                </div>
                {hasUnsavedConfigChanges && (
                  <Button onClick={saveAllConfigChanges} disabled={isSavingConfig}>
                    {isSavingConfig ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Lagre endringer
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {localExtraConfig.map((field) => (
                  <div
                    key={field.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Switch
                        checked={field.is_visible}
                        onCheckedChange={(checked) => 
                          updateLocalExtraConfig(field.id, { is_visible: checked })
                        }
                      />
                      <Badge variant="outline">{field.field_key.replace('_', ' #')}</Badge>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <Input
                        placeholder="Tittel"
                        value={field.title}
                        onChange={(e) => 
                          updateLocalExtraConfig(field.id, { title: e.target.value })
                        }
                        className="w-full sm:w-40"
                      />
                      
                      <Select
                        value={field.icon}
                        onValueChange={(value) => 
                          updateLocalExtraConfig(field.id, { icon: value })
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

              <div className="flex flex-wrap gap-2">
                <Button 
                  onClick={triggerSync} 
                  disabled={isSyncing || !storedWebhookUrl}
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

                <Button 
                  variant="outline" 
                  onClick={deactivateAllLeaders}
                  disabled={isDeactivating}
                >
                  {isDeactivating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Reset periode
                </Button>
              </div>

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
                    <p className="text-sm font-medium">Komplett JSON-format for HTTP Request body:</p>
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

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Endpoint:</p>
                    <code className="block text-xs bg-background p-2 rounded break-all">
                      POST https://noxnbtvxksgjsqzfdgcd.supabase.co/functions/v1/sync-leaders-import
                    </code>
                  </div>

                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                      <strong>n8n Tips:</strong> Bruk bracket-notation <code className="bg-background px-1 rounded">$json['kolonne']</code> for kolonner med mellomrom eller spesialtegn (f.eks. "Hytte Ansvar", "OBS!", "Ekstra #1").
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Viktig:</p>
                    <ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
                      <li><strong>phone</strong> og <strong>name</strong> er påkrevd for nye ledere</li>
                      <li>Telefonnummer brukes som unik nøkkel for matching</li>
                      <li>Eksisterende ledere oppdateres, nye opprettes automatisk</li>
                      <li>Alle innholdsfelt (Aktivitet, Notater, OBS!, Ekstra) er valgfrie</li>
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Leader Overview in Sync Tab */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Leder-oversikt ({leaders.filter(l => l.phone !== '12345678').length})
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
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">Status</th>
                      <th className="text-left py-2 px-3 font-medium">Navn</th>
                      <th className="text-left py-2 px-3 font-medium">Rolle</th>
                      <th className="text-left py-2 px-3 font-medium">Telefon</th>
                      <th className="text-left py-2 px-3 font-medium hidden sm:table-cell">Team</th>
                      <th className="text-left py-2 px-3 font-medium hidden md:table-cell">Hytte</th>
                      <th className="text-left py-2 px-3 font-medium hidden lg:table-cell">Ministerpost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {leaders.filter(l => l.phone !== '12345678').map((leader) => (
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
                        <td className="py-2 px-3 text-muted-foreground hidden sm:table-cell">
                          {leader.team || '-'}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground hidden md:table-cell">
                          {leader.cabin_info || leader.cabin || '-'}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground hidden lg:table-cell">
                          {leader.ministerpost || '-'}
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
              <CardTitle>Alle ledere ({leaders.filter(l => l.phone !== '12345678').length})</CardTitle>
              <CardDescription>
                Klikk på en leder for å redigere profil og rolle
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Søk etter leder..."
                  value={leaderSearch}
                  onChange={(e) => setLeaderSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="space-y-2">
                {leaders
                  .filter((leader) =>
                    leader.phone !== '12345678' &&
                    (leader.name.toLowerCase().includes(leaderSearch.toLowerCase()) ||
                    leader.phone.includes(leaderSearch))
                  )
                  .map((leader) => (
                  <div
                    key={leader.id}
                    onClick={() => {
                      setEditingLeader(leader);
                      setIsEditDialogOpen(true);
                    }}
                    className={`flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors ${leader.is_active === false ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{leader.name}</p>
                          {leader.is_active === false && (
                            <Badge variant="outline" className="text-xs">Inaktiv</Badge>
                          )}
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
                        </div>
                        <p className="text-sm text-muted-foreground">{leader.phone}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {leaders.filter(l => l.phone !== '12345678').length === 0 && (
                  <p className="text-muted-foreground text-center py-4">
                    Ingen ledere registrert enda
                  </p>
                )}
              </div>
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
