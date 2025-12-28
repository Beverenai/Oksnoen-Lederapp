import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Save, Loader2, Home, Briefcase, Users as UsersIcon, Edit2, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Leader = {
  id: string;
  name: string;
  phone: string;
  cabin: string | null;
  team: string | null;
  ministerpost: string | null;
  is_active: boolean | null;
  profile_image_url: string | null;
};

type LeaderContent = {
  leader_id?: string;
  current_activity?: string | null;
  extra_activity?: string | null;
  personal_notes?: string | null;
  obs_message?: string | null;
  extra_1?: string | null;
  extra_2?: string | null;
  extra_3?: string | null;
  extra_4?: string | null;
  extra_5?: string | null;
};

type ExtraFieldConfig = {
  id: string;
  field_key: string;
  title: string;
  icon: string;
  is_visible: boolean | null;
  sort_order: number | null;
};

interface LeaderDashboardProps {
  leaders: Leader[];
  extraFieldsConfig: ExtraFieldConfig[];
  onLeaderUpdated: () => void;
  onScheduleAutoExport: () => void;
}

export function LeaderDashboard({ leaders, extraFieldsConfig, onLeaderUpdated, onScheduleAutoExport }: LeaderDashboardProps) {
  const [expandedLeaderId, setExpandedLeaderId] = useState<string | null>(null);
  const [leaderContents, setLeaderContents] = useState<Map<string, LeaderContent>>(new Map());
  const [editingField, setEditingField] = useState<{ leaderId: string; field: 'cabin' | 'team' | 'ministerpost' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingInline, setIsSavingInline] = useState(false);

  const activeLeaders = leaders.filter(l => l.is_active !== false && l.phone !== '12345678');

  // Load all leader contents on mount
  useEffect(() => {
    const loadAllContents = async () => {
      const { data } = await supabase.from('leader_content').select('*');
      if (data) {
        const contentMap = new Map<string, LeaderContent>();
        data.forEach(content => {
          contentMap.set(content.leader_id, content);
        });
        setLeaderContents(contentMap);
      }
    };
    loadAllContents();
  }, []);

  const getLeaderContent = (leaderId: string): LeaderContent => {
    return leaderContents.get(leaderId) || { leader_id: leaderId };
  };

  const updateLeaderContent = (leaderId: string, updates: Partial<LeaderContent>) => {
    setLeaderContents(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(leaderId) || { leader_id: leaderId };
      newMap.set(leaderId, { ...current, ...updates });
      return newMap;
    });
  };

  const saveLeaderContent = async (leaderId: string) => {
    const content = leaderContents.get(leaderId);
    if (!content) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('leader_content')
        .upsert({
          leader_id: leaderId,
          current_activity: content.current_activity || null,
          extra_activity: content.extra_activity || null,
          personal_notes: content.personal_notes || null,
          obs_message: content.obs_message || null,
          extra_1: content.extra_1 || null,
          extra_2: content.extra_2 || null,
          extra_3: content.extra_3 || null,
          extra_4: content.extra_4 || null,
          extra_5: content.extra_5 || null,
        }, { onConflict: 'leader_id' });

      if (error) throw error;
      toast.success('Innhold lagret!');
      onScheduleAutoExport();
    } catch (error) {
      console.error('Error saving content:', error);
      toast.error('Kunne ikke lagre');
    } finally {
      setIsSaving(false);
    }
  };

  const startInlineEdit = (leaderId: string, field: 'cabin' | 'team' | 'ministerpost', currentValue: string | null) => {
    setEditingField({ leaderId, field });
    setEditValue(currentValue || '');
  };

  const cancelInlineEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const saveInlineEdit = async () => {
    if (!editingField) return;
    
    setIsSavingInline(true);
    try {
      const { error } = await supabase
        .from('leaders')
        .update({ [editingField.field]: editValue || null })
        .eq('id', editingField.leaderId);

      if (error) throw error;
      toast.success('Oppdatert!');
      onLeaderUpdated();
      onScheduleAutoExport();
      cancelInlineEdit();
    } catch (error) {
      console.error('Error updating leader:', error);
      toast.error('Kunne ikke oppdatere');
    } finally {
      setIsSavingInline(false);
    }
  };

  const toggleExpanded = (leaderId: string) => {
    setExpandedLeaderId(prev => prev === leaderId ? null : leaderId);
  };

  const visibleExtraFields = extraFieldsConfig.filter(cfg => cfg.is_visible);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leder-oversikt</CardTitle>
        <CardDescription>
          Klikk på en leder for å redigere innhold. Klikk på hytte/team/ministerpost for å endre direkte.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {activeLeaders.map((leader) => {
            const content = getLeaderContent(leader.id);
            const isExpanded = expandedLeaderId === leader.id;
            
            return (
              <div key={leader.id} className="bg-background">
                {/* Leader row */}
                <div className="flex items-center gap-2 p-4 hover:bg-muted/50 transition-colors">
                  {/* Expand button + name */}
                  <button
                    onClick={() => toggleExpanded(leader.id)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="font-medium truncate">{leader.name}</span>
                  </button>

                  {/* Inline editable fields */}
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {/* Cabin */}
                    {editingField?.leaderId === leader.id && editingField?.field === 'cabin' ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-7 w-24 text-xs"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveInlineEdit();
                            if (e.key === 'Escape') cancelInlineEdit();
                          }}
                        />
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={saveInlineEdit} disabled={isSavingInline}>
                          {isSavingInline ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelInlineEdit}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-muted gap-1"
                        onClick={() => startInlineEdit(leader.id, 'cabin', leader.cabin)}
                      >
                        <Home className="h-3 w-3" />
                        {leader.cabin || '-'}
                      </Badge>
                    )}

                    {/* Team */}
                    {editingField?.leaderId === leader.id && editingField?.field === 'team' ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-7 w-24 text-xs"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveInlineEdit();
                            if (e.key === 'Escape') cancelInlineEdit();
                          }}
                        />
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={saveInlineEdit} disabled={isSavingInline}>
                          {isSavingInline ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelInlineEdit}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-muted gap-1"
                        onClick={() => startInlineEdit(leader.id, 'team', leader.team)}
                      >
                        <UsersIcon className="h-3 w-3" />
                        {leader.team || '-'}
                      </Badge>
                    )}

                    {/* Ministerpost */}
                    {editingField?.leaderId === leader.id && editingField?.field === 'ministerpost' ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-7 w-32 text-xs"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveInlineEdit();
                            if (e.key === 'Escape') cancelInlineEdit();
                          }}
                        />
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={saveInlineEdit} disabled={isSavingInline}>
                          {isSavingInline ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelInlineEdit}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-muted gap-1"
                        onClick={() => startInlineEdit(leader.id, 'ministerpost', leader.ministerpost)}
                      >
                        <Briefcase className="h-3 w-3" />
                        {leader.ministerpost || '-'}
                      </Badge>
                    )}

                    {/* Current activity preview */}
                    {content.current_activity && (
                      <Badge variant="secondary" className="max-w-[150px] truncate">
                        {content.current_activity}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Expanded content editor */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 bg-muted/30 border-t">
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Aktivitet</Label>
                          <Input
                            placeholder="Hva skal lederen gjøre nå?"
                            value={content.current_activity || ''}
                            onChange={(e) => updateLeaderContent(leader.id, { current_activity: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Ekstra aktivitet</Label>
                          <Input
                            placeholder="Eventuelle tilleggsoppgaver"
                            value={content.extra_activity || ''}
                            onChange={(e) => updateLeaderContent(leader.id, { extra_activity: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Notater til lederen</Label>
                        <Textarea
                          placeholder="Personlige beskjeder"
                          value={content.personal_notes || ''}
                          onChange={(e) => updateLeaderContent(leader.id, { personal_notes: e.target.value })}
                          className="min-h-[80px]"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-warning">OBS-melding</Label>
                        <Textarea
                          placeholder="Kritisk informasjon (vises øverst)"
                          value={content.obs_message || ''}
                          onChange={(e) => updateLeaderContent(leader.id, { obs_message: e.target.value })}
                          className="min-h-[60px]"
                        />
                      </div>

                      {/* Extra fields - collapsible */}
                      {visibleExtraFields.length > 0 && (
                        <Collapsible>
                          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                            <ChevronDown className="h-4 w-4" />
                            Ekstra info ({visibleExtraFields.length} felt)
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                              {visibleExtraFields.map((extraField) => (
                                <div key={extraField.field_key} className="space-y-1">
                                  <Label className="text-xs">{extraField.title || extraField.field_key.replace('_', ' #')}</Label>
                                  <Input
                                    placeholder={`Innhold for ${extraField.title || extraField.field_key}`}
                                    value={(content as any)[extraField.field_key] || ''}
                                    onChange={(e) => updateLeaderContent(leader.id, { [extraField.field_key]: e.target.value })}
                                    className="h-8 text-sm"
                                  />
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      <Button onClick={() => saveLeaderContent(leader.id)} disabled={isSaving}>
                        {isSaving ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        Lagre innhold
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
