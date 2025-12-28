import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer } from '@/components/ui/chart';

interface Participant {
  id: string;
  birth_date: string | null;
}

interface AgeDistributionChartProps {
  participants: Participant[];
}

const chartConfig = {
  count: {
    label: 'Antall',
  },
  '8-10': {
    label: '8-10 år',
    color: 'hsl(var(--chart-1))',
  },
  '11-12': {
    label: '11-12 år',
    color: 'hsl(var(--chart-2))',
  },
  '13-15': {
    label: '13-15 år',
    color: 'hsl(var(--chart-3))',
  },
};

export function AgeDistributionChart({ participants }: AgeDistributionChartProps) {
  const ageGroups = useMemo(() => {
    const today = new Date();
    const groups = {
      '8-10': 0,
      '11-12': 0,
      '13-15': 0,
    };

    participants.forEach((p) => {
      if (!p.birth_date) return;
      
      const birthDate = new Date(p.birth_date);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      if (age >= 8 && age <= 10) groups['8-10']++;
      else if (age >= 11 && age <= 12) groups['11-12']++;
      else if (age >= 13 && age <= 15) groups['13-15']++;
    });

    return [
      { name: '8-10 år', count: groups['8-10'], fill: 'hsl(var(--chart-1))' },
      { name: '11-12 år', count: groups['11-12'], fill: 'hsl(var(--chart-2))' },
      { name: '13-15 år', count: groups['13-15'], fill: 'hsl(var(--chart-3))' },
    ];
  }, [participants]);

  const total = ageGroups.reduce((sum, g) => sum + g.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Aldersfordeling</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ageGroups} layout="vertical" margin={{ left: 10, right: 40 }}>
              <XAxis type="number" hide />
              <YAxis 
                type="category" 
                dataKey="name" 
                axisLine={false}
                tickLine={false}
                width={70}
                tick={{ fontSize: 12 }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={32}>
                {ageGroups.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
                <LabelList 
                  dataKey="count" 
                  position="right" 
                  className="fill-foreground text-sm font-medium"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Totalt {total} deltakere med fødselsdato
        </p>
      </CardContent>
    </Card>
  );
}
