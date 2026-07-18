import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { guessGender } from '@/lib/nameGender';

interface Participant {
  id: string;
  birth_date: string | null;
  first_name?: string | null;
  name?: string | null;
  cabin_id?: string | null;
}

interface AgeDistributionChartProps {
  participants: Participant[];
}

type GroupMode = 'age' | 'birthYear' | 'gender';

export function AgeDistributionChart({ participants }: AgeDistributionChartProps) {
  const [groupMode, setGroupMode] = useState<GroupMode>('age');

  const ageData = useMemo(() => {
    if (groupMode === 'gender') {
      // Step 1: initial guess per participant
      const guesses = participants.map((p) => {
        const raw = guessGender(p.first_name || p.name || null);
        return { p, g: (raw === 'male' || raw === 'female' ? raw : null) as 'male' | 'female' | null };
      });
      // Step 2: infer room gender (rooms are single-sex). Use majority of known
      // guesses in each cabin to fill in unknowns.
      const cabinGender = new Map<string, 'male' | 'female'>();
      const tally = new Map<string, { m: number; f: number }>();
      guesses.forEach(({ p, g }) => {
        if (!p.cabin_id || !g) return;
        const t = tally.get(p.cabin_id) || { m: 0, f: 0 };
        if (g === 'male') t.m++; else t.f++;
        tally.set(p.cabin_id, t);
      });
      tally.forEach((t, cabinId) => {
        if (t.m === 0 && t.f === 0) return;
        cabinGender.set(cabinId, t.f >= t.m ? 'female' : 'male');
      });
      let girls = 0, boys = 0, unknown = 0;
      guesses.forEach(({ p, g }) => {
        let final = g;
        if (!final && p.cabin_id && cabinGender.has(p.cabin_id)) {
          final = cabinGender.get(p.cabin_id)!;
        }
        if (final === 'female') girls++;
        else if (final === 'male') boys++;
        else unknown++;
      });
      const out = [
        { name: 'Jenter', count: girls, fill: 'hsl(var(--chart-4))' },
        { name: 'Gutter', count: boys, fill: 'hsl(var(--chart-1))' },
      ];
      if (unknown > 0) out.push({ name: 'Ukjent', count: unknown, fill: 'hsl(var(--chart-3))' });
      return out.map((o) => ({ ...o })) as { name: string; count: number; fill: string }[];
    }
    const today = new Date();
    const counts: Record<number, number> = {};

    participants.forEach((p) => {
      if (!p.birth_date) return;
      const birthDate = new Date(p.birth_date);

      let key: number;
      if (groupMode === 'birthYear') {
        key = birthDate.getFullYear();
      } else {
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        key = age;
      }

      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([key, count]) => ({ age: parseInt(key), count }))
      .sort((a, b) => a.age - b.age)
      .map((item, index) => ({
        name: groupMode === 'birthYear' ? `${item.age}` : `${item.age} år`,
        count: item.count,
        fill: `hsl(var(--chart-${(index % 5) + 1}))`,
      }));
  }, [participants, groupMode]);

  const total = ageData.reduce((sum, g) => sum + g.count, 0);

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
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base font-medium">
            {groupMode === 'birthYear' ? 'Fødselsårfordeling' : groupMode === 'gender' ? 'Jenter og gutter' : 'Aldersfordeling'}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant={groupMode === 'age' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setGroupMode('age')}
            >
              Alder
            </Button>
            <Button
              variant={groupMode === 'birthYear' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setGroupMode('birthYear')}
            >
              Fødselsår
            </Button>
            <Button
              variant={groupMode === 'gender' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setGroupMode('gender')}
            >
              Kjønn
            </Button>
          </div>
        </div>
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
                width={groupMode === 'birthYear' ? 44 : 50}
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
          {groupMode === 'gender'
            ? `Totalt ${total} deltakere (kjønn gjettet fra fornavn)`
            : `Totalt ${total} deltakere med fødselsdato`}
        </p>
      </CardContent>
    </Card>
  );
}

