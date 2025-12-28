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

export function AgeDistributionChart({ participants }: AgeDistributionChartProps) {
  const ageData = useMemo(() => {
    const today = new Date();
    const counts: Record<number, number> = {};

    participants.forEach((p) => {
      if (!p.birth_date) return;
      
      const birthDate = new Date(p.birth_date);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      counts[age] = (counts[age] || 0) + 1;
    });

    // Sort by age and create data array
    return Object.entries(counts)
      .map(([age, count]) => ({ age: parseInt(age), count }))
      .sort((a, b) => a.age - b.age)
      .map((item, index) => ({
        name: `${item.age} år`,
        count: item.count,
        fill: `hsl(var(--chart-${(index % 5) + 1}))`,
      }));
  }, [participants]);

  const total = ageData.reduce((sum, g) => sum + g.count, 0);

  // Generate chart config dynamically
  const chartConfig = useMemo(() => {
    const config: Record<string, { label: string; color?: string }> = {
      count: { label: 'Antall' },
    };
    ageData.forEach((item, index) => {
      config[item.name] = {
        label: item.name,
        color: `hsl(var(--chart-${(index % 5) + 1}))`,
      };
    });
    return config;
  }, [ageData]);

  const chartHeight = Math.max(180, ageData.length * 36);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Aldersfordeling</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="w-full" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ageData} layout="vertical" margin={{ left: 10, right: 40 }}>
              <XAxis type="number" hide />
              <YAxis 
                type="category" 
                dataKey="name" 
                axisLine={false}
                tickLine={false}
                width={50}
                tick={{ fontSize: 12 }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
                {ageData.map((entry, index) => (
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
