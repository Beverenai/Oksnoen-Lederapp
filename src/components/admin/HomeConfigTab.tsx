import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Info, Star, Heart, Bell, Zap, Activity, MessageSquare,
  Save, AlertTriangle, Bold, Italic, GripVertical, Calendar, Plus, Loader2
} from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { hapticSuccess, hapticError, hapticImpact } from '@/lib/capacitorHaptics';
import { supabase } from '@/integrations/supabase/client';

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

interface HomeConfigTabProps {
  homeConfig: HomeScreenConfig[];
  localHomeConfig: HomeScreenConfig[];
  setLocalHomeConfig: React.Dispatch<React.SetStateAction<HomeScreenConfig[]>>;
  onSaved: () => void;
  setHomeConfig: React.Dispatch<React.SetStateAction<HomeScreenConfig[]>>;
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

const DEFAULT_HOME_CONFIG: Record<string, {
  title: string; icon: string; bg_color: string; text_size: string;
  is_bold: boolean; is_italic: boolean; is_visible: boolean; sort_order: number;
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

function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
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
        <button type="button" className="mt-4 p-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none" {...attributes} {...listeners}>
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

export default function HomeConfigTab({ homeConfig, localHomeConfig, setLocalHomeConfig, onSaved, setHomeConfig }: HomeConfigTabProps) {
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLocalHomeConfig((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex).map((item, index) => ({ ...item, sort_order: index }));
      });
      setHasUnsavedChanges(true);
    }
  };

  const updateLocal = (configId: string, updates: Partial<HomeScreenConfig>) => {
    setLocalHomeConfig(prev => prev.map(cfg => cfg.id === configId ? { ...cfg, ...updates } : cfg));
    setHasUnsavedChanges(true);
  };

  const resetConfig = () => {
    const reset = localHomeConfig.map(cfg => {
      const defaults = DEFAULT_HOME_CONFIG[cfg.element_key];
      return defaults ? { ...cfg, ...defaults } : cfg;
    }).sort((a, b) => a.sort_order - b.sort_order);
    setLocalHomeConfig(reset);
    setHasUnsavedChanges(true);
    showInfo('Konfigurasjon tilbakestilt til standard. Klikk "Lagre endringer" for å bekrefte.');
  };

  const saveAll = async () => {
    hapticImpact('medium');
    setIsSaving(true);
    try {
      for (const cfg of localHomeConfig) {
        const original = homeConfig.find(c => c.id === cfg.id);
        if (original && (
          original.title !== cfg.title || original.icon !== cfg.icon || original.is_visible !== cfg.is_visible ||
          original.bg_color !== cfg.bg_color || original.text_size !== cfg.text_size ||
          original.is_bold !== cfg.is_bold || original.is_italic !== cfg.is_italic || original.sort_order !== cfg.sort_order
        )) {
          await supabase.from('home_screen_config').update({
            title: cfg.title, icon: cfg.icon, is_visible: cfg.is_visible,
            bg_color: cfg.bg_color, text_size: cfg.text_size, is_bold: cfg.is_bold,
            is_italic: cfg.is_italic, sort_order: cfg.sort_order
          }).eq('id', cfg.id);
        }
      }
      setHasUnsavedChanges(false);
      setHomeConfig(localHomeConfig);
      onSaved();
      showSuccess('Konfigurasjon lagret!');
    } catch {
      showError('Kunne ikke lagre konfigurasjon');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 mb-4">
        <Button onClick={saveAll} disabled={!hasUnsavedChanges || isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Lagre endringer
        </Button>
        <Button variant="outline" onClick={resetConfig}>Tilbakestill til standard</Button>
        {hasUnsavedChanges && <Badge variant="secondary" className="text-xs self-center">Ulagrede endringer</Badge>}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={localHomeConfig.map(cfg => cfg.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {localHomeConfig.map((cfg) => {
              const currentIcon = availableIcons.find(i => i.value === cfg.icon) || availableIcons[0];
              const IconComponent = currentIcon.icon;
              return (
                <SortableItem key={cfg.id} id={cfg.id}>
                  <div className="p-3 sm:p-4 rounded-lg bg-muted/50 space-y-3 sm:space-y-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Switch checked={cfg.is_visible || false} onCheckedChange={(checked) => updateLocal(cfg.id, { is_visible: checked })} />
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                        <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                        <Badge variant="outline" className="text-xs truncate">{cfg.label}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Input placeholder="Tittel" value={cfg.title || ''} onChange={(e) => updateLocal(cfg.id, { title: e.target.value })} className="flex-1 text-sm" />
                      <Select value={cfg.icon || 'info'} onValueChange={(value) => updateLocal(cfg.id, { icon: value })}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {availableIcons.map(({ value, label, icon: Icon }) => (
                            <SelectItem key={value} value={value}>
                              <div className="flex items-center gap-2"><Icon className="w-4 h-4" />{label}</div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm text-muted-foreground min-w-[40px] sm:min-w-[50px]">Farge:</span>
                      <div className="flex gap-1 sm:gap-1.5 flex-wrap">
                        {availableColors.map((color) => (
                          <button key={color.value} type="button" onClick={() => updateLocal(cfg.id, { bg_color: color.value })}
                            className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full ${color.class} border-2 transition-all ${(cfg.bg_color || 'default') === color.value ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'}`}
                            title={color.label} />
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm text-muted-foreground">Størrelse:</span>
                        <ToggleGroup type="single" value={cfg.text_size || 'md'} onValueChange={(v) => { if (v) updateLocal(cfg.id, { text_size: v }); }} className="bg-background rounded-md">
                          <ToggleGroupItem value="sm" size="sm" className="text-xs px-2">S</ToggleGroupItem>
                          <ToggleGroupItem value="md" size="sm" className="text-xs px-2">M</ToggleGroupItem>
                          <ToggleGroupItem value="lg" size="sm" className="text-xs px-2">L</ToggleGroupItem>
                        </ToggleGroup>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm text-muted-foreground">Stil:</span>
                        <ToggleGroup type="multiple" value={[...(cfg.is_bold ? ['bold'] : []), ...(cfg.is_italic ? ['italic'] : [])]}
                          onValueChange={(values) => updateLocal(cfg.id, { is_bold: values.includes('bold'), is_italic: values.includes('italic') })} className="bg-background rounded-md">
                          <ToggleGroupItem value="bold" size="sm" className="px-2"><Bold className="w-3.5 h-3.5" /></ToggleGroupItem>
                          <ToggleGroupItem value="italic" size="sm" className="px-2"><Italic className="w-3.5 h-3.5" /></ToggleGroupItem>
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
    </div>
  );
}
