import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Trash2, Copy, ExternalLink } from 'lucide-react';
import { slugify } from '@/lib/gjenglemtConstants';
import { useCreatePeriod, useDeletePeriod, useGjenglemtPeriods, useUpdatePeriod, type GjenglemtPeriod } from '@/hooks/useGjenglemt';
import { useStatusPopup } from '@/hooks/useStatusPopup';

interface Props { open: boolean; onOpenChange: (o: boolean) => void; }

export function PeriodManageSheet({ open, onOpenChange }: Props) {
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const { data: periods = [] } = useGjenglemtPeriods();
  const createPeriod = useCreatePeriod();
  const updatePeriod = useUpdatePeriod();
  const deletePeriod = useDeletePeriod();

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) { showError('Skriv inn navn'); return; }
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
    const url = `${window.location.origin}/gjenglemt/${p.slug}`;
    navigator.clipboard.writeText(url).then(() => showInfo('Lenke kopiert'));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92dvh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>Perioder</SheetTitle>
          <SheetDescription>Hver periode får sin egen offentlige lenke.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {/* New */}
          <div className="rounded-xl border p-4 space-y-3 bg-muted/30">
            <div className="text-sm font-semibold">Ny periode</div>
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Navn</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="F.eks. Sommerleir uke 27" />
                {name && (
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Lenke: <span className="font-mono">/gjenglemt/{slugify(name) || '...'}</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Fra</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Til</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleCreate} disabled={createPeriod.isPending} className="w-full">
                {createPeriod.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Opprett</>}
              </Button>
            </div>
          </div>

          {/* List */}
          <div className="space-y-2">
            <div className="text-sm font-semibold">Eksisterende perioder</div>
            {periods.length === 0 && (
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
                <div className="flex items-center justify-between gap-2 pt-1">
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
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}