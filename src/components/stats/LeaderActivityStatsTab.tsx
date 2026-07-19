import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivePeriodId } from '@/hooks/useActivePeriodId';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronUp, ChevronRight, Activity, Users, Clock, Sparkles, MessageSquare, AlertTriangle, Home, Stethoscope } from 'lucide-react';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

interface LeaderActivity {
  id: string;
  activity: string;
  completed_at: string | null;
  registered_by: string | null;
  participant_id: string;
  leaders: {
    id: string;
    name: string;
    profile_image_url: string | null;
  } | null;
  participants: {
    id: string;
    name: string;
    first_name: string | null;
    cabin_id: string | null;
    cabins: { name: string } | null;
  } | null;
}

interface ActivityParticipant {
  id: string;
  name: string;
  cabin: string | null;
  completedAt: Date | null;
}

interface LeaderStats {
  id: string;
  name: string;
  profileImage: string | null;
  totalCount: number;
  activities: Map<string, number>;
  activityParticipants: Map<string, ActivityParticipant[]>;
  lastRegistered: Date | null;
}

export function LeaderActivityStatsTab() {
  const [expandedLeader, setExpandedLeader] = useState<string | null>(null);
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const { data: activePeriodId } = useActivePeriodId();

  const { data: activities, isLoading } = useQuery({
    queryKey: ['leader-activity-stats', activePeriodId],
    enabled: !!activePeriodId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('participant_activities')
        .select(`
          id,
          activity,
          completed_at,
          registered_by,
          participant_id,
          leaders:registered_by (id, name, profile_image_url),
          participants:participant_id (id, name, first_name, cabin_id, cabins:cabin_id (name))
        `)
        .eq('period_id', activePeriodId!)
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
          activityParticipants: new Map(),
          lastRegistered: null,
        };
        statsMap.set(leaderId, stats);
      }

      stats.totalCount++;
      stats.activities.set(
        activity.activity,
        (stats.activities.get(activity.activity) || 0) + 1
      );

      // Store participant info
      if (activity.participants) {
        const participants = stats.activityParticipants.get(activity.activity) || [];
        participants.push({
          id: activity.participants.id,
          name: activity.participants.first_name || activity.participants.name,
          cabin: activity.participants.cabins?.name || null,
          completedAt: activity.completed_at ? new Date(activity.completed_at) : null,
        });
        stats.activityParticipants.set(activity.activity, participants);
      }

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

  // Extra points (bonus) per leader
  const { data: bonusRows } = useQuery({
    queryKey: ['leader-bonus-stats', activePeriodId],
    enabled: !!activePeriodId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('participant_bonus_points')
        .select(`
          id, activity_label, variant, points, created_at, awarded_by,
          leaders:awarded_by (id, name, profile_image_url),
          participants:participant_id (id, name, first_name, cabins:cabin_id (name))
        `)
        .eq('period_id', activePeriodId!)
        .not('awarded_by', 'is', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const bonusStats = useMemo(() => {
    if (!bonusRows) return [];
    const map = new Map<string, {
      id: string; name: string; profileImage: string | null;
      totalPoints: number; totalCount: number;
      entries: { id: string; label: string; points: number; participant: string; cabin: string | null; when: Date }[];
    }>();
    for (const r of bonusRows) {
      if (!r.leaders) continue;
      const id = r.leaders.id;
      let s = map.get(id);
      if (!s) {
        s = { id, name: r.leaders.name, profileImage: r.leaders.profile_image_url, totalPoints: 0, totalCount: 0, entries: [] };
        map.set(id, s);
      }
      s.totalPoints += r.points || 0;
      s.totalCount += 1;
      s.entries.push({
        id: r.id,
        label: r.activity_label,
        points: r.points || 0,
        participant: r.participants?.first_name || r.participants?.name || 'Ukjent',
        cabin: r.participants?.cabins?.name || null,
        when: new Date(r.created_at),
      });
    }
    return Array.from(map.values()).sort((a, b) => b.totalPoints - a.totalPoints);
  }, [bonusRows]);

  const totalBonusPoints = bonusStats.reduce((a, s) => a + s.totalPoints, 0);
  const [expandedBonusLeader, setExpandedBonusLeader] = useState<string | null>(null);

  // Contributions: health notes, health events, incidents, cabin reports
  const { data: contributions } = useQuery({
    queryKey: ['leader-contributions', activePeriodId],
    enabled: !!activePeriodId,
    queryFn: async () => {
      const s: any = supabase;
      const [notes, events, incidents, cabinReps] = await Promise.all([
        s.from('participant_health_notes')
          .select('id, content, created_at, created_by, leaders:created_by(id,name,profile_image_url), participants:participant_id(name, first_name)')
          .eq('period_id', activePeriodId!)
          .not('created_by', 'is', null)
          .order('created_at', { ascending: false }),
        s.from('participant_health_events')
          .select('id, event_type, description, severity, created_at, created_by, leaders:created_by(id,name,profile_image_url), participants:participant_id(name, first_name)')
          .eq('period_id', activePeriodId!)
          .not('created_by', 'is', null)
          .order('created_at', { ascending: false }),
        s.from('participant_incidents')
          .select('id, title, description, category, severity, created_at, leader_id, leaders:leader_id(id,name,profile_image_url)')
          .eq('period_id', activePeriodId!)
          .not('leader_id', 'is', null)
          .order('created_at', { ascending: false }),
        s.from('cabin_reports')
          .select('id, content, updated_at, updated_by, leaders:updated_by(id,name,profile_image_url), cabins:cabin_id(name)')
          .eq('period_id', activePeriodId!)
          .not('updated_by', 'is', null)
          .order('updated_at', { ascending: false }),
      ]);
      return {
        notes: notes.data || [],
        events: events.data || [],
        incidents: incidents.data || [],
        cabinReports: cabinReps.data || [],
      };
    },
  });

  type ContribEntry = { id: string; kind: 'note' | 'event' | 'incident' | 'cabin'; when: Date; title: string; subtitle: string };
  type LeaderContrib = {
    id: string; name: string; profileImage: string | null;
    counts: { note: number; event: number; incident: number; cabin: number };
    total: number;
    entries: ContribEntry[];
  };

  const contribStats = useMemo<LeaderContrib[]>(() => {
    if (!contributions) return [];
    const map = new Map<string, LeaderContrib>();
    const get = (l: any): LeaderContrib | null => {
      if (!l) return null;
      let s = map.get(l.id);
      if (!s) {
        s = { id: l.id, name: l.name, profileImage: l.profile_image_url, counts: { note: 0, event: 0, incident: 0, cabin: 0 }, total: 0, entries: [] };
        map.set(l.id, s);
      }
      return s;
    };
    for (const r of contributions.notes as any[]) {
      const s = get(r.leaders); if (!s) continue;
      s.counts.note++; s.total++;
      const pname = r.participants?.first_name || r.participants?.name || 'Ukjent';
      s.entries.push({ id: r.id, kind: 'note', when: new Date(r.created_at), title: `Notat · ${pname}`, subtitle: (r.content || '').slice(0, 120) });
    }
    for (const r of contributions.events as any[]) {
      const s = get(r.leaders); if (!s) continue;
      s.counts.event++; s.total++;
      const pname = r.participants?.first_name || r.participants?.name || 'Ukjent';
      s.entries.push({ id: r.id, kind: 'event', when: new Date(r.created_at), title: `${r.event_type || 'Helse'} · ${pname}`, subtitle: (r.description || '').slice(0, 120) });
    }
    for (const r of contributions.incidents as any[]) {
      const s = get(r.leaders); if (!s) continue;
      s.counts.incident++; s.total++;
      s.entries.push({ id: r.id, kind: 'incident', when: new Date(r.created_at), title: `Hendelse · ${r.title || r.category || ''}`, subtitle: (r.description || '').slice(0, 120) });
    }
    for (const r of contributions.cabinReports as any[]) {
      const s = get(r.leaders); if (!s) continue;
      s.counts.cabin++; s.total++;
      s.entries.push({ id: r.id, kind: 'cabin', when: new Date(r.updated_at), title: `Hytterapport · ${r.cabins?.name || ''}`, subtitle: (r.content || '').slice(0, 120) });
    }
    for (const s of map.values()) s.entries.sort((a, b) => b.when.getTime() - a.when.getTime());
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [contributions]);

  const totalContribs = contribStats.reduce((a, s) => a + s.total, 0);
  const [expandedContribLeader, setExpandedContribLeader] = useState<string | null>(null);

  const kindMeta: Record<ContribEntry['kind'], { label: string; icon: any }> = {
    note: { label: 'Notat', icon: MessageSquare },
    event: { label: 'Helse', icon: Stethoscope },
    incident: { label: 'Hendelse', icon: AlertTriangle },
    cabin: { label: 'Hytte', icon: Home },
  };

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

      {/* Extra points */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Ekstra poeng gitt
            <Badge variant="secondary" className="ml-auto">{totalBonusPoints} p</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {bonusStats.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              Ingen ekstra poeng gitt ennå
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="divide-y">
                {bonusStats.map((leader) => {
                  const isExpanded = expandedBonusLeader === leader.id;
                  return (
                    <div key={leader.id}>
                      <button
                        className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                        onClick={() => setExpandedBonusLeader(isExpanded ? null : leader.id)}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={leader.profileImage || undefined} />
                          <AvatarFallback>{leader.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{leader.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {leader.totalCount} tildelinger
                          </p>
                        </div>
                        <Badge variant="secondary" className="font-bold">
                          {leader.totalPoints} p
                        </Badge>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4 bg-muted/30 space-y-1">
                          {leader.entries.map((e) => (
                            <div key={e.id} className="flex items-center justify-between text-xs py-1 border-b border-muted last:border-0">
                              <div className="min-w-0 flex-1">
                                <p className="truncate"><span className="font-medium">{e.participant}</span>{e.cabin && <span className="text-muted-foreground"> · {e.cabin}</span>}</p>
                                <p className="text-muted-foreground truncate">{e.label} · {format(e.when, 'dd. MMM HH:mm', { locale: nb })}</p>
                              </div>
                              <Badge variant="outline" className="ml-2 shrink-0">+{e.points}</Badge>
                            </div>
                          ))}
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

      {/* Contributions: notes, health, incidents, cabin reports */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Notater & innhold
            <Badge variant="secondary" className="ml-auto">{totalContribs}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {contribStats.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              Ingen notater eller hendelser registrert ennå
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="divide-y">
                {contribStats.map((leader) => {
                  const isExpanded = expandedContribLeader === leader.id;
                  return (
                    <div key={leader.id}>
                      <button
                        className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                        onClick={() => setExpandedContribLeader(isExpanded ? null : leader.id)}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={leader.profileImage || undefined} />
                          <AvatarFallback>{leader.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{leader.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {leader.counts.note > 0 && `${leader.counts.note} notat `}
                            {leader.counts.event > 0 && `· ${leader.counts.event} helse `}
                            {leader.counts.incident > 0 && `· ${leader.counts.incident} hendelse `}
                            {leader.counts.cabin > 0 && `· ${leader.counts.cabin} hytte`}
                          </p>
                        </div>
                        <Badge variant="secondary" className="font-bold">{leader.total}</Badge>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4 bg-muted/30 space-y-1">
                          {leader.entries.map((e) => {
                            const Icon = kindMeta[e.kind].icon;
                            return (
                              <div key={`${e.kind}-${e.id}`} className="flex items-start gap-2 text-xs py-1.5 border-b border-muted last:border-0">
                                <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium truncate">{e.title}</p>
                                  {e.subtitle && <p className="text-muted-foreground line-clamp-2">{e.subtitle}</p>}
                                  <p className="text-muted-foreground text-[10px] mt-0.5">{format(e.when, 'dd. MMM HH:mm', { locale: nb })}</p>
                                </div>
                              </div>
                            );
                          })}
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
                            {activityList.map(([activityName, count]) => {
                              const activityKey = `${leader.id}-${activityName}`;
                              const isActivityExpanded = expandedActivity === activityKey;
                              const participants = leader.activityParticipants.get(activityName) || [];

                              return (
                                <div key={activityName}>
                                  <button
                                    className="w-full flex items-center justify-between py-1.5 text-sm hover:bg-muted/50 rounded px-2 -mx-2 transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedActivity(isActivityExpanded ? null : activityKey);
                                    }}
                                  >
                                    <span className="text-muted-foreground flex items-center gap-1">
                                      <ChevronRight className={`h-3 w-3 transition-transform ${isActivityExpanded ? 'rotate-90' : ''}`} />
                                      {activityName}
                                    </span>
                                    <Badge variant="outline" className="text-xs">
                                      {count}
                                    </Badge>
                                  </button>

                                  {isActivityExpanded && participants.length > 0 && (
                                    <div className="pl-4 py-1 space-y-1 border-l-2 border-muted ml-1.5 mb-2">
                                      {participants.map((p) => (
                                        <div
                                          key={p.id}
                                          className="flex items-center justify-between text-xs py-0.5"
                                        >
                                          <span>{p.name}</span>
                                          {p.cabin && (
                                            <span className="text-muted-foreground">{p.cabin}</span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
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
