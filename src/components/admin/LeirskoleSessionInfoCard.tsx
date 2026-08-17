import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Send, Trash2, Eye } from 'lucide-react';

type Props = {
  weekId: string;
  staff: { id: string; leader_id: string; leader?: { name: string } | null }[];
};

/**
 * Øktinfo til de som jobber leirskole – samme idé som «Denne økten skal du»
 * i vanlig app: én beskjed + punktliste, til alle eller utvalgte ledere.
 */
export function LeirskoleSessionInfoCard({ weekId, staff }: Props) {
  const qc = useQueryClient();
  const { leader } = useAuth();
  const { showError } = useStatusPopup();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [itemsText, setItemsText] = useState('');
  const [assignAll, setAssignAll] = useState(true);
  const [leaderIds, setLeaderIds] = useState<string[]>([]);
  const [notify, setNotify] = useState(true);

  const { data: info } = useQuery({
    queryKey: ['leirskole-admin-session-info', weekId],
    enabled: !!weekId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leirskole_session_info')
        .select('*')
        .eq('week_id', weekId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: reads } = useQuery({
    queryKey: ['leirskole-admin-session-reads', weekId],
    enabled: !!weekId,
    queryFn: async () => {
      const { data, error } = await supabase.from('leirskole_session_info_reads').select('info_id');
      if (error) throw error;
      return data ?? [];
    },
  });

  const readCount = useMemo(() => {
    const map = new Map<string, number>();
    (reads ?? []).forEach((r: any) => map.set(r.info_id, (map.get(r.info_id) ?? 0) + 1));
    return map;
  }, [reads]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['leirskole-admin-session-info'] });
    qc.invalidateQueries({ queryKey: ['leirskole-admin-session-reads'] });
    qc.invalidateQueries({ queryKey: ['leirskole-session-info'] });
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('Øktinfoen må ha en tittel');
      if (!assignAll && leaderIds.length === 0) throw new Error('Velg minst én leder');
      const items = itemsText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const { error } = await supabase.from('leirskole_session_info').insert({
        week_id: weekId,
        title: title.trim(),
        body: body.trim() || null,
        items,
        assign_all: assignAll,
        assigned_leader_ids: assignAll ? [] : leaderIds,
        created_by: leader?.id ?? null,
      });
      if (error) throw error;

      if (notify) {
        const targets = assignAll ? staff.map((s) => s.leader_id) : leaderIds;
        if (targets.length) {
          await supabase.functions
            .invoke('push-send', {
              body: {
                title: 'Leirskole – øktinfo',
                message: title.trim(),
                url: '/leirskole',
                leader_ids: targets,
                include_inactive: true,
                sender_leader_id: leader?.id,
              },
            })
            .catch(() => null);
        }
      }
    },
    onSuccess: () => {
      toast.success('Øktinfo lagt ut');
      setTitle('');
      setBody('');
      setItemsText('');
      setLeaderIds([]);
      invalidate();
    },
    onError: (e: any) => showError(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leirskole_session_info').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Slettet');
      invalidate();
    },
    onError: (e: any) => showError(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Megaphone className="h-4 w-4 text-primary" /> Øktinfo til leirskolelederne
        </CardTitle>
        <CardDescription>
          Vises øverst på leirskole-hjem hos de det gjelder – som «Denne økten skal du» i vanlig app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Tittel</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Denne økten skal du…" />
          </div>
          <div>
            <Label className="text-xs">Beskjed (valgfritt)</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Kort påminnelse" />
          </div>
          <div>
            <Label className="text-xs">Punkter – én per linje</Label>
            <Textarea
              value={itemsText}
              onChange={(e) => setItemsText(e.target.value)}
              rows={3}
              placeholder={'Møt på kaia 08:45\nTa med regntøy'}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border bg-card/50 px-3 py-2">
          <span className="text-sm">Til alle på uken</span>
          <Switch checked={assignAll} onCheckedChange={setAssignAll} />
        </div>

        {!assignAll && (
          <div className="flex flex-wrap gap-2">
            {staff.map((s) => {
              const on = leaderIds.includes(s.leader_id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    setLeaderIds((prev) =>
                      prev.includes(s.leader_id) ? prev.filter((x) => x !== s.leader_id) : [...prev, s.leader_id],
                    )
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    on ? 'bg-primary text-primary-foreground' : 'bg-card/60 text-muted-foreground'
                  }`}
                >
                  {s.leader?.name ?? 'Ukjent'}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between rounded-xl border bg-card/50 px-3 py-2">
          <span className="text-sm">Send push-varsling</span>
          <Switch checked={notify} onCheckedChange={setNotify} />
        </div>

        <Button className="w-full gap-2" onClick={() => create.mutate()} disabled={create.isPending}>
          <Send className="h-4 w-4" /> {create.isPending ? 'Legger ut…' : 'Legg ut øktinfo'}
        </Button>

        <div className="space-y-2 pt-1">
          {(info ?? []).map((i: any) => (
            <div key={i.id} className="rounded-xl border bg-card/40 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{i.title}</p>
                  {i.body && <p className="mt-0.5 text-xs text-muted-foreground">{i.body}</p>}
                  {(i.items ?? []).length > 0 && (
                    <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                      {(i.items as string[]).map((it, idx) => (
                        <li key={idx}>{it}</li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      {i.assign_all ? 'Alle på uken' : `${(i.assigned_leader_ids ?? []).length} ledere`}
                    </Badge>
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <Eye className="h-3 w-3" /> {readCount.get(i.id) ?? 0} lest
                    </Badge>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => remove.mutate(i.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {(info ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">Ingen øktinfo lagt ut for denne uken ennå.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}