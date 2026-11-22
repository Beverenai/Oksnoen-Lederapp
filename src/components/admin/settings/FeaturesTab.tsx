import { useCallback, useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { uniqueRealtimeChannelName } from '@/lib/realtimeChannel';
import { confirmDialog } from '@/components/ui/confirm-sheet';

/**
 * Alle av/på-bryterne for perioden samlet på ett sted. Bryterne skriver samme
 * nøkler i app_config som før, så de gamle stedene viser fortsatt riktig status.
 * Bytte av periode skrur alle av (se NursePeriodsTab).
 */

type FlagKey = 'checkout_enabled' | 'overnatting_enabled' | 'teams_enabled' | 'sweaters_enabled' | 'hookups_enabled';

interface Feature {
  key: FlagKey;
  label: string;
  desc: string;
  section: string; // seksjonen i innstillinger med detaljene
}

const FEATURES: Feature[] = [
  { key: 'checkout_enabled', label: 'Utsjekk', desc: 'Ledere ser pass og utsjekk i Passkontroll', section: 'participants' },
  { key: 'overnatting_enabled', label: 'Overnatting', desc: 'Spørsmål om overnatting på forsiden', section: 'overnatting' },
  { key: 'teams_enabled', label: 'Lag', desc: 'Lagfarger og lagpoeng for deltakerne', section: 'participants' },
  { key: 'sweaters_enabled', label: 'Gensere', desc: 'Utdeling av gensere i menyen', section: 'sweaters' },
  { key: 'hookups_enabled', label: 'Klineliste og Tinder', desc: 'Sosialt mellom lederne', section: 'tinder' },
];

interface Props {
  onOpenSection: (key: string) => void;
}

export function FeaturesTab({ onOpenSection }: Props) {
  const { showError } = useStatusPopup();
  const [flags, setFlags] = useState<Record<string, boolean> | null>(null);
  const [status, setStatus] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('app_config')
      .select('key,value')
      .in('key', FEATURES.map((f) => f.key));
    const map: Record<string, boolean> = {};
    for (const f of FEATURES) map[f.key] = false;
    for (const row of data ?? []) map[row.key] = String(row.value) === 'true';
    setFlags(map);

    // Kort status per funksjon, så man ser om den er klar til bruk.
    const { data: period } = await supabase.from('periods').select('id').eq('is_active', true).maybeSingle();
    const pid = period?.id;
    const next: Record<string, string> = {};
    type CountTable = 'overnatting_responses' | 'participant_teams' | 'participant_sweaters' | 'leader_hookups';
    const count = async (table: CountTable, eq: Record<string, string | boolean> = {}) => {
      let q = supabase.from(table).select('*', { count: 'exact', head: true });
      for (const [col, val] of Object.entries(eq)) q = q.eq(col as never, val as never);
      const { count: n } = await q;
      return n ?? 0;
    };
    const [svar, lag, gensere, kliner] = await Promise.all([
      count('overnatting_responses', { is_joining: true }),
      pid ? count('participant_teams', { period_id: pid }) : Promise.resolve(0),
      pid ? count('participant_sweaters', { period_id: pid, picked_up: true }) : Promise.resolve(0),
      pid ? count('leader_hookups', { period_id: pid }) : Promise.resolve(0),
    ]);
    next.overnatting_enabled = `${svar} har svart ja`;
    next.teams_enabled = lag ? `${lag} lag satt opp` : 'Ingen lag satt opp ennå';
    next.sweaters_enabled = `${gensere} gensere hentet denne perioden`;
    next.hookups_enabled = `${kliner} registrert denne perioden`;
    setStatus(next);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(uniqueRealtimeChannelName('features-tab'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_config' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const toggle = async (f: Feature, on: boolean) => {
    if (f.key === 'checkout_enabled' && !on) {
      if (!(await confirmDialog('Skru av utsjekk? Fremdriften for pass-generering nullstilles.', { confirmLabel: 'Skru av', destructive: true }))) return;
    }
    setBusy(f.key);
    setFlags((prev) => ({ ...(prev ?? {}), [f.key]: on }));
    const rows: { key: string; value: string }[] = [{ key: f.key, value: on ? 'true' : 'false' }];
    if (f.key === 'checkout_enabled' && !on) {
      rows.push({ key: 'checkout_progress', value: JSON.stringify({ status: 'idle', processed: 0, total: 0 }) });
    }
    const { error } = await supabase.from('app_config').upsert(rows, { onConflict: 'key' });
    setBusy(null);
    if (error) {
      setFlags((prev) => ({ ...(prev ?? {}), [f.key]: !on }));
      showError('Kunne ikke lagre', error.message);
    }
  };

  if (!flags) return <Skeleton className="h-72 rounded-2xl" />;

  const onCount = FEATURES.filter((f) => flags[f.key]).length;

  return (
    <div className="space-y-2">
      <p className="px-4 text-[13px] text-muted-foreground">
        {onCount} av {FEATURES.length} er på. Alle skrus av når du bytter periode.
      </p>
      <div className="overflow-hidden rounded-2xl bg-card divide-y divide-border/60">
        {FEATURES.map((f) => (
          <div key={f.key} className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 text-left active:opacity-60"
              onClick={() => onOpenSection(f.section)}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[17px] leading-tight">{f.label}</p>
                <p className="truncate text-[13px] text-muted-foreground">{status[f.key] ?? f.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
            </button>
            <Switch
              checked={flags[f.key]}
              disabled={busy === f.key}
              onCheckedChange={(v) => toggle(f, v)}
              aria-label={f.label}
            />
          </div>
        ))}
      </div>
      <p className="px-4 text-[13px] text-muted-foreground">
        Trykk på navnet for å åpne innstillingene for funksjonen. Appen av/på ligger under Periode.
      </p>
    </div>
  );
}
