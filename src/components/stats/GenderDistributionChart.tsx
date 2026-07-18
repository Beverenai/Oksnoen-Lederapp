import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivePeriodId } from '@/hooks/useActivePeriodId';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LabelList } from 'recharts';

export function GenderDistributionChart() {
  const { data: periodId } = useActivePeriodId();

  const { data: rows } = useQuery({
    queryKey: ['gender-distribution', periodId ?? 'none'],
    enabled: !!periodId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('participant_bookings')
        .select('gender, participant_id')
        .eq('period_id', periodId!)
        .not('participant_id', 'is', null);
      if (error) throw error;
      return data || [];
    },
  });

  const data = useMemo(() => {
    let girls = 0, boys = 0, unknown = 0;
    (rows || []).forEach((r: any) => {
      if (r.gender === 'female') girls++;
      else if (r.gender === 'male') boys++;
      else unknown++;
    });
    const out = [
      { name: 'Jenter', count: girls, fill: 'hsl(var(--chart-4))' },
      { name: 'Gutter', count: boys, fill: 'hsl(var(--chart-1))' },
    ];
    if (unknown > 0) out.push({ name: 'Ukjent', count: unknown, fill: 'hsl(var(--chart-3))' });
    return out;
  }, [rows]);

  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Jente- og guttefordeling</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={{ count: { label: 'Antall' } }} className="w-full" style={{ height: Math.max(140, data.length * 44) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 10, right: 40 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={60} tick={{ fontSize: 12 }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
                {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                <LabelList dataKey="count" position="right" className="fill-foreground text-sm font-medium" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Totalt {total} deltakere{total > 0 ? ` — ${data[0].count} jenter, ${data[1].count} gutter` : ''}
        </p>
      </CardContent>
    </Card>
  );
}