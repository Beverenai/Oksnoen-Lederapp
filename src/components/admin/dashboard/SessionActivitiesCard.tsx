import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DashCard, EmptyLine } from '@/components/admin/dashboard/DashCard';
import {
  SessionActivitiesSheet,
  sessionActivitiesKey,
  APP_CONFIG_KEY_LEGACY,
  type SessionsPayload,
} from '@/components/admin/SessionActivitiesSheet';
import { Calendar, Pencil } from 'lucide-react';

const EMPTY: SessionsPayload = {
  active: 1,
  sessions: { '1': { reminder: '', items: [] }, '2': { reminder: '', items: [] }, '3': { reminder: '', items: [] } },
};

export function SessionActivitiesCard() {
  const [data, setData] = useState<SessionsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: period } = await supabase.from('periods').select('id').eq('is_active', true).maybeSingle();
    const key = sessionActivitiesKey(period?.id ?? null);
    let { data: row } = await supabase.from('app_config').select('value').eq('key', key).maybeSingle();
    if (!row && period?.id) {
      const legacy = await supabase.from('app_config').select('value').eq('key', APP_CONFIG_KEY_LEGACY).maybeSingle();
      row = legacy.data ?? null;
    }
    let next = EMPTY;
    if (row?.value) {
      try {
        const parsed = JSON.parse(row.value);
        next = { ...EMPTY, ...parsed, sessions: { ...EMPTY.sessions, ...(parsed.sessions || {}) } };
      } catch {}
    }
    setData(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeKey = String(data?.active ?? 1) as '1' | '2' | '3';
  const session = data?.sessions[activeKey];

  return (
    <>
      <DashCard
        title="Aktiviteter denne økten"
        icon={<Calendar className="h-4 w-4 text-sky-500" />}
        badge={data ? <Badge variant="secondary">{data.active}. økt</Badge> : undefined}
        actionLabel="Endre"
        onAction={() => setOpen(true)}
      >
        {loading ? (
          <Skeleton className="h-20 rounded-2xl" />
        ) : !session || (!session.items.length && !session.reminder) ? (
          <EmptyLine text="Ingen aktiviteter lagt inn for denne økten." />
        ) : (
          <div className="space-y-2">
            {session.reminder && (
              <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                {session.reminder}
              </p>
            )}
            {session.items.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {session.items.map((item, i) => (
                  <span
                    key={`${item}-${i}`}
                    className="rounded-full border border-border/60 bg-muted/50 px-3 py-1 text-xs font-medium"
                  >
                    {item}
                  </span>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex items-center gap-1 pt-1 text-xs font-medium text-muted-foreground active:opacity-70"
            >
              <Pencil className="h-3.5 w-3.5" />
              Endre aktiviteter og økt
            </button>
          </div>
        )}
      </DashCard>

      <SessionActivitiesSheet
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) load();
        }}
      />
    </>
  );
}
