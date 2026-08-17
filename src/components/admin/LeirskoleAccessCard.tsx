import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tent, Search, Wrench, ShieldCheck, UserMinus } from 'lucide-react';

type Props = {
  weekId: string;
  weekName: string;
  maxDailyHours?: number | null;
};

type LeaderRow = {
  id: string;
  name: string;
  is_active: boolean | null;
  profile_image_url: string | null;
};

/** Roller som beholder full app-tilgang selv om de er på leirskole. */
const PRIVILEGED = new Set(['superadmin', 'admin', 'nurse']);

/**
 * Én samlet oversikt over leirskole-tilgang: bryteren setter lederen
 * både på uken og gir rollen «leirskole», så ingenting må huskes to steder.
 */
export function LeirskoleAccessCard({ weekId, weekName, maxDailyHours }: Props) {
  const qc = useQueryClient();
  const { showError } = useStatusPopup();
  const [search, setSearch] = useState('');

  const { data: leaders } = useQuery({
    queryKey: ['leirskole-access-leaders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leaders')
        .select('id, name, is_active, profile_image_url')
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;
      return (data ?? []) as LeaderRow[];
    },
  });

  const { data: roles } = useQuery({
    queryKey: ['leirskole-access-roles'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_all_leader_roles');
      if (error) throw error;
      return (data ?? []) as { leader_id: string; role: string }[];
    },
  });

  const { data: staff } = useQuery({
    queryKey: ['leirskole-access-staff', weekId],
    enabled: !!weekId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leirskole_staff')
        .select('id, leader_id')
        .eq('week_id', weekId);
      if (error) throw error;
      return (data ?? []) as { id: string; leader_id: string }[];
    },
  });

  const rolesByLeader = useMemo(() => {
    const map = new Map<string, Set<string>>();
    (roles ?? []).forEach((r) => {
      if (!map.has(r.leader_id)) map.set(r.leader_id, new Set());
      map.get(r.leader_id)!.add(r.role);
    });
    return map;
  }, [roles]);

  const staffIds = useMemo(() => new Set((staff ?? []).map((s) => s.leader_id)), [staff]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['leirskole-access-staff'] });
    qc.invalidateQueries({ queryKey: ['leirskole-access-roles'] });
    qc.invalidateQueries({ queryKey: ['leirskole-staff'] });
    qc.invalidateQueries({ queryKey: ['leirskole-is-staff'] });
  };

  /** Sett/fjern leirskole-rolle. Privilegerte roller røres ikke. */
  const setLeirskoleRole = async (leaderId: string, on: boolean) => {
    const current = rolesByLeader.get(leaderId) ?? new Set<string>();
    if ([...current].some((r) => PRIVILEGED.has(r))) return;
    if (on && current.has('leirskole')) return;
    if (!on && !current.has('leirskole')) return;
    const { error } = await supabase.functions.invoke('manage-roles', {
      body: { action: on ? 'add' : 'remove', leader_id: leaderId, role: 'leirskole' },
    });
    if (error) throw error;
  };

  const toggle = useMutation({
    mutationFn: async ({ leaderId, on }: { leaderId: string; on: boolean }) => {
      if (on) {
        const { error } = await supabase
          .from('leirskole_staff')
          .insert({ week_id: weekId, leader_id: leaderId, max_daily_hours: maxDailyHours ?? 8 });
        if (error && !error.message.includes('duplicate')) throw error;
      } else {
        const { error } = await supabase
          .from('leirskole_staff')
          .delete()
          .eq('week_id', weekId)
          .eq('leader_id', leaderId);
        if (error) throw error;
      }
      await setLeirskoleRole(leaderId, on);
    },
    onMutate: async ({ leaderId, on }) => {
      // Optimistisk: bryteren skal svare umiddelbart selv om nettverket henger.
      const key = ['leirskole-access-staff', weekId];
      const prev = qc.getQueryData<{ id: string; leader_id: string }[]>(key);
      qc.setQueryData<{ id: string; leader_id: string }[]>(key, (old) => {
        const list = old ?? [];
        return on
          ? [...list, { id: `optimistic-${leaderId}`, leader_id: leaderId }]
          : list.filter((s) => s.leader_id !== leaderId);
      });
      return { prev, key };
    },
    onSuccess: (_d, v) => {
      toast.success(v.on ? 'Lagt til på leirskole' : 'Fjernet fra leirskole');
      refresh();
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.key) qc.setQueryData(ctx.key, ctx.prev);
      showError(e.message ?? 'Kunne ikke oppdatere');
    },
  });

  /** Legg til alle som er aktive i perioden, eller tøm uken. */
  const bulk = useMutation({
    mutationFn: async (mode: 'add-active' | 'remove-all') => {
      const targets =
        mode === 'add-active'
          ? (leaders ?? []).filter((l) => l.is_active && !staffIds.has(l.id))
          : (leaders ?? []).filter((l) => staffIds.has(l.id));
      for (const l of targets) {
        if (mode === 'add-active') {
          const { error } = await supabase
            .from('leirskole_staff')
            .insert({ week_id: weekId, leader_id: l.id, max_daily_hours: maxDailyHours ?? 8 });
          if (error && !error.message.includes('duplicate')) throw error;
          await setLeirskoleRole(l.id, true);
        } else {
          const { error } = await supabase
            .from('leirskole_staff')
            .delete()
            .eq('week_id', weekId)
            .eq('leader_id', l.id);
          if (error) throw error;
          await setLeirskoleRole(l.id, false);
        }
      }
      return targets.length;
    },
    onSuccess: (count, mode) => {
      toast.success(
        mode === 'add-active' ? `La til ${count} aktive ledere` : `Fjernet ${count} ledere fra uken`,
      );
      refresh();
    },
    onError: (e: any) => showError(e.message ?? 'Kunne ikke oppdatere'),
  });

  const missingRole = useMemo(
    () =>
      (leaders ?? []).filter((l) => {
        if (!staffIds.has(l.id)) return false;
        const r = rolesByLeader.get(l.id) ?? new Set<string>();
        if ([...r].some((x) => PRIVILEGED.has(x))) return false;
        return !r.has('leirskole');
      }),
    [leaders, staffIds, rolesByLeader],
  );

  const fixAll = useMutation({
    mutationFn: async () => {
      for (const l of missingRole) await setLeirskoleRole(l.id, true);
    },
    onSuccess: () => {
      toast.success('Tilgang rettet opp');
      refresh();
    },
    onError: (e: any) => showError(e.message ?? 'Kunne ikke rette opp'),
  });

  const privilegedOnWeek = (leaders ?? []).filter(
    (l) => staffIds.has(l.id) && [...(rolesByLeader.get(l.id) ?? [])].some((r) => PRIVILEGED.has(r)),
  ).length;

  const q = search.trim().toLowerCase();
  const filtered = (leaders ?? []).filter((l) => (q ? l.name.toLowerCase().includes(q) : true));
  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  const onWeek = sorted.filter((l) => staffIds.has(l.id));
  const others = sorted.filter((l) => !staffIds.has(l.id));
  const activeNotOnWeek = (leaders ?? []).filter((l) => l.is_active && !staffIds.has(l.id)).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Tent className="h-4 w-4 text-primary" /> Leirskole-tilgang ({staffIds.size})
        </CardTitle>
        <CardDescription>
          Én bryter per leder for {weekName}: lederen settes på uken og får leirskole-appen (vakter,
          oppgaver og leirskole-chat) automatisk.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border bg-card/60 px-3 py-2">
            <p className="text-lg font-bold tabular-nums">{staffIds.size}</p>
            <p className="text-[11px] text-muted-foreground">På leirskole</p>
          </div>
          <div className="rounded-2xl border bg-card/60 px-3 py-2">
            <p className="text-lg font-bold tabular-nums">{privilegedOnWeek}</p>
            <p className="text-[11px] text-muted-foreground">Admin/nurse</p>
          </div>
          <div className="rounded-2xl border bg-card/60 px-3 py-2">
            <p className="text-lg font-bold tabular-nums">{missingRole.length}</p>
            <p className="text-[11px] text-muted-foreground">Mangler tilgang</p>
          </div>
        </div>

        {missingRole.length > 0 && (
          <Button size="sm" variant="secondary" className="w-full" disabled={fixAll.isPending} onClick={() => fixAll.mutate()}>
            <Wrench className="mr-2 h-4 w-4" />
            Fiks tilgang for {missingRole.length} leder{missingRole.length === 1 ? '' : 'e'}
          </Button>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={bulk.isPending || activeNotOnWeek === 0}
            onClick={() => bulk.mutate('add-active')}
          >
            <Tent className="mr-1.5 h-4 w-4" /> Legg til aktive ({activeNotOnWeek})
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={bulk.isPending || staffIds.size === 0}
            onClick={() => bulk.mutate('remove-all')}
          >
            <UserMinus className="mr-1.5 h-4 w-4" /> Fjern alle
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk etter leder"
            className="pl-9"
          />
        </div>

        <div className="max-h-[460px] space-y-1.5 overflow-y-auto pr-0.5">
          {onWeek.length > 0 && (
            <p className="pt-1 text-[11px] font-bold uppercase tracking-wider text-primary">
              På leirskole ({onWeek.length})
            </p>
          )}
          {[...onWeek, ...others].map((l, index) => {
            const showOthersHeader = index === onWeek.length && others.length > 0;
            const on = staffIds.has(l.id);
            const r = rolesByLeader.get(l.id) ?? new Set<string>();
            const privileged = [...r].some((x) => PRIVILEGED.has(x));
            return (
              <div key={`wrap-${l.id}`}>
              {showOthersHeader && (
                <p className="pb-1.5 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Andre ledere ({others.length})
                </p>
              )}
              <div
                key={l.id}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${on ? 'border-primary/40 bg-primary/5' : 'bg-card/40'}`}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={l.profile_image_url ?? undefined} />
                  <AvatarFallback className="text-[10px]">{l.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    {on && r.has('leirskole') && (
                      <Badge variant="secondary" className="text-[10px]">Leirskole-app</Badge>
                    )}
                    {on && privileged && (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <ShieldCheck className="h-3 w-3" /> Admin/nurse
                      </Badge>
                    )}
                    {on && !privileged && !r.has('leirskole') && (
                      <Badge variant="destructive" className="text-[10px]">Mangler tilgang</Badge>
                    )}
                    {l.is_active && (
                      <Badge variant="outline" className="text-[10px]">Aktiv i periode</Badge>
                    )}
                  </div>
                </div>
                <Switch
                  checked={on}
                  disabled={toggle.isPending}
                  onCheckedChange={(v) => toggle.mutate({ leaderId: l.id, on: v })}
                />
              </div>
              </div>
            );
          })}
          {sorted.length === 0 && <p className="text-sm text-muted-foreground">Ingen ledere funnet.</p>}
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Ledere som er aktive i perioden ser hele appen — leirskole-delen ligger da under Mer. Admin
          og sykepleiere beholder sin rolle og bytter visning selv.
        </p>
      </CardContent>
    </Card>
  );
}
