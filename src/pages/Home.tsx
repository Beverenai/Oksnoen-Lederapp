import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Activity, 
  Plus, 
  MessageSquare, 
  AlertTriangle, 
  Calendar,
  RefreshCw,
  Info,
  Star,
  Heart,
  Bell,
  Zap,
  Home as HomeIcon,
  Users,
  MapPin,
  type LucideIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Tables } from '@/integrations/supabase/types';

type LeaderContent = Tables<'leader_content'>;
type SessionActivity = Tables<'session_activities'>;

interface HomeScreenConfig {
  id: string;
  element_key: string;
  label: string;
  is_visible: boolean;
  sort_order: number;
  title: string | null;
  icon: string | null;
}

interface ExtraFieldConfig {
  id: string;
  field_key: string;
  title: string;
  icon: string;
  is_visible: boolean;
  sort_order: number;
}

// Icon mapping for fields
const iconMap: Record<string, LucideIcon> = {
  info: Info,
  star: Star,
  heart: Heart,
  bell: Bell,
  zap: Zap,
  activity: Activity,
  plus: Plus,
  message: MessageSquare,
  'alert-triangle': AlertTriangle,
  calendar: Calendar,
  home: HomeIcon,
  users: Users,
};

export default function Home() {
  const { leader } = useAuth();
  const [content, setContent] = useState<LeaderContent | null>(null);
  const [sessionActivities, setSessionActivities] = useState<SessionActivity[]>([]);
  const [config, setConfig] = useState<HomeScreenConfig[]>([]);
  const [extraFieldsConfig, setExtraFieldsConfig] = useState<ExtraFieldConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    if (!leader) return;

    setIsLoading(true);
    try {
      const [contentRes, activitiesRes, configRes, extraConfigRes] = await Promise.all([
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
        supabase
          .from('extra_fields_config')
          .select('*')
          .eq('is_visible', true)
          .order('sort_order'),
      ]);

      setContent(contentRes.data);
      setSessionActivities(activitiesRes.data || []);
      setConfig((configRes.data || []) as HomeScreenConfig[]);
      setExtraFieldsConfig((extraConfigRes.data || []) as ExtraFieldConfig[]);
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
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'extra_fields_config'
      }, () => loadData())
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'home_screen_config'
      }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leader]);

  const getConfigForElement = (key: string): HomeScreenConfig | undefined => {
    return config.find(c => c.element_key === key);
  };

  const isElementVisible = (key: string) => {
    const element = config.find(c => c.element_key === key);
    return element?.is_visible !== false;
  };

  const getElementTitle = (key: string, fallback: string): string => {
    const element = getConfigForElement(key);
    return element?.title || fallback;
  };

  const getElementIcon = (key: string, fallback: LucideIcon): LucideIcon => {
    const element = getConfigForElement(key);
    if (element?.icon && iconMap[element.icon]) {
      return iconMap[element.icon];
    }
    return fallback;
  };

  // Get extra field value from content
  const getExtraFieldValue = (fieldKey: string): string | null => {
    if (!content) return null;
    const key = fieldKey as keyof LeaderContent;
    const value = content[key];
    return typeof value === 'string' ? value : null;
  };

  // Get initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  // Check if there's any content to show
  const hasExtraContent = extraFieldsConfig.some(cfg => getExtraFieldValue(cfg.field_key));
  const hasAnyContent = content?.current_activity || 
    content?.extra_activity || 
    content?.personal_notes || 
    content?.obs_message || 
    sessionActivities.length > 0 ||
    hasExtraContent;

  const ActivityIcon = getElementIcon('current_activity', Activity);
  const ExtraActivityIcon = getElementIcon('extra_activity', Plus);
  const NotesIcon = getElementIcon('personal_notes', MessageSquare);
  const ObsIcon = getElementIcon('obs_message', AlertTriangle);
  const SessionIcon = getElementIcon('session_activities', Calendar);

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Profile Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 md:h-20 md:w-20 border-2 border-primary/20">
            <AvatarImage src={leader?.profile_image_url || ''} alt={leader?.name} />
            <AvatarFallback className="bg-primary/10 text-primary font-heading text-lg md:text-xl">
              {leader?.name ? getInitials(leader.name) : '?'}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-heading font-bold text-foreground">
              {leader?.name}
            </h1>
            {leader?.ministerpost && (
              <p className="text-sm text-muted-foreground">{leader.ministerpost}</p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {leader?.cabin_info && (
                <Badge variant="secondary" className="text-xs">
                  <HomeIcon className="w-3 h-3 mr-1" />
                  {leader.cabin_info}
                </Badge>
              )}
              {leader?.team && (
                <Badge variant="outline" className="text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  {leader.team}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={loadData} className="shrink-0">
          <RefreshCw className="w-5 h-5" />
        </Button>
      </div>

      {/* Main Activity - Large Display */}
      {isElementVisible('current_activity') && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary/20">
                <ActivityIcon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wide text-primary font-medium mb-1">
                  {getElementTitle('current_activity', 'Din aktivitet')}
                </p>
                <p className="text-xl md:text-2xl font-heading font-bold text-foreground">
                  {content?.current_activity || 'Ingen aktivitet tildelt'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* OBS Alert Box */}
      {isElementVisible('obs_message') && content?.obs_message && (
        <Card className="border-success bg-success/10">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-success/20">
                <ObsIcon className="w-5 h-5 text-success" />
              </div>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wide text-success font-medium mb-1">
                  {getElementTitle('obs_message', 'OBS')}
                </p>
                <p className="text-foreground font-medium">{content.obs_message}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extra Activity */}
      {isElementVisible('extra_activity') && content?.extra_activity && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-accent/20">
                <ExtraActivityIcon className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wide text-accent font-medium mb-1">
                  {getElementTitle('extra_activity', 'Ekstra aktivitet')}
                </p>
                <p className="text-foreground">{content.extra_activity}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Personal Notes */}
      {isElementVisible('personal_notes') && content?.personal_notes && (
        <Card className="border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <NotesIcon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wide text-primary font-medium mb-1">
                  {getElementTitle('personal_notes', 'Notater til deg')}
                </p>
                <p className="text-foreground">{content.personal_notes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extra Fields from Google Sheets */}
      {extraFieldsConfig.map((fieldConfig) => {
        const value = getExtraFieldValue(fieldConfig.field_key);
        if (!value) return null;
        
        const IconComponent = iconMap[fieldConfig.icon] || Info;
        
        return (
          <Card key={fieldConfig.id}>
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-muted">
                  <IconComponent className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1">
                    {fieldConfig.title}
                  </p>
                  <p className="text-foreground">{value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Session Activities */}
      {isElementVisible('session_activities') && sessionActivities.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-full bg-primary/10">
                <SessionIcon className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xs uppercase tracking-wide text-primary font-medium pt-2">
                {getElementTitle('session_activities', 'Denne økten har du:')}
              </p>
            </div>
            <div className="space-y-3 ml-12">
              {sessionActivities.map((activity) => (
                <div 
                  key={activity.id} 
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <Badge variant="secondary" className="shrink-0 font-mono">
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

      {/* Empty State */}
      {!hasAnyContent && (
        <Card>
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
  );
}
