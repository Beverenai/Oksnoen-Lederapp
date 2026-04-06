import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ChevronDown, ChevronUp, Save, Phone, AlertTriangle, Loader2, Pencil, Bell, Send, Car, Anchor, Mountain, ArrowDown, Cable, Wrench, Check, Home, Trash2 } from 'lucide-react';
import { icons } from 'lucide-react';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { hapticSuccess, hapticError, hapticImpact } from '@/lib/capacitorHaptics';
type Leader = Tables<'leaders'>;
type LeaderContent = Tables<'leader_content'>;

type HomeScreenConfigItem = {
  id: string;
  element_key: string;
  label: string;
  title: string | null;
  icon: string | null;
  is_visible: boolean | null;
  sort_order: number | null;
};

interface LeaderWithContent extends Leader {
  content?: LeaderContent | null;
}

interface LeaderContentSheetProps {
  leader: LeaderWithContent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  homeConfig: HomeScreenConfigItem[];
  onSaved: () => void;
}

const TEAM_OPTIONS = ['1', '2', '1F', '2F', 'Kjøkken', 'Sjef', 'Kordinator'];

// Team color mapping - supports both short (1, 2f) and long (Team 1, Team 2F) formats
const getTeamStyles = (team: string | null): string => {
  const teamLower = team?.toLowerCase().trim();
  switch (teamLower) {
    case '1':
    case 'team 1':
      return 'bg-red-500 text-white border-red-500';
    case '2':
    case 'team 2':
      return 'bg-orange-500 text-white border-orange-500';
    case '1f':
    case 'team 1f':
      return 'bg-yellow-400 text-black border-yellow-400';
    case '2f':
    case 'team 2f':
      return 'bg-blue-500 text-white border-blue-500';
    case 'kjøkken':
      return 'bg-purple-500 text-white border-purple-500';
    case 'sjef':
      return 'bg-slate-600 text-white border-slate-600';
    case 'kordinator':
      return 'bg-pink-500 text-white border-pink-500';
    case 'nurse':
      return 'bg-rose-600 text-white border-rose-600';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

const getFirstName = (fullName: string) => fullName.split(' ')[0];

export function LeaderContentSheet({
  leader,
  open,
  onOpenChange,
  homeConfig,
  onSaved
}: LeaderContentSheetProps) {
  const { leader: currentLeader } = useAuth();
  const [saving, setSaving] = useState(false);
  const [isExtraFieldsOpen, setIsExtraFieldsOpen] = useState(false);
  const [editingField, setEditingField] = useState<'team' | 'cabin' | 'ministerpost' | null>(null);
  const [isSendingNotification, setIsSendingNotification] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');

  // Change notification dialog state
  const [showNotifyDialog, setShowNotifyDialog] = useState(false);
  const [detectedChanges, setDetectedChanges] = useState<string[]>([]);
  const [isSendingChangeNotification, setIsSendingChangeNotification] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  // Store original values to detect changes
  const originalValuesRef = useRef<Record<string, any>>({});

  // Cabin multi-select state
  const [cabins, setCabins] = useState<{ id: string; name: string }[]>([]);
  const [selectedCabinIds, setSelectedCabinIds] = useState<string[]>([]);
  const [cabinSearch, setCabinSearch] = useState('');

  // Leader fields
  const [team, setTeam] = useState(leader?.team || '');
  const [ministerpost, setMinisterpost] = useState(leader?.ministerpost || '');

  // Content fields
  const [currentActivity, setCurrentActivity] = useState('');
  const [extraActivity, setExtraActivity] = useState('');
  const [personalNotes, setPersonalNotes] = useState('');
  const [obsMessage, setObsMessage] = useState('');
  const [extra1, setExtra1] = useState('');
  const [extra2, setExtra2] = useState('');
  const [extra3, setExtra3] = useState('');
  const [extra4, setExtra4] = useState('');
  const [extra5, setExtra5] = useState('');

  // Load all cabins once
  useEffect(() => {
    const loadCabins = async () => {
      const { data } = await supabase
        .from('cabins')
        .select('id, name')
        .order('sort_order', { ascending: true });
      setCabins(data || []);
    };
    loadCabins();
  }, []);

  // Load leader's existing cabin links when leader changes
  useEffect(() => {
    const loadLeaderCabins = async () => {
      if (!leader) return;
      const { data } = await supabase
        .from('leader_cabins')
        .select('cabin_id')
        .eq('leader_id', leader.id);
      const cabinIds = data?.map(d => d.cabin_id) || [];
      setSelectedCabinIds(cabinIds);
      // Store original cabin IDs
      originalValuesRef.current.selectedCabinIds = cabinIds;
    };
    loadLeaderCabins();
  }, [leader?.id]);

  // Reset form when leader changes
  useEffect(() => {
    if (leader) {
      setTeam(leader.team || '');
      setMinisterpost(leader.ministerpost || '');

      const content = leader.content;
      setCurrentActivity(content?.current_activity || '');
      setExtraActivity(content?.extra_activity || '');
      setPersonalNotes(content?.personal_notes || '');
      setObsMessage(content?.obs_message || '');
      setExtra1(content?.extra_1 || '');
      setExtra2(content?.extra_2 || '');
      setExtra3(content?.extra_3 || '');
      setExtra4(content?.extra_4 || '');
      setExtra5(content?.extra_5 || '');
      
      // Store original values for change detection
      originalValuesRef.current = {
        team: leader.team || '',
        ministerpost: leader.ministerpost || '',
        currentActivity: content?.current_activity || '',
        extraActivity: content?.extra_activity || '',
        personalNotes: content?.personal_notes || '',
        obsMessage: content?.obs_message || '',
        extra1: content?.extra_1 || '',
        extra2: content?.extra_2 || '',
        extra3: content?.extra_3 || '',
        extra4: content?.extra_4 || '',
        extra5: content?.extra_5 || '',
      };
      
      // Reset notification state
      setNotificationTitle('');
      setNotificationMessage('');
    }
    // Reset editing state when leader changes
    setEditingField(null);
    setCabinSearch('');
  }, [leader]);

  const toggleCabin = (cabinId: string) => {
    setSelectedCabinIds(prev =>
      prev.includes(cabinId)
        ? prev.filter(id => id !== cabinId)
        : [...prev, cabinId]
    );
  };

  // Get changes for notification
  const getChanges = (): string[] => {
    const changes: string[] = [];
    const orig = originalValuesRef.current;
    
    if (currentActivity !== orig.currentActivity && currentActivity) {
      changes.push(`Ny aktivitet: "${currentActivity}"`);
    }
    if (extraActivity !== orig.extraActivity && extraActivity) {
      changes.push(`Ny ekstra aktivitet: "${extraActivity}"`);
    }
    if (team !== orig.team && team) {
      changes.push(`Nytt team: ${team}`);
    }
    if (ministerpost !== orig.ministerpost && ministerpost) {
      changes.push(`Ny ministerpost: "${ministerpost}"`);
    }
    if (obsMessage !== orig.obsMessage && obsMessage) {
      changes.push(`Ny OBS-melding fra admin`);
    }
    if (personalNotes !== orig.personalNotes && personalNotes) {
      changes.push(`Nye notater`);
    }
    
    // Check cabin changes
    const origCabinIds = orig.selectedCabinIds || [];
    const cabinIdsChanged = JSON.stringify([...selectedCabinIds].sort()) !== JSON.stringify([...origCabinIds].sort());
    if (cabinIdsChanged && selectedCabinIds.length > 0) {
      const cabinNames = cabins.filter(c => selectedCabinIds.includes(c.id)).map(c => c.name).join(', ');
      changes.push(`Nytt hytte-ansvar: ${cabinNames}`);
    }
    
    // Check extra fields (only show if there's actual new content)
    if (extra1 !== orig.extra1 && extra1) {
      const fieldConfig = homeConfig.find(c => c.element_key === 'extra_1');
      changes.push(`Ny info: ${fieldConfig?.title || 'Ekstra 1'}`);
    }
    if (extra2 !== orig.extra2 && extra2) {
      const fieldConfig = homeConfig.find(c => c.element_key === 'extra_2');
      changes.push(`Ny info: ${fieldConfig?.title || 'Ekstra 2'}`);
    }
    if (extra3 !== orig.extra3 && extra3) {
      const fieldConfig = homeConfig.find(c => c.element_key === 'extra_3');
      changes.push(`Ny info: ${fieldConfig?.title || 'Ekstra 3'}`);
    }
    if (extra4 !== orig.extra4 && extra4) {
      const fieldConfig = homeConfig.find(c => c.element_key === 'extra_4');
      changes.push(`Ny info: ${fieldConfig?.title || 'Ekstra 4'}`);
    }
    if (extra5 !== orig.extra5 && extra5) {
      const fieldConfig = homeConfig.find(c => c.element_key === 'extra_5');
      changes.push(`Ny info: ${fieldConfig?.title || 'Ekstra 5'}`);
    }
    
    return changes;
  };

  const handleSendChangeNotification = async () => {
    if (!leader || !currentLeader) return;
    
    setIsSendingChangeNotification(true);
    try {
      const firstName = getFirstName(leader.name);
      const changesText = detectedChanges.map(c => `• ${c}`).join('\n');
      
      const { data, error } = await supabase.functions.invoke('push-send', {
        body: {
          title: `Hei ${firstName}! Du har fått oppdateringer`,
          message: changesText,
          single_leader_id: leader.id,
          sender_leader_id: currentLeader.id,
          url: '/'
        }
      });
      
      if (error) throw error;
      
      if (data?.sent > 0) {
        hapticSuccess();
        toast.success('Varsling sendt!');
      } else {
        toast.info(`${firstName} har ikke aktivert push-varslinger`);
      }
    } catch (error) {
      console.error('Error sending change notification:', error);
      hapticError();
      toast.error('Kunne ikke sende varsling');
    } finally {
      setIsSendingChangeNotification(false);
      setShowNotifyDialog(false);
      onOpenChange(false);
    }
  };

  const handleSkipNotification = () => {
    setShowNotifyDialog(false);
    onOpenChange(false);
  };

  const handleClearAllFields = () => {
    setTeam('');
    setMinisterpost('');
    setCurrentActivity('');
    setExtraActivity('');
    setPersonalNotes('');
    setObsMessage('');
    setExtra1('');
    setExtra2('');
    setExtra3('');
    setExtra4('');
    setExtra5('');
    setSelectedCabinIds([]);
    setShowClearConfirm(false);
    hapticImpact('medium');
    toast.info('Alle felt tømt — husk å lagre');
  };

  const handleSendNotification = async () => {
    if (!leader || !notificationTitle.trim() || !currentLeader) return;

    hapticImpact('medium');
    setIsSendingNotification(true);
    try {
      const { data, error } = await supabase.functions.invoke('push-send', {
        body: {
          title: notificationTitle,
          message: notificationMessage || 'Du har en ny varsling',
          url: '/',
          single_leader_id: leader.id,
          sender_leader_id: currentLeader.id,
        },
      });

      if (error) throw error;

      if (data?.sent > 0) {
        hapticSuccess();
        toast.success(`Varsling sendt til ${getFirstName(leader.name)}!`);
        setNotificationTitle('');
        setNotificationMessage('');
      } else {
        toast.info(`${getFirstName(leader.name)} har ikke aktivert push-varslinger`);
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      hapticError();
      toast.error('Kunne ikke sende varsling');
    } finally {
      setIsSendingNotification(false);
    }
  };

  if (!leader) return null;

  // Filter home_screen_config to get visible extra fields (extra_1 through extra_5)
  const visibleExtraFields = homeConfig
    .filter(c => /^extra_\d+$/.test(c.element_key) && c.is_visible)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const getExtraFieldValue = (fieldKey: string) => {
    switch (fieldKey) {
      case 'extra_1': return extra1;
      case 'extra_2': return extra2;
      case 'extra_3': return extra3;
      case 'extra_4': return extra4;
      case 'extra_5': return extra5;
      default: return '';
    }
  };

  const setExtraFieldValue = (fieldKey: string, value: string) => {
    switch (fieldKey) {
      case 'extra_1': setExtra1(value); break;
      case 'extra_2': setExtra2(value); break;
      case 'extra_3': setExtra3(value); break;
      case 'extra_4': setExtra4(value); break;
      case 'extra_5': setExtra5(value); break;
    }
  };

  const getIcon = (iconName: string) => {
    const IconComponent = icons[iconName as keyof typeof icons];
    return IconComponent ? <IconComponent className="w-4 h-4" /> : null;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Get selected cabin names for the leaders.cabin field
      const selectedCabinNames = cabins
        .filter(c => selectedCabinIds.includes(c.id))
        .map(c => c.name)
        .join(', ');

      // Update leader info
      const { error: leaderError } = await supabase
        .from('leaders')
        .update({
          team: team || null,
          cabin: selectedCabinNames || null,
          ministerpost: ministerpost || null
        })
        .eq('id', leader.id);

      if (leaderError) throw leaderError;

      // Update leader_cabins table - delete existing and insert new
      const { error: deleteError } = await supabase
        .from('leader_cabins')
        .delete()
        .eq('leader_id', leader.id);

      if (deleteError) throw deleteError;

      if (selectedCabinIds.length > 0) {
        const { error: insertError } = await supabase
          .from('leader_cabins')
          .insert(
            selectedCabinIds.map(cabinId => ({
              leader_id: leader.id,
              cabin_id: cabinId
            }))
          );

        if (insertError) throw insertError;
      }

      // Upsert content
      const contentData = {
        leader_id: leader.id,
        current_activity: currentActivity || null,
        extra_activity: extraActivity || null,
        personal_notes: personalNotes || null,
        obs_message: obsMessage || null,
        extra_1: extra1 || null,
        extra_2: extra2 || null,
        extra_3: extra3 || null,
        extra_4: extra4 || null,
        extra_5: extra5 || null,
        has_read: false, // Reset when content is changed
        updated_at: new Date().toISOString()
      };

      const { error: contentError } = await supabase
        .from('leader_content')
        .upsert(contentData, { onConflict: 'leader_id' });

      if (contentError) throw contentError;

      hapticSuccess();
      toast.success('Lagret!');
      onSaved();
      
      // Check for changes and show notification dialog
      const changes = getChanges();
      if (changes.length > 0) {
        setDetectedChanges(changes);
        setShowNotifyDialog(true);
      } else {
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error saving:', error);
      hapticError();
      toast.error('Kunne ikke lagre');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="pb-4">
            <div className="flex items-start gap-4">
              <Avatar className="w-16 h-16 border-2 border-primary/20">
                {leader.profile_image_url && (
                  <AvatarImage src={leader.profile_image_url} alt={leader.name} />
                )}
                <AvatarFallback className="bg-primary/10 text-primary text-lg">
                  {getFirstName(leader.name).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <SheetTitle className="text-xl">{leader.name}</SheetTitle>
                <Button asChild variant="link" className="h-auto p-0 text-sm">
                  <a href={`tel:${leader.phone}`}>
                    <Phone className="w-3 h-3 mr-1" />
                    {leader.phone}
                  </a>
                </Button>
              </div>
            </div>
          </SheetHeader>

          <div className="space-y-6">
            {/* Clickable badges for team, cabin, ministerpost */}
            <div className="flex flex-wrap gap-2">
              {/* Team Badge */}
              <Popover open={editingField === 'team'} onOpenChange={(open) => setEditingField(open ? 'team' : null)}>
                <PopoverTrigger asChild>
                  <button type="button" className="focus:outline-none">
                    <Badge 
                      className={`cursor-pointer hover:opacity-80 transition-opacity ${team ? getTeamStyles(team) : 'bg-muted text-muted-foreground'}`}
                    >
                      {team || 'Velg team'}
                      <Pencil className="w-3 h-3 ml-1" />
                    </Badge>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2 bg-popover z-[100]" align="start" side="bottom" sideOffset={4}>
                  <div className="space-y-1">
                    <button
                      className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted"
                      onClick={() => { setTeam(''); setEditingField(null); }}
                    >
                      Ingen
                    </button>
                    {TEAM_OPTIONS.map(t => (
                      <button
                        key={t}
                        className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted flex items-center gap-2"
                        onClick={() => { setTeam(t); setEditingField(null); }}
                      >
                        <Badge className={`${getTeamStyles(t)} text-xs`}>{t}</Badge>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Cabin Badge - with searchable multi-select dropdown */}
              <Popover open={editingField === 'cabin'} onOpenChange={(open) => {
                setEditingField(open ? 'cabin' : null);
                if (!open) setCabinSearch('');
              }}>
                <PopoverTrigger asChild>
                  <button type="button" className="focus:outline-none">
                    <Badge 
                      variant="outline"
                      className="cursor-pointer hover:opacity-80 transition-opacity max-w-[200px] truncate"
                    >
                      <Home className="w-3 h-3 mr-1 flex-shrink-0" />
                      {selectedCabinIds.length > 0 
                        ? cabins.filter(c => selectedCabinIds.includes(c.id)).map(c => c.name).join(', ')
                        : 'Hytte-ansvar'}
                      <Pencil className="w-3 h-3 ml-1 flex-shrink-0" />
                    </Badge>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0 bg-popover z-[100]" align="start" side="bottom" sideOffset={4}>
                  <Command shouldFilter={false}>
                    <CommandInput 
                      placeholder="Søk etter hytte..." 
                      value={cabinSearch}
                      onValueChange={setCabinSearch}
                    />
                    <CommandList>
                      <CommandEmpty>Ingen hytter funnet</CommandEmpty>
                      <CommandGroup>
                        <ScrollArea className="h-60">
                          {cabins
                            .filter(c => c.name.toLowerCase().includes(cabinSearch.toLowerCase()))
                            .map(cabin => (
                              <CommandItem
                                key={cabin.id}
                                onSelect={() => toggleCabin(cabin.id)}
                                className="cursor-pointer"
                              >
                                <Check 
                                  className={`mr-2 h-4 w-4 ${
                                    selectedCabinIds.includes(cabin.id) ? 'opacity-100' : 'opacity-0'
                                  }`}
                                />
                                <Home className="mr-2 h-4 w-4 text-muted-foreground" />
                                {cabin.name}
                              </CommandItem>
                            ))}
                        </ScrollArea>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                  <div className="p-2 border-t">
                    <Button size="sm" onClick={() => setEditingField(null)} className="w-full">
                      Ferdig
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Ministerpost Badge */}
              <Popover open={editingField === 'ministerpost'} onOpenChange={(open) => setEditingField(open ? 'ministerpost' : null)}>
                <PopoverTrigger asChild>
                  <button type="button" className="focus:outline-none">
                    <Badge 
                      variant="secondary"
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      {ministerpost || 'Ministerpost'}
                      <Pencil className="w-3 h-3 ml-1" />
                    </Badge>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3 bg-popover z-[100]" align="start" side="bottom" sideOffset={4}>
                  <div className="space-y-2">
                    <Label className="text-xs">Ministerpost</Label>
                    <Input
                      value={ministerpost}
                      onChange={(e) => setMinisterpost(e.target.value)}
                      placeholder="f.eks. Statsminister"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
                    />
                    <Button size="sm" onClick={() => setEditingField(null)} className="w-full">
                      Ferdig
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Competency Badges */}
            {(leader.has_drivers_license || leader.has_car || leader.has_boat_license || 
              leader.can_rappelling || leader.can_climbing || leader.can_zipline || leader.can_rope_setup) && (
              <div className="flex flex-wrap gap-1.5">
                {leader.has_drivers_license && (
                  <Badge variant="outline" className="text-xs bg-background">
                    <Car className="w-3 h-3 mr-1" />
                    Førerkort
                  </Badge>
                )}
                {leader.has_car && (
                  <Badge variant="outline" className="text-xs bg-green-50 border-green-300 text-green-700">
                    <Car className="w-3 h-3 mr-1" />
                    Har bil
                  </Badge>
                )}
                {leader.has_boat_license && (
                  <Badge variant="outline" className="text-xs bg-blue-50 border-blue-300 text-blue-700">
                    <Anchor className="w-3 h-3 mr-1" />
                    Båt
                  </Badge>
                )}
                {leader.can_rappelling && (
                  <Badge variant="outline" className="text-xs bg-orange-50 border-orange-300 text-orange-700">
                    <ArrowDown className="w-3 h-3 mr-1" />
                    Rappis
                  </Badge>
                )}
                {leader.can_climbing && (
                  <Badge variant="outline" className="text-xs bg-amber-50 border-amber-300 text-amber-700">
                    <Mountain className="w-3 h-3 mr-1" />
                    Klatring
                  </Badge>
                )}
                {leader.can_zipline && (
                  <Badge variant="outline" className="text-xs bg-purple-50 border-purple-300 text-purple-700">
                    <Cable className="w-3 h-3 mr-1" />
                    Taubane
                  </Badge>
                )}
                {leader.can_rope_setup && (
                  <Badge variant="outline" className="text-xs bg-indigo-50 border-indigo-300 text-indigo-700">
                    <Wrench className="w-3 h-3 mr-1" />
                    Taubane-Oppsett
                  </Badge>
                )}
              </div>
            )}

            {/* Current Activity */}
            <div className="space-y-2">
              <Label>Nåværende aktivitet</Label>
              <Input
                value={currentActivity}
                onChange={(e) => setCurrentActivity(e.target.value)}
                placeholder="Hva gjør lederen nå?"
              />
            </div>

            <div className="space-y-2">
              <Label>Ekstra aktivitet</Label>
              <Input
                value={extraActivity}
                onChange={(e) => setExtraActivity(e.target.value)}
                placeholder="Tilleggsinfo om aktivitet"
              />
            </div>

            {/* Personal Notes */}
            <div className="space-y-2">
              <Label>Notater til lederen</Label>
              <Textarea
                value={personalNotes}
                onChange={(e) => setPersonalNotes(e.target.value)}
                placeholder="Private notater..."
                rows={3}
              />
            </div>

            {/* OBS Message */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-4 h-4" />
                OBS-melding
              </Label>
              <Textarea
                value={obsMessage}
                onChange={(e) => setObsMessage(e.target.value)}
                placeholder="Viktig melding som vises fremhevet..."
                rows={2}
                className="border-destructive/50 focus-visible:ring-destructive"
              />
            </div>

            {/* Send notification to this leader */}
            <div className="space-y-2 pt-2 border-t">
              <Label className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Send varsling til {getFirstName(leader.name)}
              </Label>
              <Input
                placeholder="Tittel på varsling..."
                value={notificationTitle}
                onChange={(e) => setNotificationTitle(e.target.value)}
              />
              <Textarea
                placeholder="Melding (valgfritt)..."
                value={notificationMessage}
                onChange={(e) => setNotificationMessage(e.target.value)}
                rows={2}
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSendNotification}
                disabled={isSendingNotification || !notificationTitle.trim()}
              >
                {isSendingNotification ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send varsling
              </Button>
            </div>

            {/* Extra Fields - Collapsible */}
            {visibleExtraFields.length > 0 && (
              <Collapsible open={isExtraFieldsOpen} onOpenChange={setIsExtraFieldsOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between">
                    <span>Ekstra info ({visibleExtraFields.length} felt)</span>
                    {isExtraFieldsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-2">
                  {visibleExtraFields.map(field => (
                    <div key={field.id} className="space-y-2">
                      <Label className="flex items-center gap-2">
                        {getIcon(field.icon || 'info')}
                        {field.title || field.label || field.element_key}
                      </Label>
                      <Textarea
                        value={getExtraFieldValue(field.element_key)}
                        onChange={(e) => setExtraFieldValue(field.element_key, e.target.value)}
                        placeholder={`Skriv ${field.title?.toLowerCase() || 'info'}...`}
                        rows={2}
                      />
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full"
              size="lg"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Lagre endringer
            </Button>
            {/* Safe area spacer for iOS home indicator */}
            <div className="pb-safe" />
          </div>
        </SheetContent>
      </Sheet>

      {/* Change Notification Dialog */}
      <AlertDialog open={showNotifyDialog} onOpenChange={setShowNotifyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sende varsling om endringer?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Vil du varsle {getFirstName(leader.name)} om disse endringene?</p>
                <ul className="text-sm bg-muted p-3 rounded-md space-y-1">
                  {detectedChanges.map((change, i) => (
                    <li key={i} className="text-foreground">{change}</li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleSkipNotification}>
              Nei, hopp over
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleSendChangeNotification}
              disabled={isSendingChangeNotification}
            >
              {isSendingChangeNotification ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Bell className="w-4 h-4 mr-2" />
              )}
              Ja, send varsling
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
