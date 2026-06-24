import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Settings2, Copy, ExternalLink, ChevronDown } from 'lucide-react';
import { useGjenglemtPeriods, useGjenglemtItems, useGjenglemtRealtime } from '@/hooks/useGjenglemt';
import { GjenglemtFilters } from '@/components/admin/gjenglemt/GjenglemtFilters';
import { ItemGrid } from '@/components/admin/gjenglemt/ItemGrid';
import { AddItemSheet } from '@/components/admin/gjenglemt/AddItemSheet';
import { PeriodManageSheet } from '@/components/admin/gjenglemt/PeriodManageSheet';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export default function Gjenglemt() {
  const navigate = useNavigate();
  const { isAdmin, leader } = useAuth();
  const { showInfo } = useStatusPopup();
  const { data: periods = [], isLoading: pLoading } = useGjenglemtPeriods();

  const [periodId, setPeriodId] = useState<string | null>(null);
  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const [garmentFilter, setGarmentFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'uavhentet' | 'hentet'>('uavhentet');
  const [addOpen, setAddOpen] = useState(false);
  const [periodSheetOpen, setPeriodSheetOpen] = useState(false);

  // Auto-select first period
  useEffect(() => {
    if (!periodId && periods.length > 0) setPeriodId(periods[0].id);
  }, [periods, periodId]);

  useGjenglemtRealtime(periodId);
  const { data: items = [], isLoading: iLoading } = useGjenglemtItems(periodId);

  const currentPeriod = useMemo(() => periods.find(p => p.id === periodId) ?? null, [periods, periodId]);

  const filtered = useMemo(() => {
    return items.filter(i =>
      (statusFilter === 'all' || i.status === statusFilter) &&
      (!colorFilter || i.color === colorFilter) &&
      (!garmentFilter || i.garment_type === garmentFilter)
    );
  }, [items, statusFilter, colorFilter, garmentFilter]);

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
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-heading font-bold truncate">Gjenglemt</h1>
            <p className="hidden sm:block text-sm text-muted-foreground">Registrer og del gjenglemte ting</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="default" size="sm" onClick={() => setAddOpen(true)} disabled={!currentPeriod}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline sm:ml-2">Nytt funn</span>
          </Button>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setPeriodSheetOpen(true)}>
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline sm:ml-2">Perioder</span>
            </Button>
          )}
        </div>
      </div>

      {/* Period selector + public link */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <Select value={periodId ?? ''} onValueChange={v => setPeriodId(v)}>
          <SelectTrigger className="w-auto min-w-[200px] flex-1 sm:flex-none">
            <SelectValue placeholder={pLoading ? 'Laster...' : 'Velg periode'} />
          </SelectTrigger>
          <SelectContent>
            {periods.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} {!p.is_public && '· skjult'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        {iLoading ? (
          <div className="text-center text-muted-foreground py-10 text-sm">Laster...</div>
        ) : currentPeriod ? (
          <ItemGrid items={filtered} canManageAll={isAdmin} />
        ) : (
          <div className="text-center text-muted-foreground py-10 text-sm">
            {isAdmin ? 'Opprett en periode for å komme i gang.' : 'Ingen perioder ennå. Be admin opprette en.'}
          </div>
        )}
      </div>

      <AddItemSheet open={addOpen} onOpenChange={setAddOpen} period={currentPeriod} />
      <PeriodManageSheet open={periodSheetOpen} onOpenChange={setPeriodSheetOpen} />
    </div>
  );
}