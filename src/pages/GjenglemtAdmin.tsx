import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { colorMeta, garmentLabel } from '@/lib/gjenglemtConstants';
import { Loader2, Lock, Search, Trash2, CheckCircle2, RotateCcw, LogOut, X } from 'lucide-react';
import { toast } from 'sonner';
import backgroundAsset from '@/assets/oksnoen-header.png.asset.json';

const SS_KEY = 'gjenglemt-admin-pw';

type Period = {
  id: string; name: string; slug: string;
  start_date: string | null; end_date: string | null; is_active: boolean;
};
type Item = {
  id: string; period_id: string; image_url: string; signed_url: string | null;
  garment_type: string | null; color: string | null; owner_name: string | null;
  comment: string | null; notes: string | null; status: 'uavhentet' | 'hentet';
  bag_label: string | null; item_number: number | null;
  ai_description: string | null; ai_tags: string[]; created_at: string;
};

async function callAdmin(password: string, action: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('gjenglemt-admin', {
    body: { password, action, ...extra },
  });
  if (error) {
    // Try to surface message from response body if present
    const msg = (error as any)?.context?.error || error.message || 'Feil';
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function GjenglemtAdmin() {
  const [password, setPassword] = useState<string>(() => {
    try { return sessionStorage.getItem(SS_KEY) ?? ''; } catch { return ''; }
  });
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'uavhentet' | 'hentet'>('all');
  const [query, setQuery] = useState('');
  const [lightbox, setLightbox] = useState<Item | null>(null);

  useEffect(() => {
    document.title = 'Gjenglemt-arkiv | Øksnøen';
  }, []);

  const load = async (pw: string) => {
    setLoading(true);
    try {
      const data = await callAdmin(pw, 'list');
      setPeriods(data.periods ?? []);
      setItems(data.items ?? []);
    } catch (e: any) {
      toast.error(e.message);
      if (/passord/i.test(e.message)) {
        setPassword('');
        try { sessionStorage.removeItem(SS_KEY); } catch {}
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (password) load(password);
     
  }, [password]);

  const tryUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwLoading(true);
    try {
      await callAdmin(pwInput.trim(), 'list');
      setPassword(pwInput.trim());
      try { sessionStorage.setItem(SS_KEY, pwInput.trim()); } catch {}
    } catch (err: any) {
      setPwError(err.message || 'Feil passord');
    } finally {
      setPwLoading(false);
    }
  };

  const logout = () => {
    setPassword('');
    setPwInput('');
    try { sessionStorage.removeItem(SS_KEY); } catch {}
  };

  const periodMap = useMemo(() => {
    const m: Record<string, Period> = {};
    periods.forEach(p => { m[p.id] = p; });
    return m;
  }, [periods]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(i =>
      (periodFilter === 'all' || i.period_id === periodFilter) &&
      (statusFilter === 'all' || i.status === statusFilter) &&
      (!q || matchesQuery(i, q))
    );
  }, [items, periodFilter, statusFilter, query]);

  const toggleStatus = async (item: Item) => {
    const next = item.status === 'hentet' ? 'uavhentet' : 'hentet';
    // Optimistic
    setItems(prev => prev.map(x => x.id === item.id ? { ...x, status: next } : x));
    try {
      await callAdmin(password, 'update', { id: item.id, patch: { status: next } });
      toast.success(next === 'hentet' ? 'Markert som hentet' : 'Markert som uavhentet');
    } catch (e: any) {
      toast.error(e.message);
      setItems(prev => prev.map(x => x.id === item.id ? item : x));
    }
  };

  const deleteItem = async (item: Item) => {
    if (!confirm(`Slette #${item.item_number ?? ''} ${item.garment_type ? garmentLabel(item.garment_type) : ''}?`)) return;
    const prev = items;
    setItems(items.filter(x => x.id !== item.id));
    if (lightbox?.id === item.id) setLightbox(null);
    try {
      await callAdmin(password, 'delete', { id: item.id });
      toast.success('Slettet');
    } catch (e: any) {
      toast.error(e.message);
      setItems(prev);
    }
  };

  const stats = useMemo(() => {
    return {
      total: items.length,
      hentet: items.filter(i => i.status === 'hentet').length,
      uavhentet: items.filter(i => i.status === 'uavhentet').length,
    };
  }, [items]);

  if (!password) {
    return (
      <div className="min-h-[100dvh] relative bg-cover bg-center bg-no-repeat bg-fixed" style={{ backgroundImage: `url(${backgroundAsset.url})` }}>
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 min-h-[100dvh] flex items-center justify-center p-6">
          <form onSubmit={tryUnlock} className="w-full max-w-sm rounded-2xl border bg-card/85 backdrop-blur p-6 space-y-4 shadow-lg">
            <div className="flex flex-col items-center text-center gap-2">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-xl font-bold">Gjenglemt-arkiv</h1>
              <p className="text-sm text-muted-foreground">Passord kreves for tilgang.</p>
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                autoFocus
                value={pwInput}
                onChange={e => { setPwInput(e.target.value); setPwError(''); }}
                placeholder="Passord"
                className={pwError ? 'border-destructive' : ''}
              />
              {pwError && <p className="text-xs text-destructive">{pwError}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={pwLoading || !pwInput.trim()}>
              {pwLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lås opp'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b bg-card sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-heading font-bold">Gjenglemt-arkiv</h1>
            <p className="text-xs text-muted-foreground">
              {stats.total} totalt · {stats.uavhentet} uavhentet · {stats.hentet} hentet
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4 mr-1" /> Logg ut
          </Button>
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Søk navn, pose, plagg, farge, notater…" className="pl-9" />
          </div>
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-auto min-w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle perioder</SelectItem>
              {periods.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}{p.is_active ? ' (aktiv)' : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex rounded-md border overflow-hidden">
            {(['all','uavhentet','hentet'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={
                  statusFilter === s
                    ? 'px-3 py-2 text-sm bg-primary text-primary-foreground'
                    : 'px-3 py-2 text-sm hover:bg-muted'
                }
              >
                {s === 'all' ? 'Alle' : s === 'uavhentet' ? 'Uavhentet' : 'Hentet'}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => load(password)} disabled={loading}>
            <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4">
        {loading && items.length === 0 ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-16">Ingen treff.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filtered.map(item => {
              const c = item.color ? colorMeta(item.color) : null;
              const period = periodMap[item.period_id];
              const picked = item.status === 'hentet';
              return (
                <div key={item.id} className={`rounded-xl border overflow-hidden bg-card flex flex-col ${picked ? 'opacity-70' : ''}`}>
                  <button onClick={() => setLightbox(item)} className="aspect-square bg-muted relative block text-left">
                    {item.signed_url ? (
                      <img src={item.signed_url} alt={item.garment_type ?? 'Gjenglemt'} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Bilde mangler</div>
                    )}
                    {item.item_number != null && (
                      <span className="absolute top-1.5 left-1.5 inline-flex items-center rounded-md bg-foreground/85 text-background px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                        #{item.item_number}
                      </span>
                    )}
                    {picked && (
                      <div className="absolute inset-0 bg-background/40 flex items-center justify-center">
                        <span className="bg-green-600 text-white text-xs font-semibold px-2 py-1 rounded-md flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Hentet
                        </span>
                      </div>
                    )}
                  </button>
                  <div className="p-2.5 space-y-1 flex-1 flex flex-col">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {c && (
                        <span
                          className="h-4 w-4 rounded-full border shrink-0"
                          style={c.hex.startsWith('#') ? { backgroundColor: c.hex } : { background: c.hex }}
                        />
                      )}
                      <span className="text-sm font-medium truncate">
                        {item.garment_type ? garmentLabel(item.garment_type) : 'Ukjent'}
                      </span>
                    </div>
                    {period && (
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{period.name}</div>
                    )}
                    {item.owner_name && <div className="text-[11px] text-primary truncate">👤 {item.owner_name}</div>}
                    {item.bag_label && <div className="text-[11px] text-muted-foreground truncate">📦 Pose {item.bag_label}</div>}
                    <div className="flex gap-1 pt-1 mt-auto">
                      <Button size="sm" variant={picked ? 'outline' : 'default'} className="flex-1 h-8 text-xs" onClick={() => toggleStatus(item)}>
                        {picked ? 'Angre' : 'Hentet'}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => deleteItem(item)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur overflow-y-auto" onClick={() => setLightbox(null)}>
          <div className="min-h-full flex items-start sm:items-center justify-center p-4">
            <div className="max-w-2xl w-full relative bg-card border rounded-2xl p-4 space-y-3" onClick={e => e.stopPropagation()}>
              <button className="absolute top-2 right-2 z-10 bg-background/90 border rounded-full p-2" onClick={() => setLightbox(null)}>
                <X className="h-5 w-5" />
              </button>
              {lightbox.signed_url && (
                <img src={lightbox.signed_url} alt={lightbox.garment_type ?? 'Gjenglemt'} className="w-full max-h-[60dvh] object-contain rounded-xl" />
              )}
              <div className="space-y-1 text-sm">
                <div className="font-medium">
                  {lightbox.item_number != null && <span className="mr-2 inline-block rounded bg-foreground text-background px-2 py-0.5 text-xs">#{lightbox.item_number}</span>}
                  {lightbox.garment_type ? garmentLabel(lightbox.garment_type) : 'Ukjent'}
                  {lightbox.color && ` – ${colorMeta(lightbox.color).label}`}
                </div>
                <div className="text-xs text-muted-foreground">Periode: {periodMap[lightbox.period_id]?.name ?? '—'}</div>
                {lightbox.owner_name && <div>Navn: <span className="font-medium">{lightbox.owner_name}</span></div>}
                {lightbox.bag_label && <div>Pose: <span className="font-medium">{lightbox.bag_label}</span></div>}
                {lightbox.ai_description && <div className="text-muted-foreground">{lightbox.ai_description}</div>}
                {lightbox.notes && <div className="italic text-muted-foreground">📝 {lightbox.notes}</div>}
                {lightbox.ai_tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {lightbox.ai_tags.map(t => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground pt-1">Lagt til: {new Date(lightbox.created_at).toLocaleString('nb-NO')}</div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button className="flex-1" onClick={() => toggleStatus(lightbox)}>
                  {lightbox.status === 'hentet' ? 'Marker uavhentet' : 'Marker som hentet'}
                </Button>
                <Button variant="destructive" onClick={() => deleteItem(lightbox)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Slett
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function matchesQuery(i: Item, q: string) {
  const fields: string[] = [];
  if (i.garment_type) fields.push(i.garment_type, garmentLabel(i.garment_type).toLowerCase());
  if (i.color) fields.push(i.color, colorMeta(i.color).label.toLowerCase());
  if (i.notes) fields.push(i.notes.toLowerCase());
  if (i.owner_name) fields.push(i.owner_name.toLowerCase());
  if (i.bag_label) fields.push(i.bag_label.toLowerCase());
  if (i.ai_description) fields.push(i.ai_description.toLowerCase());
  if (i.ai_tags?.length) fields.push(...i.ai_tags.map(t => t.toLowerCase()));
  return fields.some(f => f.includes(q));
}