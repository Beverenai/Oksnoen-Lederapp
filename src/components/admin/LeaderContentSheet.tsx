import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, ChevronUp, Save, Phone, AlertTriangle, Loader2, Pencil } from 'lucide-react';
import { icons } from 'lucide-react';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type Leader = Tables<'leaders'>;
type LeaderContent = Tables<'leader_content'>;

type ExtraFieldConfig = {
  id: string;
  field_key: string;
  title: string;
  icon: string;
  is_visible: boolean | null;
  sort_order: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

interface LeaderWithContent extends Leader {
  content?: LeaderContent | null;
}

interface LeaderContentSheetProps {
  leader: LeaderWithContent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extraFieldsConfig: ExtraFieldConfig[];
  onSaved: () => void;
}

const TEAM_OPTIONS = ['Team 1', 'Team 2', 'Team 1F', 'Team 2F', 'Kjøkken', 'Sjef'];

// Team color mapping
const getTeamStyles = (team: string | null): string => {
  const teamLower = team?.toLowerCase().trim();
  switch (teamLower) {
    case 'team 1':
      return 'bg-red-500 text-white border-red-500';
    case 'team 2':
      return 'bg-orange-500 text-white border-orange-500';
    case 'team 1f':
      return 'bg-yellow-400 text-black border-yellow-400';
    case 'team 2f':
      return 'bg-blue-500 text-white border-blue-500';
    case 'kjøkken':
      return 'bg-purple-500 text-white border-purple-500';
    case 'sjef':
      return 'bg-slate-500 text-white border-slate-500';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

const getFirstName = (fullName: string) => fullName.split(' ')[0];

export function LeaderContentSheet({
  leader,
  open,
  onOpenChange,
  extraFieldsConfig,
  onSaved
}: LeaderContentSheetProps) {
  const [saving, setSaving] = useState(false);
  const [isExtraFieldsOpen, setIsExtraFieldsOpen] = useState(false);
  const [editingField, setEditingField] = useState<'team' | 'cabin' | 'ministerpost' | null>(null);

  // Leader fields
  const [team, setTeam] = useState(leader?.team || '');
  const [cabin, setCabin] = useState(leader?.cabin || '');
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

  // Reset form when leader changes
  useEffect(() => {
    if (leader) {
      setTeam(leader.team || '');
      setCabin(leader.cabin || '');
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
    }
    // Reset editing state when leader changes
    setEditingField(null);
  }, [leader]);

  if (!leader) return null;

  const visibleExtraFields = extraFieldsConfig
    .filter(c => c.is_visible)
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
      // Update leader info
      const { error: leaderError } = await supabase
        .from('leaders')
        .update({
          team: team || null,
          cabin: cabin || null,
          ministerpost: ministerpost || null
        })
        .eq('id', leader.id);

      if (leaderError) throw leaderError;

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
        updated_at: new Date().toISOString()
      };

      const { error: contentError } = await supabase
        .from('leader_content')
        .upsert(contentData, { onConflict: 'leader_id' });

      if (contentError) throw contentError;

      toast.success('Lagret!');
      onSaved();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Kunne ikke lagre');
    } finally {
      setSaving(false);
    }
  };

  return (
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
                <Badge 
                  className={`cursor-pointer hover:opacity-80 transition-opacity ${team ? getTeamStyles(team) : 'bg-muted text-muted-foreground'}`}
                >
                  {team || 'Velg team'}
                  <Pencil className="w-3 h-3 ml-1" />
                </Badge>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2 bg-popover" align="start">
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

            {/* Cabin Badge */}
            <Popover open={editingField === 'cabin'} onOpenChange={(open) => setEditingField(open ? 'cabin' : null)}>
              <PopoverTrigger asChild>
                <Badge 
                  variant="outline"
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                >
                  {cabin || 'Hytte-ansvar'}
                  <Pencil className="w-3 h-3 ml-1" />
                </Badge>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3 bg-popover" align="start">
                <div className="space-y-2">
                  <Label className="text-xs">Hytte-ansvar</Label>
                  <Input
                    value={cabin}
                    onChange={(e) => setCabin(e.target.value)}
                    placeholder="f.eks. Fyansen"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
                  />
                  <Button size="sm" onClick={() => setEditingField(null)} className="w-full">
                    Ferdig
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Ministerpost Badge */}
            <Popover open={editingField === 'ministerpost'} onOpenChange={(open) => setEditingField(open ? 'ministerpost' : null)}>
              <PopoverTrigger asChild>
                <Badge 
                  variant="secondary"
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                >
                  {ministerpost || 'Ministerpost'}
                  <Pencil className="w-3 h-3 ml-1" />
                </Badge>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3 bg-popover" align="start">
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
                      {getIcon(field.icon)}
                      {field.title || field.field_key}
                    </Label>
                    <Textarea
                      value={getExtraFieldValue(field.field_key)}
                      onChange={(e) => setExtraFieldValue(field.field_key, e.target.value)}
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
