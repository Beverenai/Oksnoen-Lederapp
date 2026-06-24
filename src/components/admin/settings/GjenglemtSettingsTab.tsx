import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Trash2, Copy, ExternalLink, Shirt } from 'lucide-react';
import {
  useCreatePeriod,
  useDeletePeriod,
  useGjenglemtPeriods,
  useUpdatePeriod,
  type GjenglemtPeriod,
} from '@/hooks/useGjenglemt';
import { slugify } from '@/lib/gjenglemtConstants';
import { useStatusPopup } from '@/hooks/useStatusPopup';

export function GjenglemtSettingsTab() {
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const { data: periods = [], isLoading } = useGjenglemtPeriods();
  const createPeriod = useCreatePeriod();
  const updatePeriod = useUpdatePeriod();
  const deletePeriod = useDeletePeriod();

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) { showError('Skriv inn navn på perioden'); return; }
    const slug = slugify(name);
    if (!slug) { showError('Ugyldig navn'); return; }
    try {
      await createPeriod.mutateAsync({
        name: name.trim(),
        slug,
        start_date: startDate || null,
        end_date: endDate || null,
        is_public: true,
      });
      setName(''); setStartDate(''); setEndDate('');
      showSuccess('Periode opprettet');
    } catch (e: any) {
      showError(e?.message ?? 'Kunne ikke opprette');
    }
  };

  const handleTogglePublic = async (p: GjenglemtPeriod) => {
    try { await updatePeriod.mutateAsync({ id: p.id, is_public: !p.is_public }); }
    catch (e: any) { showError(e?.message ?? 'Kunne ikke oppdatere'); }
  };

  const handleDelete = async (p: GjenglemtPeriod) => {
    if (!confirm(`Slette perioden "${p.name}"? Alle gjenglemte ting i denne perioden slettes også.`)) return;
    try { await deletePeriod.mutateAsync(p.id); showSuccess('Periode slettet'); }
    catch (e: any) { showError(e?.message ?? 'Kunne ikke slette'); }
  };

  const copyLink = (p: GjenglemtPeriod) => {
    const url = `https://app.oksnoen.com/gjenglemt/${p.slug}`;
    navigator.clipboard.writeText(url).then(() => showInfo('Lenke kopiert'));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shirt className="h-5 w-5" /> Ny periode</CardTitle>
          <CardDescription>
            Hver periode får sin egen offentlige lenke som du kan dele.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="g-name">Navn på periode</Label>
            <Input
              id="g-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="F.eks. Sommerleir uke 27"
            />
            {name && (
              <div className="text-xs text-muted-foreground mt-1">
                Offentlig lenke: <span className="font-mono">/gjenglemt/{slugify(name) || '...'}</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="g-from" className="text-xs">Fra (valgfritt)</Label>
              <Input id="g-from" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="g-to" className="text-xs">Til (valgfritt)</Label>
              <Input id="g-to" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={createPeriod.isPending} className="w-full sm:w-auto">
            {createPeriod.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Opprett periode</>}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eksisterende perioder</CardTitle>
          <CardDescription>Slå av synlighet for å gjemme den offentlige lenken.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {!isLoading && periods.length === 0 && (
            <div className="text-sm text-muted-foreground italic">Ingen perioder ennå.</div>
          )}
          {periods.map(p => (
            <div key={p.id} className="rounded-xl border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.start_date && new Date(p.start_date).toLocaleDateString('nb-NO')}
                    {p.start_date && p.end_date && ' – '}
                    {p.end_date && new Date(p.end_date).toLocaleDateString('nb-NO')}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">/gjenglemt/{p.slug}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(p)} className="text-destructive hover:text-destructive shrink-0">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                <div className="flex items-center gap-2">
                  <Switch checked={p.is_public} onCheckedChange={() => handleTogglePublic(p)} />
                  <span className="text-xs text-muted-foreground">{p.is_public ? 'Offentlig lenke aktiv' : 'Skjult'}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => copyLink(p)} disabled={!p.is_public}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Kopier
                  </Button>
                  <Button variant="outline" size="sm" asChild disabled={!p.is_public}>
                    <a href={`/gjenglemt/${p.slug}`} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}