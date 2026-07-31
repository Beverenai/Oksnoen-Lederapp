import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, Search } from 'lucide-react';
import type { ArchiveDataset } from '@/lib/archiveDatasets';
import { downloadCsv } from '@/lib/archiveExport';

interface Props {
  dataset: ArchiveDataset;
  periodId: string;
  periodName: string;
}

export function ArchiveDatasetCard({ dataset, periodId, periodName }: Props) {
  const [search, setSearch] = useState('');
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['archive', periodId, dataset.key],
    queryFn: () => dataset.fetch(periodId),
    staleTime: 5 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q)));
  }, [rows, search]);

  const headers = rows.length ? Object.keys(rows[0]) : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            {dataset.label}
            <Badge variant="secondary">{rows.length}</Badge>
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            disabled={!rows.length}
            className="print:hidden"
            onClick={() => downloadCsv(rows, `${periodName}-${dataset.key}.csv`)}
          >
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length > 8 && (
          <div className="relative print:hidden">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
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
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b">
                  {headers.map((h) => (
                    <th key={h} className="text-left py-2 pr-3 font-medium whitespace-nowrap">
                      {h.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((r, i) => (
                  <tr key={i} className="align-top">
                    {headers.map((h) => (
                      <td key={h} className="py-2 pr-3 max-w-[320px] break-words">
                        {String(r[h] ?? '')}
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
    </Card>
  );
}