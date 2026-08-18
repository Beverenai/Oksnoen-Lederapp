import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Beer, Minus, Plus, Search } from 'lucide-react';
import { useStatusPopup } from '@/hooks/useStatusPopup';

type Row = {
  leader_id: string;
  leader_name: string;
  profile_image_url: string | null;
  is_active: boolean | null;
  extra_sips: number;
  given: number;
  sips_left: number;
};

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export function SipsAdminTab() {
  const { showSuccess, showError } = useStatusPopup();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [bulk, setBulk] = useState('5');

  const { data, isLoading } = useQuery<Row[]>({
    queryKey: ['admin-sips-overview'],
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_sips_admin_overview');
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const grant = useMutation({
    mutationFn: async ({ leaderId, amount }: { leaderId: string; amount: number }) => {
      const { error } = await supabase.rpc('grant_extra_sips', {
        _leader_id: leaderId,
        _amount: amount,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sips-overview'] });
      queryClient.invalidateQueries({ queryKey: ['sips-left'] });
    },
    onError: (e: any) => showError('Kunne ikke endre slurker', e?.message ?? 'Prøv igjen'),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data ?? [];
    return q ? list.filter((r) => r.leader_name.toLowerCase().includes(q)) : list;
  }, [data, search]);

  const bulkAmount = Math.min(Math.max(parseInt(bulk, 10) || 0, 1), 100);

  const giveAll = async () => {
    const list = rows;
    if (list.length === 0) return;
    try {
      for (const r of list) {
        await grant.mutateAsync({ leaderId: r.leader_id, amount: bulkAmount });
      }
      showSuccess(`+${bulkAmount} slurker til ${list.length} ledere`);
    } catch {
      /* feil vises av onError */
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Beer className="h-5 w-5" />
            Del ut slurker
          </CardTitle>
          <CardDescription>
            Alle ledere har 10 slurker per sesong. Her kan du gi ekstra slurker til én leder – eller
            til alle i listen samtidig.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-24">
              <Input
                type="number"
                min={1}
                max={100}
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                aria-label="Antall slurker"
              />
            </div>
            <Button onClick={giveAll} disabled={grant.isPending || rows.length === 0}>
              <Plus className="mr-1.5 h-4 w-4" />
              Gi +{bulkAmount} til alle i listen ({rows.length})
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Søk etter leder…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ledere</CardTitle>
          <CardDescription>Gitt i sesongen • igjen å gi • ekstra tildelt</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading &&
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          {!isLoading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Ingen ledere funnet.</p>
          )}
          {rows.map((r) => (
            <div
              key={r.leader_id}
              className="flex items-center gap-3 rounded-xl border border-border/60 p-2.5"
            >
              <Avatar className="h-9 w-9 shrink-0">
                {r.profile_image_url ? (
                  <AvatarImage src={r.profile_image_url} alt={r.leader_name} />
                ) : null}
                <AvatarFallback className="text-[11px]">{initials(r.leader_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{r.leader_name}</p>
                <p className="text-xs text-muted-foreground">
                  Gitt {r.given} • igjen {r.sips_left}
                  {r.extra_sips > 0 ? ` • +${r.extra_sips} ekstra` : ''}
                </p>
              </div>
              {!r.is_active && (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  Inaktiv
                </Badge>
              )}
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  disabled={grant.isPending || r.extra_sips <= 0}
                  onClick={() => grant.mutate({ leaderId: r.leader_id, amount: -bulkAmount })}
                  aria-label={`Fjern ${bulkAmount} slurker`}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  className="h-8"
                  disabled={grant.isPending}
                  onClick={() => grant.mutate({ leaderId: r.leader_id, amount: bulkAmount })}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  {bulkAmount}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
