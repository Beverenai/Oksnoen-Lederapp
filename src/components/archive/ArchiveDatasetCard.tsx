import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, ChevronDown } from 'lucide-react';
import { Download, Loader2, Search } from 'lucide-react';
import type { ArchiveDataset } from '@/lib/archiveDatasets';
import { downloadCsv } from '@/lib/archiveExport';
import { cn } from '@/lib/utils';

interface Props {
  dataset: ArchiveDataset;
  periodId: string;
  periodName: string;
  defaultOpen?: boolean;
}

export function ArchiveDatasetCard({ dataset, periodId, periodName, defaultOpen = true }: Props) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(defaultOpen);
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['archive', periodId, dataset.key],
    queryFn: () => dataset.fetch(periodId),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      Object.entries(r).some(([k, v]) => k !== 'Bilde' && String(v ?? '').toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const headers = rows.length ? Object.keys(rows[0]) : [];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform print:hidden',
                !open && '-rotate-90',
              )}
            />
            <CardTitle className="truncate text-sm font-semibold">{dataset.label}</CardTitle>
            {open && !isLoading && <Badge variant="secondary" className="shrink-0">{rows.length}</Badge>}
            {dataset.description && (
              <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                {dataset.description}
              </span>
            )}
          </button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!rows.length}
            className="h-8 shrink-0 px-2 print:hidden"
            onClick={() => downloadCsv(rows, `${periodName}-${dataset.key}.csv`)}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      {open && (
      <CardContent className="space-y-2 px-3 pb-3 pt-0">
        {rows.length > 8 && (
          <div className="relative print:hidden">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="h-8 pl-9 text-xs"
              placeholder="Søk..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Laster...
          </div>
        ) : error ? (
          <p className="text-sm text-destructive py-4">Kunne ikke laste data.</p>
        ) : !rows.length ? (
          <p className="text-sm text-muted-foreground py-4">Ingen data for denne perioden.</p>
        ) : (
          <div className="max-h-[420px] overflow-auto -mx-1 px-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-card sticky top-0">
                  {headers.map((h) => (
                    <th key={h} className="text-left py-1.5 pr-3 font-medium whitespace-nowrap text-muted-foreground">
                      {h.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((r, i) => (
                  <tr key={i} className="align-top">
                    {headers.map((h) => (
                      <td key={h} className="py-1.5 pr-3 max-w-[280px] break-words">
                        {h === 'Bilde' ? (
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={String(r[h] ?? '') || undefined} loading="lazy" decoding="async" />
                            <AvatarFallback className="bg-muted text-muted-foreground">
                              <User className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          String(r[h] ?? '')
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && (
              <p className="text-sm text-muted-foreground py-4">Ingen treff på «{search}».</p>
            )}
          </div>
        )}
      </CardContent>
      )}
    </Card>
  );
}