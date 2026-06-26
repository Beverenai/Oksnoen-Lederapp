import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Copy, ExternalLink, ChevronDown, Search, Loader2 } from 'lucide-react';
import { useActivePeriod, useGjenglemtItems, useGjenglemtRealtime } from '@/hooks/useGjenglemt';
import { GjenglemtFilters } from '@/components/admin/gjenglemt/GjenglemtFilters';
import { ItemGrid } from '@/components/admin/gjenglemt/ItemGrid';
import { AddItemSheet } from '@/components/admin/gjenglemt/AddItemSheet';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { Input } from '@/components/ui/input';
import { garmentLabel, colorMeta } from '@/lib/gjenglemtConstants';

export default function Gjenglemt() {
  const navigate = useNavigate();
  const { isAdmin, leader } = useAuth();
  const { showInfo } = useStatusPopup();
  const { data: currentPeriod = null, isLoading: pLoading } = useActivePeriod();

  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const [garmentFilter, setGarmentFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'uavhentet' | 'hentet'>('uavhentet');
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const periodId = currentPeriod?.id ?? null;
  useGjenglemtRealtime(periodId);
  const { data: items = [], isLoading: iLoading } = useGjenglemtItems(periodId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(i =>
      (statusFilter === 'all' || i.status === statusFilter) &&
      (!colorFilter || i.color === colorFilter) &&
      (!garmentFilter || i.garment_type === garmentFilter) &&
      (!q || matchesQuery(i, q))
    );
  }, [items, statusFilter, colorFilter, garmentFilter, query]);

  if (!leader) {
    return <div className="p-6 text-center text-muted-foreground">Du må være innlogget.</div>;
  }

  const copyPublicLink = () => {
    if (!currentPeriod) return;
    const url = `${window.location.origin}/gjenglemt/${currentPeriod.slug}`;
    navigator.clipboard.writeText(url).then(() => showInfo('Lenke kopiert'));
  };

  return (
    <div className="flex flex-col animate-fade-in min-h-[calc(100dvh-140px)] gap-3">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-heading font-bold truncate">Gjenglemt</h1>
            <p className="hidden sm:block text-sm text-muted-foreground">Ta bilde – AI gjenkjenner plagget</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="default" size="sm" onClick={() => setAddOpen(true)} disabled={!currentPeriod}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline sm:ml-2">Nytt funn</span>
          </Button>
        </div>
      </div>

      {/* Active period badge + public link */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <div className="px-3 py-1.5 rounded-md border bg-muted/40 text-sm font-medium">
          {pLoading ? (
            <span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Laster…</span>
          ) : currentPeriod ? (
            `Aktiv: ${currentPeriod.name}`
          ) : (
            'Ingen aktiv periode'
          )}
        </div>
        {currentPeriod?.is_public && (
          <>
            <Button variant="outline" size="sm" onClick={copyPublicLink}>
              <Copy className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Kopier lenke</span>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={`/gjenglemt/${currentPeriod.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Åpne offentlig side</span>
              </a>
            </Button>
          </>
        )}
      </div>

      {/* Search */}
      <div className="relative shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Søk etter plagg, farge, notater…"
          className="pl-9"
        />
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 shrink-0 border-b">
        {([
          ['uavhentet', 'Uavhentet'],
          ['hentet', 'Hentet'],
          ['all', 'Alle'],
        ] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setStatusFilter(v)}
            className={
              statusFilter === v
                ? 'px-3 py-2 text-sm font-medium border-b-2 border-primary text-foreground -mb-px'
                : 'px-3 py-2 text-sm text-muted-foreground hover:text-foreground'
            }
          >
            {label}
          </button>
        ))}
      </div>

      <details className="shrink-0 rounded-lg border bg-muted/30">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium flex items-center gap-2">
          <ChevronDown className="h-4 w-4" /> Filtre {(colorFilter || garmentFilter) && <span className="ml-1 text-xs text-primary">(aktive)</span>}
        </summary>
        <div className="p-3 pt-1">
          <GjenglemtFilters
            color={colorFilter}
            garment={garmentFilter}
            onColor={setColorFilter}
            onGarment={setGarmentFilter}
          />
        </div>
      </details>

      <div className="flex-1 min-h-0">
        {pLoading || (currentPeriod && iLoading) ? (
          <div className="text-center text-muted-foreground py-10 text-sm">Laster...</div>
        ) : currentPeriod ? (
          <ItemGrid items={filtered} canManageAll={isAdmin} />
        ) : (
          <div className="text-center text-muted-foreground py-10 text-sm">
            {isAdmin
              ? 'Ingen aktiv periode. Sett en aktiv i Admin → Periode.'
              : 'Ingen aktiv periode ennå. Be admin sette en aktiv periode.'}
          </div>
        )}
      </div>

      <AddItemSheet open={addOpen} onOpenChange={setAddOpen} period={currentPeriod} />
    </div>
  );
}

function matchesQuery(i: { garment_type: string | null; color: string | null; notes: string | null; ai_description: string | null; ai_tags: string[] }, q: string) {
  const fields: string[] = [];
  if (i.garment_type) fields.push(i.garment_type, garmentLabel(i.garment_type).toLowerCase());
  if (i.color) fields.push(i.color, colorMeta(i.color).label.toLowerCase());
  if (i.notes) fields.push(i.notes.toLowerCase());
  if (i.ai_description) fields.push(i.ai_description.toLowerCase());
  if (i.ai_tags?.length) fields.push(...i.ai_tags.map(t => t.toLowerCase()));
  return fields.some(f => f.includes(q));
}