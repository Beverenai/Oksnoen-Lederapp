import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
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
  Save,
  Check,
  AlertTriangle,
  Bold,
  Italic,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Plus
} from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { LeaderDashboard } from '@/components/admin/LeaderDashboard';

import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Leader = Tables<'leaders'>;
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
  const [homeConfig, setHomeConfig] = useState<HomeScreenConfig[]>([]);
  const [localHomeConfig, setLocalHomeConfig] = useState<HomeScreenConfig[]>([]);
  const [extraFieldsConfig, setExtraFieldsConfig] = useState<ExtraFieldConfig[]>([]);
  const [localExtraConfig, setLocalExtraConfig] = useState<ExtraFieldConfig[]>([]);
  const [hasUnsavedConfigChanges, setHasUnsavedConfigChanges] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Session activities text (single textarea)
  const [sessionActivitiesText, setSessionActivitiesText] = useState('');
  const [isSavingActivities, setIsSavingActivities] = useState(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncSuccess, setLastSyncSuccess] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [storedExportWebhookUrl, setStoredExportWebhookUrl] = useState('');
  
  // Auto-export state
  const [pendingExport, setPendingExport] = useState(false);
  const [exportCountdown, setExportCountdown] = useState(0);
  const exportTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Collapsible states for dashboard
  const [isHomeConfigOpen, setIsHomeConfigOpen] = useState(false);

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

  const loadExportWebhookUrl = async () => {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'export_webhook_url')
      .maybeSingle();
    
    if (data?.value) {
      setStoredExportWebhookUrl(data.value);
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

      if (error) {
        console.error('Error calling trigger-export:', error);
        if (!isAutoExport) toast.error('Kunne ikke starte eksport');
        return;
      }

      if (data?.success) {
        toast.success(`Eksport fullført! ${data.leadersExported} ledere sendt til Google Sheets`);
      } else {
        if (!isAutoExport) toast.error(`Eksport feilet: ${data?.error || 'Ukjent feil'}`);
      }
    } catch (error) {
      console.error('Error triggering export:', error);
      if (!isAutoExport) toast.error('Kunne ikke starte eksport');
    }
  }, [storedExportWebhookUrl]);

  const scheduleAutoExport = useCallback(() => {
    if (!storedExportWebhookUrl) return;
    
    if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    
    setPendingExport(true);
    setExportCountdown(30);
    
    countdownIntervalRef.current = setInterval(() => {
      setExportCountdown(prev => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    exportTimerRef.current = setTimeout(() => {
      triggerExport(true);
    }, 30000);
  }, [storedExportWebhookUrl, triggerExport]);

  const triggerSync = async () => {
    setIsSyncing(true);
    setLastSyncSuccess(false);

    try {
      const { data, error } = await supabase.functions.invoke('trigger-sync');

      if (error) {
        console.error('Error calling trigger-sync:', error);
        toast.error('Kunne ikke starte synkronisering');
        return;
      }

      if (data?.success) {
        setLastSyncSuccess(true);
        setLastSyncTime(new Date().toISOString());
        toast.success(`Synkronisering fullført! (Status: ${data.webhookStatus})`);
        loadData();
      } else {
        toast.error(`Synkronisering feilet: ${data?.n8nError || data?.error || 'Ukjent feil'}`);
      }
    } catch (error) {
      console.error('Error triggering sync:', error);
      toast.error('Kunne ikke starte synkronisering');
    } finally {
      setIsSyncing(false);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [leadersRes, rolesRes, configRes, extraConfigRes] = await Promise.all([
        supabase.from('leaders').select('*').order('created_at'),
        supabase.from('user_roles').select('*'),
        supabase.from('home_screen_config').select('*').order('sort_order'),
        supabase.from('extra_fields_config').select('*').order('sort_order'),
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
        
        return newItems.map((item, index) => ({
          ...item,
          sort_order: index
        }));
      });
      setHasUnsavedConfigChanges(true);
    }
  };

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
    
    resetConfig.sort((a, b) => a.sort_order - b.sort_order);
    
    setLocalHomeConfig(resetConfig);
    setHasUnsavedConfigChanges(true);
    toast.info('Konfigurasjon tilbakestilt til standard. Klikk "Lagre endringer" for å bekrefte.');
  };

  const updateLocalHomeConfig = (configId: string, updates: Partial<HomeScreenConfig>) => {
    setLocalHomeConfig(prev => prev.map(cfg => 
      cfg.id === configId ? { ...cfg, ...updates } : cfg
    ));
    setHasUnsavedConfigChanges(true);
  };

  const saveAllConfigChanges = async () => {
    setIsSavingConfig(true);
    try {
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
        <div className="flex flex-col sm:flex-row items-end gap-2">
          <Link to="/admin/settings">
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Innstillinger
            </Button>
          </Link>
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
              <span className="ml-2 hidden sm:inline">
                {isSyncing ? "Synkroniserer..." : lastSyncSuccess ? "Synket!" : "Synk ledere"}
              </span>
            </Button>
            {lastSyncTime && (
              <span className="text-xs text-muted-foreground">
                Sist synket: {formatSyncTime(lastSyncTime)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Participant Stats */}
      

      {/* Leader Dashboard */}
      <LeaderDashboard
        leaders={leaders}
        homeConfig={localHomeConfig}
        onLeaderUpdated={loadData}
        onScheduleAutoExport={scheduleAutoExport}
      />

      {/* Session Activities Text */}
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

      {/* Home screen config - collapsible */}
      <Collapsible open={isHomeConfigOpen} onOpenChange={setIsHomeConfigOpen}>
        <Card>
          <CardHeader>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                <div className="text-left">
                  <CardTitle>Hjemskjerm-elementer</CardTitle>
                  <CardDescription>
                    Konfigurer tittel, ikon og synlighet for hvert element på hjemskjermen
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasUnsavedConfigChanges && (
                  <Badge variant="secondary" className="text-xs">Ulagrede endringer</Badge>
                )}
                {isHomeConfigOpen ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 mb-4">
                <Button
                  onClick={saveAllConfigChanges}
                  disabled={!hasUnsavedConfigChanges || isSavingConfig}
                >
                  {isSavingConfig ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Lagre endringer
                </Button>
                <Button
                  variant="outline"
                  onClick={resetHomeConfig}
                >
                  Tilbakestill til standard
                </Button>
              </div>
              
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
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
