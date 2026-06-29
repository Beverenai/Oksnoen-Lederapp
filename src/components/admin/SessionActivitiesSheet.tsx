import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendar, Loader2, Plus, Save, Trash2, GripVertical, CheckCircle2 } from 'lucide-react';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { cn } from '@/lib/utils';

export type SessionData = {
  reminder: string;
  items: string[];
};

export type SessionsPayload = {
  active: 1 | 2 | 3;
  sessions: Record<'1' | '2' | '3', SessionData>;
};

const EMPTY: SessionsPayload = {
  active: 1,
  sessions: {
    '1': { reminder: '', items: [] },
    '2': { reminder: '', items: [] },
    '3': { reminder: '', items: [] },
  },
};

export const APP_CONFIG_KEY = 'session_activities_data';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function SessionActivitiesSheet({ open, onOpenChange }: Props) {
  const { showSuccess, showError } = useStatusPopup();
  const [data, setData] = useState<SessionsPayload>(EMPTY);
  const [editing, setEditing] = useState<'1' | '2' | '3'>('1');
  const [newItem, setNewItem] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data: row } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', APP_CONFIG_KEY)
        .maybeSingle();
      if (row?.value) {
        try {
          const parsed = JSON.parse(row.value);
          setData({ ...EMPTY, ...parsed, sessions: { ...EMPTY.sessions, ...(parsed.sessions || {}) } });
          setEditing(String(parsed.active || 1) as '1' | '2' | '3');
        } catch {
          setData(EMPTY);
        }
      } else {
        setData(EMPTY);
      }
      setLoading(false);
    })();
  }, [open]);

  const current = data.sessions[editing];

  const updateCurrent = (patch: Partial<SessionData>) => {
    setData((d) => ({
      ...d,
      sessions: { ...d.sessions, [editing]: { ...d.sessions[editing], ...patch } },
    }));
  };

  const addItem = () => {
    const v = newItem.trim();
    if (!v) return;
    updateCurrent({ items: [...current.items, v] });
    setNewItem('');
  };

  const removeItem = (idx: number) => {
    updateCurrent({ items: current.items.filter((_, i) => i !== idx) });
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const next = [...current.items];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    updateCurrent({ items: next });
  };

  const setActive = (n: 1 | 2 | 3) => {
    setData((d) => ({ ...d, active: n }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('app_config').upsert(
        { key: APP_CONFIG_KEY, value: JSON.stringify(data), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      if (error) throw error;
      showSuccess('Aktiviteter lagret!');
      onOpenChange(false);
    } catch {
      showError('Kunne ikke lagre');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Calendar className="w-5 h-5" />Aktiviteter</SheetTitle>
          <SheetDescription>Velg økt, skriv påminnelse og legg til aktiviteter. Det som vises på hjem-skjermen er den aktive økten.</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 mt-5">
          {/* Active session selector */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Vis på hjem-skjerm</p>
            <ToggleGroup
              type="single"
              value={String(data.active)}
              onValueChange={(v) => v && setActive(Number(v) as 1 | 2 | 3)}
              className="grid grid-cols-3 gap-2"
            >
              {([1, 2, 3] as const).map((n) => (
                <ToggleGroupItem
                  key={n}
                  value={String(n)}
                  className={cn(
                    'h-10 rounded-lg border data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary',
                    'flex items-center justify-center gap-1.5 text-sm font-medium'
                  )}
                >
                  {data.active === n && <CheckCircle2 className="h-3.5 w-3.5" />}
                  {n}. økt
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {/* Editor tabs */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Rediger økt</p>
            <ToggleGroup
              type="single"
              value={editing}
              onValueChange={(v) => v && setEditing(v as '1' | '2' | '3')}
              className="grid grid-cols-3 gap-2"
            >
              {(['1', '2', '3'] as const).map((n) => (
                <ToggleGroupItem
                  key={n}
                  value={n}
                  className="h-9 rounded-lg border text-sm data-[state=on]:bg-muted"
                >
                  {n}. økt
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {/* Reminder field */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Påminnelse (valgfritt)</label>
            <Input
              className="mt-1.5"
              placeholder="F.eks. Husk å ta bilder og legge i delt album!"
              value={current.reminder}
              onChange={(e) => updateCurrent({ reminder: e.target.value })}
            />
          </div>

          {/* Activities list */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aktiviteter</label>
            <div className="mt-1.5 space-y-1.5">
              {current.items.length === 0 && (
                <p className="text-sm text-muted-foreground italic py-2">Ingen aktiviteter lagt til ennå</p>
              )}
              {current.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5 rounded-lg border bg-card px-2 py-1.5">
                  <div className="flex flex-col">
                    <button type="button" onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 leading-none text-xs">▲</button>
                    <button type="button" onClick={() => moveItem(idx, 1)} disabled={idx === current.items.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 leading-none text-xs">▼</button>
                  </div>
                  <span className="flex-1 text-sm">{item}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(idx)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Ny aktivitet…"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
              />
              <Button type="button" onClick={addItem} variant="outline" size="icon" className="shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Button onClick={save} disabled={saving || loading} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Lagre
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
