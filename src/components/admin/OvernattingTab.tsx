import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Save, Bed, Users } from 'lucide-react';
import { useStatusPopup } from '@/hooks/useStatusPopup';

interface Row {
  leader_id: string;
  is_joining: boolean;
  updated_at: string;
  leader: { id: string; name: string; team: string | null; profile_image_url: string | null } | null;
}

export function OvernattingTab() {
  const { showSuccess, showError } = useStatusPopup();
  const [enabled, setEnabled] = useState(false);
  const [title, setTitle] = useState('Overnatting');
  const [question, setQuestion] = useState('Vil du være med på overnatting?');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [cfg, resp] = await Promise.all([
        supabase.from('app_config').select('key,value').in('key', ['overnatting_enabled', 'overnatting_title', 'overnatting_question']),
        supabase.from('overnatting_responses').select('leader_id,is_joining,updated_at,leader:leaders(id,name,team,profile_image_url)').order('updated_at', { ascending: false }),
      ]);
      const map = new Map((cfg.data || []).map((r: { key: string; value: string }) => [r.key, r.value]));
      setEnabled(map.get('overnatting_enabled') === 'true');
      setTitle(map.get('overnatting_title') || 'Overnatting');
      setQuestion(map.get('overnatting_question') || 'Vil du være med på overnatting?');
      setRows((resp.data || []) as unknown as Row[]);
    } catch (e) {
      console.error(e);
      showError('Kunne ikke laste data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel('overnatting-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'overnatting_responses' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const saveConfig = async (next: { enabled?: boolean; title?: string; question?: string }) => {
    setSaving(true);
    try {
      const updates: { key: string; value: string }[] = [];
      if (next.enabled !== undefined) updates.push({ key: 'overnatting_enabled', value: String(next.enabled) });
      if (next.title !== undefined) updates.push({ key: 'overnatting_title', value: next.title });
      if (next.question !== undefined) updates.push({ key: 'overnatting_question', value: next.question });
      const { error } = await supabase.from('app_config').upsert(
        updates.map(u => ({ ...u, updated_at: new Date().toISOString() })),
        { onConflict: 'key' }
      );
      if (error) throw error;
      showSuccess('Lagret');
    } catch (e) {
      console.error(e);
      showError('Kunne ikke lagre');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton className="h-64" />;

  const joining = rows.filter(r => r.is_joining);
  const notJoining = rows.filter(r => !r.is_joining);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bed className="h-5 w-5" />Innstillinger</CardTitle>
          <CardDescription>Vis en toggle på lederenes hjemskjerm der de kan svare ja/nei på overnatting.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Aktiver på hjemskjermen</Label>
              <p className="text-xs text-muted-foreground">Når på, ser alle ledere kortet og kan svare.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={async (v) => {
              setEnabled(v);
              if (v) {
                // Reset all previous responses when re-enabling so new ledere starts fresh
                const { error } = await supabase.from('overnatting_responses').delete().neq('leader_id', '00000000-0000-0000-0000-000000000000');
                if (error) {
                  console.error(error);
                  showError('Kunne ikke nullstille svar');
                } else {
                  setRows([]);
                  showSuccess('Svar nullstilt');
                }
              }
              saveConfig({ enabled: v });
            }} />
          </div>
          <div className="space-y-2">
            <Label>Tittel</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Spørsmål</Label>
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} />
          </div>
          <Button onClick={() => saveConfig({ title, question })} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Lagre tekst
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Vil være med ({joining.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {joining.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen har svart ja enda.</p>
          ) : (
            <ul className="divide-y">
              {joining.map(r => (
                <li key={r.leader_id} className="py-2 flex items-center justify-between gap-2">
                  <span className="font-medium">{r.leader?.name ?? r.leader_id}</span>
                  {r.leader?.team && <Badge variant="secondary">{r.leader.team}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {notJoining.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">Svart nei ({notJoining.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {notJoining.map(r => (
                <li key={r.leader_id} className="py-2 text-sm text-muted-foreground">{r.leader?.name ?? r.leader_id}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}