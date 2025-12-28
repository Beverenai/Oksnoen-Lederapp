import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Activity, 
  Plus, 
  MessageSquare, 
  AlertTriangle, 
  Calendar,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Tables } from '@/integrations/supabase/types';

type LeaderContent = Tables<'leader_content'>;
type SessionActivity = Tables<'session_activities'>;
type HomeScreenConfig = Tables<'home_screen_config'>;

export default function Home() {
  const { leader } = useAuth();
  const [content, setContent] = useState<LeaderContent | null>(null);
  const [sessionActivities, setSessionActivities] = useState<SessionActivity[]>([]);
  const [config, setConfig] = useState<HomeScreenConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    if (!leader) return;

    setIsLoading(true);
    try {
      const [contentRes, activitiesRes, configRes] = await Promise.all([
        supabase
          .from('leader_content')
          .select('*')
          .eq('leader_id', leader.id)
          .maybeSingle(),
        supabase
          .from('session_activities')
          .select('*')
          .eq('is_active', true)
          .order('sort_order'),
        supabase
          .from('home_screen_config')
          .select('*')
          .eq('is_visible', true)
          .order('sort_order'),
      ]);

      setContent(contentRes.data);
      setSessionActivities(activitiesRes.data || []);
      setConfig(configRes.data || []);
    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [leader]);

  // Real-time updates
  useEffect(() => {
    if (!leader) return;

    const channel = supabase
      .channel('home-updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'leader_content',
        filter: `leader_id=eq.${leader.id}`
      }, () => loadData())
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'session_activities'
      }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leader]);

  const isElementVisible = (key: string) => {
    const element = config.find(c => c.element_key === key);
    return element?.is_visible !== false;
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
            Hei, {leader?.name?.split(' ')[0]}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Her er din oversikt for akkurat nå
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={loadData}>
          <RefreshCw className="w-5 h-5" />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* OBS - kritisk info først */}
        {isElementVisible('obs_message') && content?.obs_message && (
          <Card className="md:col-span-2 border-warning bg-warning/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-warning text-lg">
                <AlertTriangle className="w-5 h-5" />
                OBS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground font-medium">{content.obs_message}</p>
            </CardContent>
          </Card>
        )}

        {/* Aktivitet */}
        {isElementVisible('current_activity') && (
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="w-5 h-5 text-primary" />
                Din aktivitet
              </CardTitle>
            </CardHeader>
            <CardContent>
              {content?.current_activity ? (
                <p className="text-foreground text-lg font-medium">
                  {content.current_activity}
                </p>
              ) : (
                <p className="text-muted-foreground">Ingen aktivitet tildelt</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Ekstra aktivitet */}
        {isElementVisible('extra_activity') && content?.extra_activity && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Plus className="w-5 h-5 text-accent" />
                Ekstra aktivitet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground">{content.extra_activity}</p>
            </CardContent>
          </Card>
        )}

        {/* Notater til deg */}
        {isElementVisible('personal_notes') && content?.personal_notes && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="w-5 h-5 text-primary" />
                Notater til deg
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground">{content.personal_notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Aktiviteter denne økten */}
        {isElementVisible('session_activities') && sessionActivities.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="w-5 h-5 text-primary" />
                Aktiviteter denne økten
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sessionActivities.map((activity) => (
                  <div 
                    key={activity.id} 
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <Badge variant="secondary" className="shrink-0">
                      {activity.time_slot || 'Nå'}
                    </Badge>
                    <div>
                      <p className="font-medium text-foreground">{activity.title}</p>
                      {activity.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {activity.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tom tilstand */}
        {!content?.current_activity && 
         !content?.extra_activity && 
         !content?.personal_notes && 
         !content?.obs_message && 
         sessionActivities.length === 0 && (
          <Card className="md:col-span-2">
            <CardContent className="py-12 text-center">
              <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground">Alt klart!</h3>
              <p className="text-muted-foreground mt-1">
                Ingen aktiviteter eller beskjeder akkurat nå
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
