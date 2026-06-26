import { useState } from 'react';
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dices, Plus, Pencil, Trash2, Loader2, Search, Users } from 'lucide-react';
import {
  useRouletteTasks,
  useUpsertTask,
  useDeleteTask,
  useRouletteStats,
  type RouletteTask,
  type RouletteCategory,
} from '@/hooks/useRoulette';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { formatDistanceToNow } from 'date-fns';
import { nb } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const categoryLabel = (c: RouletteCategory) =>
  c === 'senior' ? 'Senior' : c === 'u18' ? 'U18' : 'Begge';

const categoryColor = (c: RouletteCategory) =>
  c === 'senior' ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
  : c === 'u18' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';

export function RouletteTasksTab() {
  const { showSuccess, showError } = useStatusPopup();
  const { data: tasks = [], isLoading } = useRouletteTasks();
  const { data: stats = [] } = useRouletteStats();
  const upsert = useUpsertTask();
  const del = useDeleteTask();

  const [editing, setEditing] = useState<RouletteTask | null>(null);
  const [open, setOpen] = useState(false);

  // Global enable toggle
  const qc = useQueryClient();
  const { data: enabledCfg } = useQuery({
    queryKey: ['app_config', 'roulette_enabled'],
    queryFn: async () => {
      const { data } = await supabase.from('app_config').select('value').eq('key', 'roulette_enabled').maybeSingle();
      return data?.value === 'true';
    },
  });
  const [enabled, setEnabled] = useState<boolean>(false);
  useEffect(() => { if (enabledCfg !== undefined) setEnabled(enabledCfg); }, [enabledCfg]);

  const toggleEnabled = async (v: boolean) => {
    setEnabled(v);
    const { error } = await supabase.from('app_config').upsert({ key: 'roulette_enabled', value: String(v) }, { onConflict: 'key' });
    if (error) { setEnabled(!v); showError('Kunne ikke lagre'); return; }
    qc.invalidateQueries({ queryKey: ['app_config', 'roulette_enabled'] });
    showSuccess(v ? 'Oppgave-roulette aktivert' : 'Oppgave-roulette deaktivert');
  };

  // Participating leaders
  const { data: leaders = [], refetch: refetchLeaders } = useQuery({
    queryKey: ['roulette-participants-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leaders')
        .select('id, name, profile_image_url, in_roulette, is_active')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
  const [search, setSearch] = useState('');
  const toggleLeader = async (id: string, next: boolean) => {
    // optimistic
    qc.setQueryData(['roulette-participants-admin'], (old: any) =>
      (old ?? []).map((l: any) => l.id === id ? { ...l, in_roulette: next } : l)
    );
    const { error } = await supabase.from('leaders').update({ in_roulette: next }).eq('id', id);
    if (error) { showError('Kunne ikke lagre'); refetchLeaders(); }
  };
  const setAll = async (next: boolean) => {
    qc.setQueryData(['roulette-participants-admin'], (old: any) => (old ?? []).map((l: any) => ({ ...l, in_roulette: next })));
    const ids = leaders.filter(l => filtered.some(f => f.id === l.id)).map(l => l.id);
    const { error } = await supabase.from('leaders').update({ in_roulette: next }).in('id', ids);
    if (error) { showError('Kunne ikke lagre'); refetchLeaders(); }
    else showSuccess(next ? 'Alle valgt' : 'Alle fjernet');
  };
  const filtered = leaders.filter(l => l.name?.toLowerCase().includes(search.toLowerCase()));
  const selectedCount = leaders.filter(l => l.in_roulette).length;

  const openNew = () => {
    setEditing({
      id: '', title: '', description: null, category: 'both',
      is_active: true, created_by: null,
      created_at: '', updated_at: '',
    } as unknown as RouletteTask);
    setOpen(true);
  };

  const openEdit = (t: RouletteTask) => { setEditing(t); setOpen(true); };

  const save = async () => {
    if (!editing) return;
    if (!editing.title.trim()) { showError('Tittel er påkrevd'); return; }
    try {
      await upsert.mutateAsync({
        id: editing.id || undefined,
        title: editing.title.trim(),
        description: editing.description?.trim() || null,
        category: editing.category as RouletteCategory,
        is_active: editing.is_active,
      });
      showSuccess('Lagret');
      setOpen(false);
    } catch (e: any) {
      showError(e?.message ?? 'Kunne ikke lagre');
    }
  };

  const remove = async (t: RouletteTask) => {
    if (!confirm(`Slette "${t.title}"?`)) return;
    try { await del.mutateAsync(t.id); showSuccess('Slettet'); }
    catch { showError('Kunne ikke slette'); }
  };

  const completedCount = stats.filter((s: any) => s.status === 'completed').length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dices className="w-5 h-5 text-primary" /> Vis Oppgave-roulette i appen
          </CardTitle>
          <CardDescription>
            Når dette er av, vises ikke Oppgave-roulette noen steder i appen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="font-medium text-sm">Aktivert</div>
              <div className="text-xs text-muted-foreground">Synlig kun for ledere du har valgt under.</div>
            </div>
            <Switch checked={enabled} onCheckedChange={toggleEnabled} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4" /> Hvem er med på rouletten
          </CardTitle>
          <CardDescription>{selectedCount} av {leaders.length} aktive ledere valgt</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Søk ledere…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setAll(true)}>Velg alle{search ? ' (filtrerte)' : ''}</Button>
            <Button variant="outline" size="sm" onClick={() => setAll(false)}>Fjern alle{search ? ' (filtrerte)' : ''}</Button>
          </div>
          <div className="max-h-[50vh] overflow-y-auto divide-y rounded-lg border">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3 text-center">Ingen ledere funnet.</p>
            ) : filtered.map(l => (
              <div key={l.id} className="flex items-center gap-3 p-2">
                <Avatar className="h-8 w-8">
                  {l.profile_image_url && <AvatarImage src={l.profile_image_url} />}
                  <AvatarFallback className="text-xs">{(l.name ?? '?').slice(0,2)}</AvatarFallback>
                </Avatar>
                <span className="flex-1 text-sm truncate">{l.name}</span>
                <Switch checked={!!l.in_roulette} onCheckedChange={v => toggleLeader(l.id, v)} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dices className="w-5 h-5 text-primary" /> Oppgave-roulette
          </CardTitle>
          <CardDescription>
            Legg inn oppgaver ledere får tilfeldig tildelt. Velg om en oppgave er for senior, U18 eller begge.
            <span className="block mt-1 text-xs">U18 = ledere i team 1F eller 2F.</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap items-center">
            <Button onClick={openNew}>
              <Plus className="w-4 h-4 mr-2" /> Ny oppgave
            </Button>
            <Badge variant="secondary">{tasks.length} oppgaver</Badge>
            <Badge variant="outline">{completedCount} fullført totalt</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Oppgaver</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Ingen oppgaver enda.</p>
          ) : tasks.map(t => (
            <div key={t.id} className={`border rounded-lg p-3 flex items-start gap-3 ${t.is_active ? '' : 'opacity-60'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{t.title}</span>
                  <Badge className={categoryColor(t.category as RouletteCategory)} variant="outline">
                    {categoryLabel(t.category as RouletteCategory)}
                  </Badge>
                  {!t.is_active && <Badge variant="outline">Inaktiv</Badge>}
                </div>
                {t.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{t.description}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(t)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Siste fullførte</CardTitle>
          <CardDescription>De siste oppgavene ledere har markert som gjort.</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.filter((s: any) => s.status === 'completed').length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen fullført enda.</p>
          ) : (
            <ul className="space-y-2">
              {stats.filter((s: any) => s.status === 'completed').slice(0, 20).map((s: any) => (
                <li key={s.id} className="flex items-center gap-3 text-sm">
                  <Avatar className="h-7 w-7">
                    {s.leader?.profile_image_url && <AvatarImage src={s.leader.profile_image_url} />}
                    <AvatarFallback className="text-xs">{(s.leader?.name ?? '?').slice(0,2)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="truncate">
                      <span className="font-medium">{s.leader?.name ?? 'Ukjent'}</span>
                      <span className="text-muted-foreground"> · {s.task?.title ?? 'Slettet oppgave'}</span>
                    </div>
                    {s.completed_at && (
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(s.completed_at), { addSuffix: true, locale: nb })}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-[85dvh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle>{editing?.id ? 'Rediger oppgave' : 'Ny oppgave'}</SheetTitle>
          </SheetHeader>
          {editing && (
            <div className="mt-4 space-y-4">
              <div>
                <Label>Tittel</Label>
                <Input
                  value={editing.title}
                  onChange={e => setEditing({ ...editing, title: e.target.value })}
                  placeholder="F.eks. Rydde båthuset"
                />
              </div>
              <div>
                <Label>Beskrivelse <span className="text-xs text-muted-foreground">(valgfritt)</span></Label>
                <Textarea
                  rows={4}
                  value={editing.description ?? ''}
                  onChange={e => setEditing({ ...editing, description: e.target.value })}
                  placeholder="Detaljer om oppgaven…"
                />
              </div>
              <div>
                <Label className="mb-2 block">Kategori</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['senior', 'u18', 'both'] as RouletteCategory[]).map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditing({ ...editing, category: c })}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        editing.category === c
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      {categoryLabel(c)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium text-sm">Aktiv</div>
                  <div className="text-xs text-muted-foreground">Inaktive oppgaver trekkes ikke ut.</div>
                </div>
                <Switch checked={editing.is_active} onCheckedChange={v => setEditing({ ...editing, is_active: v })} />
              </div>
              <div className="sticky bottom-0 -mx-6 px-6 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)] bg-background/95 backdrop-blur border-t">
                <Button onClick={save} disabled={upsert.isPending} className="w-full h-12 text-base">
                  {upsert.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Lagre'}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}