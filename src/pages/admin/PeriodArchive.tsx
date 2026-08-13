import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Archive, FileSpreadsheet, Loader2, Printer } from 'lucide-react';
import { archiveGroups, datasetsForGroup, archiveDatasets, type ArchiveRow } from '@/lib/archiveDatasets';
import { downloadWorkbook } from '@/lib/archiveExport';
import { ArchiveDatasetCard } from '@/components/archive/ArchiveDatasetCard';

interface Period {
  id: string;
  name: string;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  season_year: number;
}

export default function PeriodArchive() {
  const navigate = useNavigate();
  const { isAdmin, isNurse } = useAuth();
  const { showError, showSuccess } = useStatusPopup();
  const [periodId, setPeriodId] = useState<string>('');
  const [year, setYear] = useState<number | null>(null);
  const [group, setGroup] = useState<string>('participants');
  const [exporting, setExporting] = useState(false);

  const { data: periods = [], isLoading } = useQuery({
    queryKey: ['archive', 'periods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('periods')
        .select('id,name,is_active,start_date,end_date,season_year')
        .order('start_date', { ascending: true });
      if (error) throw error;
      return (data || []) as Period[];
    },
    staleTime: 60_000,
  });

  const years = useMemo(
    () => Array.from(new Set(periods.map((p) => p.season_year))).sort((a, b) => b - a),
    [periods],
  );

  useEffect(() => {
    if (year === null && years.length) {
      const active = periods.find((p) => p.is_active);
      setYear(active?.season_year ?? years[0]);
    }
  }, [years, periods, year]);

  const yearPeriods = useMemo(
    () => (year === null ? periods : periods.filter((p) => p.season_year === year)),
    [periods, year],
  );

  useEffect(() => {
    if (!yearPeriods.length) {
      if (periodId) setPeriodId('');
      return;
    }
    if (!yearPeriods.some((p) => p.id === periodId)) {
      setPeriodId((yearPeriods.find((p) => p.is_active) ?? yearPeriods[0]).id);
    }
  }, [yearPeriods, periodId]);

  const period = useMemo(() => periods.find((p) => p.id === periodId) ?? null, [periods, periodId]);
  const datasets = useMemo(() => datasetsForGroup(group), [group]);

  const exportAll = async () => {
    if (!period) return;
    setExporting(true);
    try {
      const sheets = [];
      for (const ds of archiveDatasets) {
        const rows = await ds.fetch(period.id);
        sheets.push({ name: ds.label, rows });
      }
      await downloadWorkbook(sheets, `${period.name.replace(/\s+/g, '-')}-arkiv.xlsx`);
      showSuccess('Eksport lastet ned');
    } catch (e) {
      console.error(e);
      showError('Kunne ikke eksportere');
    } finally {
      setExporting(false);
    }
  };

  const exportSeason = async () => {
    if (!yearPeriods.length) return;
    setExporting(true);
    try {
      const sheets: { name: string; rows: ArchiveRow[] }[] = [];
      for (const ds of archiveDatasets) {
        const rows: ArchiveRow[] = [];
        for (const p of yearPeriods) {
          const part = await ds.fetch(p.id);
          part.forEach((r) => rows.push({ Periode: p.name, ...r }));
        }
        sheets.push({ name: ds.label, rows });
      }
      await downloadWorkbook(sheets, `Sesong-${year}-arkiv.xlsx`);
      showSuccess(`Hele sesongen ${year} lastet ned`);
    } catch (e) {
      console.error(e);
      showError('Kunne ikke eksportere sesongen');
    } finally {
      setExporting(false);
    }
  };

  if (!isAdmin && !isNurse) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Du har ikke tilgang til periodearkivet.
      </div>
    );
  }

  return (
    <div className="min-h-full pb-24">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Archive className="h-5 w-5" /> Periodearkiv
          </h1>
        </div>

        <Card className="p-4 space-y-4">
          <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            Se all lagret data fra en tidligere sesong og periode. Alt blir liggende lagret år etter år, så du
            kan hente det fram når som helst. Å velge sesong eller periode her endrer <strong>ikke</strong> aktiv
            periode eller noen innstillinger.
          </p>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Laster perioder...
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
              <Select
                value={year === null ? '' : String(year)}
                onValueChange={(v) => setYear(Number(v))}
              >
                <SelectTrigger className="w-[130px] rounded-xl">
                  <SelectValue placeholder="År" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      Sesong {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={periodId} onValueChange={setPeriodId}>
                <SelectTrigger className="w-[200px] rounded-xl">
                  <SelectValue placeholder="Velg periode" />
                </SelectTrigger>
                <SelectContent>
                  {yearPeriods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.is_active ? ' (aktiv)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {period?.start_date && (
                <Badge variant="secondary" className="rounded-full">
                  {new Date(period.start_date).toLocaleDateString('nb-NO')}
                  {period.end_date ? ` – ${new Date(period.end_date).toLocaleDateString('nb-NO')}` : ''}
                </Badge>
              )}
              </div>
              <div className="flex flex-wrap gap-2 print:hidden sm:justify-end">
                <Button size="sm" variant="outline" onClick={() => window.print()} disabled={!period}>
                  <Printer className="h-4 w-4 mr-1" /> Print / PDF
                </Button>
                <Button size="sm" variant="outline" onClick={exportSeason} disabled={!yearPeriods.length || exporting}>
                  {exporting ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 mr-1" />
                  )}
                  Hele sesongen
                </Button>
                <Button size="sm" onClick={exportAll} disabled={!period || exporting}>
                  {exporting ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 mr-1" />
                  )}
                  Eksporter alt
                </Button>
              </div>
            </div>
          )}
        </Card>

        <div className="-mx-4 px-4 print:hidden">
          <div className="flex gap-1.5 overflow-x-auto rounded-2xl bg-muted/50 p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {archiveGroups.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setGroup(g.key)}
                className={cn(
                  'whitespace-nowrap rounded-xl px-3 py-1.5 text-[13px] font-medium transition-colors',
                  group === g.key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {period && (
          <div className="space-y-4">
            {datasets.map((ds) => (
              <ArchiveDatasetCard
                key={ds.key}
                dataset={ds}
                periodId={period.id}
                periodName={period.name.replace(/\s+/g, '-')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}