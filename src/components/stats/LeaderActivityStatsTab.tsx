import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronUp, Activity, Users, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

interface LeaderActivity {
  id: string;
  activity: string;
  completed_at: string | null;
  registered_by: string | null;
  leaders: {
    id: string;
    name: string;
    profile_image_url: string | null;
  } | null;
}

interface LeaderStats {
  id: string;
  name: string;
  profileImage: string | null;
  totalCount: number;
  activities: Map<string, number>;
  lastRegistered: Date | null;
}

export function LeaderActivityStatsTab() {
  const [expandedLeader, setExpandedLeader] = useState<string | null>(null);

  const { data: activities, isLoading } = useQuery({
    queryKey: ['leader-activity-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('participant_activities')
        .select(`
          id,
          activity,
          completed_at,
          registered_by,
          leaders:registered_by (id, name, profile_image_url)
        `)
        .not('registered_by', 'is', null);

      if (error) throw error;
      return data as LeaderActivity[];
    },
  });

  const leaderStats = useMemo(() => {
    if (!activities) return [];

    const statsMap = new Map<string, LeaderStats>();

    activities.forEach((activity) => {
      if (!activity.leaders) return;

      const leaderId = activity.leaders.id;
      let stats = statsMap.get(leaderId);

      if (!stats) {
        stats = {
          id: leaderId,
          name: activity.leaders.name,
          profileImage: activity.leaders.profile_image_url,
          totalCount: 0,
          activities: new Map(),
          lastRegistered: null,
        };
        statsMap.set(leaderId, stats);
      }

      stats.totalCount++;
      stats.activities.set(
        activity.activity,
        (stats.activities.get(activity.activity) || 0) + 1
      );

      if (activity.completed_at) {
        const date = new Date(activity.completed_at);
        if (!stats.lastRegistered || date > stats.lastRegistered) {
          stats.lastRegistered = date;
        }
      }
    });

    return Array.from(statsMap.values()).sort((a, b) => b.totalCount - a.totalCount);
  }, [activities]);

  const totalRegistrations = activities?.length || 0;
  const totalLeaders = leaderStats.length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalRegistrations}</p>
                <p className="text-sm text-muted-foreground">Registreringer</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalLeaders}</p>
                <p className="text-sm text-muted-foreground">Aktive ledere</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leader List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lederoversikt</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {leaderStats.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Ingen aktiviteter registrert ennå</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="divide-y">
                {leaderStats.map((leader) => {
                  const isExpanded = expandedLeader === leader.id;
                  const activityList = Array.from(leader.activities.entries()).sort(
                    (a, b) => b[1] - a[1]
                  );

                  return (
                    <div key={leader.id}>
                      <button
                        className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                        onClick={() => setExpandedLeader(isExpanded ? null : leader.id)}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={leader.profileImage || undefined} />
                          <AvatarFallback>{leader.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{leader.name}</p>
                          {leader.lastRegistered && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Sist: {format(leader.lastRegistered, 'dd. MMM HH:mm', { locale: nb })}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary" className="font-bold">
                          {leader.totalCount}
                        </Badge>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-0 bg-muted/30">
                          <div className="pl-13 space-y-1">
                            {activityList.map(([activityName, count]) => (
                              <div
                                key={activityName}
                                className="flex items-center justify-between py-1.5 text-sm"
                              >
                                <span className="text-muted-foreground">{activityName}</span>
                                <Badge variant="outline" className="text-xs">
                                  {count}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
