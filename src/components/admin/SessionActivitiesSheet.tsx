import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendar, Loader2, Save, CheckCircle2 } from 'lucide-react';
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

export const APP_CONFIG_KEY_LEGACY = 'session_activities_data';
export const sessionActivitiesKey = (periodId: string | null | undefined) =>
  periodId ? `session_activities_data:${periodId}` : APP_CONFIG_KEY_LEGACY;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function sessionToText(s: SessionData): string {
  const lines: string[] = [];
  if (s.reminder.trim()) lines.push(s.reminder.trim());
  for (const item of s.items) lines.push(item);
  return lines.join('\n');
}

function textToSession(text: string): SessionData {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const items: string[] = [];
  const reminders: string[] = [];
  for (const line of lines) {
    // Skip "N. økt" header lines — økt-nummer styres av toggle
    if (/^\d+\.\s*økt\b/i.test(line)) continue;
    if (/^husk\b/i.test(line)) {
      reminders.push(line);
    } else {
      items.push(line);
    }
  }
  return { reminder: reminders.join(' '), items };
}

export function SessionActivitiesSheet({ open, onOpenChange }: Props) {
  const { showSuccess, showError } = useStatusPopup();
  const [data, setData] = useState<SessionsPayload>(EMPTY);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [periodId, setPeriodId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      // Resolve active period
      const { data: period } = await supabase
        .from('periods')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();
      const pid = period?.id ?? null;
      setPeriodId(pid);

      // Try period-scoped key first; fall back to legacy global key
      const key = sessionActivitiesKey(pid);
      let { data: row } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', key)
        .maybeSingle();
      if (!row && pid) {
        const legacy = await supabase
          .from('app_config')
          .select('value')
          .eq('key', APP_CONFIG_KEY_LEGACY)
          .maybeSingle();
        row = legacy.data ?? null;
      }
      let next: SessionsPayload = EMPTY;
      if (row?.value) {
        try {
          const parsed = JSON.parse(row.value);
          next = { ...EMPTY, ...parsed, sessions: { ...EMPTY.sessions, ...(parsed.sessions || {}) } };
        } catch {}
      }
      setData(next);
      setText(sessionToText(next.sessions[String(next.active) as '1' | '2' | '3']));
      setLoading(false);
    })();
  }, [open]);

  const setActive = (n: 1 | 2 | 3) => {
    // Lagre redigert tekst til forrige aktive økt, last inn ny økt sin tekst
    setData((d) => {
      const prevKey = String(d.active) as '1' | '2' | '3';
      const nextKey = String(n) as '1' | '2' | '3';
      const updated: SessionsPayload = {
        ...d,
        active: n,
        sessions: { ...d.sessions, [prevKey]: textToSession(text) },
      };
      setText(sessionToText(updated.sessions[nextKey]));
      return updated;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const activeKey = String(data.active) as '1' | '2' | '3';
      const payload: SessionsPayload = {
        ...data,
        sessions: { ...data.sessions, [activeKey]: textToSession(text) },
      };
      const key = sessionActivitiesKey(periodId);
      const { error } = await supabase.from('app_config').upsert(
        { key, value: JSON.stringify(payload), updated_at: new Date().toISOString() },
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
          <SheetDescription>Velg økt og lim inn aktivitetene — én per linje. Linjer som starter med «Husk» blir påminnelse.</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 mt-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Velg økt</p>
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

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Aktiviteter for {data.active}. økt
            </label>
            <Textarea
              className="mt-1.5 min-h-[260px] font-mono text-sm"
              placeholder={'Husk å ta bilder og legge i delt album!\nSlottsholmen for de eldste\nSlip and slide\nTube\nBading\nVannski\nRappellering'}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Én aktivitet per linje. Linjer som starter med «Husk» blir gul påminnelse. «1. økt»-overskrifter ignoreres.
            </p>
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
