import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
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
  Anchor,
  Wrench,
  type LucideIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullIndicator } from '@/components/ui/pull-indicator';
import { updateWidgetData } from '@/lib/capacitorWidget';

// Use public path for LCP optimization - preloaded in index.html (WebP for better compression)
const oksnoenHeader = '/oksnoen-header.webp';

interface FixTask {
  id: string;
  title: string;
  assigned_to: string | null;
  status: string;
}

interface PendingRopeControl {
  id: string;
  activity: string;
  assigned_to: string | null;
  fixed_at: string | null;
}

interface LeaderCabin {
  id: string;
  name: string;
}

type LeaderContent = Tables<'leader_content'>;

interface HomeScreenConfig {
  id: string;
  element_key: string;
  label: string;
  is_visible: boolean;
  sort_order: number;
  title: string | null;
  icon: string | null;
  bg_color: string | null;
  text_size: string | null;
  is_bold: boolean | null;
  is_italic: boolean | null;
}

// Color styles for card backgrounds
const colorStyles: Record<string, string> = {
  default: 'bg-card border-border',
  green: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800',
  yellow: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
  blue: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
  red: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
  purple: 'bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800',
  orange: 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800',
};

// Text size styles
const textSizeStyles: Record<string, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
};

// Helper to get card class with styling
const getCardStyle = (config: HomeScreenConfig | undefined) => {
  const bgColor = config?.bg_color || 'default';
  return colorStyles[bgColor] || colorStyles.default;
};

// Helper to get text class with styling
const getTextStyle = (config: HomeScreenConfig | undefined) => {
  const size = config?.text_size || 'md';
  const bold = config?.is_bold ? 'font-bold' : '';
  const italic = config?.is_italic ? 'italic' : '';
  return `${textSizeStyles[size] || textSizeStyles.md} ${bold} ${italic}`.trim();
};


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

// Format team display: "1" -> "Team 1", "2f" -> "Team 2F", others unchanged
const formatTeamDisplay = (team: string | null): string => {
  if (!team) return '';
  const teamLower = team.toLowerCase().trim();
  if (['1', '2', '1f', '2f'].includes(teamLower)) {
    return `Team ${team.toUpperCase()}`;
  }
  return team;
};

export default function Home() {
  const { leader, effectiveLeader, isAdmin, isNurse } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [content, setContent] = useState<LeaderContent | null>(null);
  const [sessionActivitiesText, setSessionActivitiesText] = useState<string>('');
  const [config, setConfig] = useState<HomeScreenConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasRead, setHasRead] = useState(false);
  const [leaderCabins, setLeaderCabins] = useState<LeaderCabin[]>([]);
  const [assignedFixTasks, setAssignedFixTasks] = useState<FixTask[]>([]);
  const [pendingRopeControls, setPendingRopeControls] = useState<PendingRopeControl[]>([]);

  useEffect(() => {
    if (!effectiveLeader) return;
    
    const fetchHasRead = async () => {
      const { data } = await supabase
        .from('leader_content')
        .select('has_read')
        .eq('leader_id', effectiveLeader.id)
        .maybeSingle();
      setHasRead(data?.has_read ?? false);
    };
    
    fetchHasRead();
  }, [effectiveLeader, content]);

  const loadData = useCallback(async () => {
    if (!effectiveLeader) return;

    setIsLoading(true);
    try {
      const [contentRes, activitiesTextRes, configRes, cabinsRes, fixTasksRes, ropeControlsRes] = await Promise.all([
        supabase
          .from('leader_content')
          .select('*')
          .eq('leader_id', effectiveLeader.id)
          .maybeSingle(),
        supabase
          .from('app_config')
          .select('value')
          .eq('key', 'session_activities_text')
          .maybeSingle(),
        supabase
          .from('home_screen_config')
          .select('*')
          .eq('is_visible', true)
          .order('sort_order'),
        supabase
          .from('leader_cabins')
          .select('cabin_id, cabins(id, name)')
          .eq('leader_id', effectiveLeader.id),
        supabase
          .from('fix_tasks')
          .select('id, title, assigned_to, status')
          .eq('assigned_to', effectiveLeader.id)
          .neq('status', 'fixed'),
        supabase
          .from('rope_controls')
          .select('id, activity, assigned_to, fixed_at')
          .eq('assigned_to', effectiveLeader.id)
          .is('fixed_at', null),
      ]);

      setContent(contentRes.data);
      updateWidgetData({
        currentActivity: contentRes.data?.current_activity ?? null,
        extraActivity: contentRes.data?.extra_activity ?? null,
        obsMessage: contentRes.data?.obs_message ?? null,
      });
      setSessionActivitiesText(activitiesTextRes.data?.value || '');
      setConfig((configRes.data || []) as HomeScreenConfig[]);
      
      // Extract cabins from leader_cabins join
      const cabins = cabinsRes.data
        ?.map((lc: any) => lc.cabins)
        .filter(Boolean) as LeaderCabin[] || [];
      setLeaderCabins(cabins);
      
      // Set assigned fix tasks
      setAssignedFixTasks((fixTasksRes.data || []) as FixTask[]);
      
      // Set pending rope controls
      setPendingRopeControls((ropeControlsRes.data || []) as PendingRopeControl[]);
    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [leader]);

  // Pull-to-refresh
  const { pullRef, isPulling, pullProgress, isRefreshing } = usePullToRefresh({
    onRefresh: loadData,
  });

  useEffect(() => {
    loadData();
  }, [effectiveLeader]);

  // Force refresh when navigated from Hajolo with red status
  useEffect(() => {
    if (location.state?.forceRefresh) {
      console.log('Force refreshing home screen from Hajolo navigation');
      loadData();
      // Clear the state to prevent refresh on back navigation
      window.history.replaceState({}, document.title);
    }
  }, [location.state?.forceRefresh]);

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
        table: 'app_config'
      }, () => loadData())
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'home_screen_config'
      }, () => loadData())
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'fix_tasks'
      }, () => loadData())
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'rope_controls'
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
      <div className="space-y-6 animate-fade-in -mx-4 lg:-mx-8 -mt-4 lg:-mt-8">
        <Skeleton className="h-48 w-full" />
        <div className="px-4 space-y-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  // Check if there's any content to show
  const hasExtraContent = ['extra_1', 'extra_2', 'extra_3', 'extra_4', 'extra_5'].some(
    key => config.find(c => c.element_key === key) && getExtraFieldValue(key)
  );
  const hasAnyContent = content?.current_activity || 
    content?.extra_activity || 
    content?.personal_notes || 
    content?.obs_message || 
    sessionActivitiesText ||
    hasExtraContent;

  const ActivityIcon = getElementIcon('current_activity', Activity);
  const ExtraActivityIcon = getElementIcon('extra_activity', Plus);
  const NotesIcon = getElementIcon('personal_notes', MessageSquare);
  const ObsIcon = getElementIcon('obs_message', AlertTriangle);
  const SessionIcon = getElementIcon('session_activities', Calendar);

  return (
    <div ref={pullRef} className="animate-fade-in -mx-4 lg:-mx-8 -mt-4 lg:-mt-8 pb-24 overflow-y-auto">
      <PullIndicator isPulling={isPulling} isRefreshing={isRefreshing} pullProgress={pullProgress} />
      {/* Header with background image */}
      <div className="relative h-44 md:h-52 overflow-hidden">
        <img 
          src={oksnoenHeader} 
          alt="Oksnøen" 
          className="w-full h-full object-cover"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/40" />
        
        {/* Refresh button */}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={loadData} 
          className="absolute top-4 right-4 text-white hover:bg-white/20"
        >
          <RefreshCw className="w-5 h-5" />
        </Button>
      </div>

      {/* Profile Section - overlapping header (reduced visual weight) */}
      <div className="relative px-4 -mt-14">
        <div className="flex flex-col items-center text-center">
          {/* User name at the very top */}
          <h1 className="text-xl font-heading font-bold text-white mb-3 drop-shadow-lg">
            Hei, {leader?.name?.split(' ')[0]}!
          </h1>
          
          <Avatar className={cn(
            "h-20 w-20 sm:h-24 sm:w-24 border-2 shadow-lg ring-2",
            (isAdmin || isNurse || hasRead) 
              ? "border-green-500 ring-green-500/20" 
              : "border-red-500 ring-red-500/20"
          )}>
            <AvatarImage src={leader?.profile_image_url || ''} alt={leader?.name} />
            <AvatarFallback className="bg-primary text-primary-foreground font-heading text-xl">
              {leader?.name ? getInitials(leader.name) : '?'}
            </AvatarFallback>
          </Avatar>
          
          <p className="text-base font-medium text-foreground mt-2">
            {leader?.name}
          </p>
          
          {leader?.ministerpost && (
            <p className="text-sm text-muted-foreground mt-0.5">{leader.ministerpost}</p>
          )}
          
          <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
            {leaderCabins.length > 0 ? (
              leaderCabins.map(cabin => (
                <Badge 
                  key={cabin.id}
                  variant="secondary" 
                  className="text-xs cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => navigate('/my-cabins')}
                >
                  <HomeIcon className="w-3 h-3 mr-1" />
                  {cabin.name}
                </Badge>
              ))
            ) : leader?.cabin_info && (
              <Badge variant="secondary" className="text-xs">
                <HomeIcon className="w-3 h-3 mr-1" />
                {leader.cabin_info}
              </Badge>
            )}
            {leader?.team && (
              <Link to={`/team/${leader.team.toLowerCase()}`}>
                <Badge variant="outline" className="text-xs cursor-pointer hover:opacity-80 transition-opacity">
                  <Users className="w-3 h-3 mr-1" />
                  {formatTeamDisplay(leader.team)}
                </Badge>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Content Cards - consistent spacing */}
      <div className="px-4 mt-4 sm:mt-6 space-y-3 sm:space-y-4">
        {/* Fix Task Alert - consistent with secondary cards */}
        {assignedFixTasks.length > 0 && (
          <Card 
            className="border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors shadow-sm"
            onClick={() => navigate('/fix')}
          >
            <CardContent className="py-3 sm:py-4">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="p-1.5 rounded-full bg-amber-500/15">
                  <Wrench className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-500" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-wide text-amber-600/80 dark:text-amber-500/80 font-medium mb-1">
                    Fix-oppgave{assignedFixTasks.length > 1 ? 'r' : ''}
                  </p>
                  <p className="font-medium text-foreground text-sm sm:text-base">
                    Du har {assignedFixTasks.length} oppgave{assignedFixTasks.length > 1 ? 'r' : ''} som venter
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rope Control Alert - consistent with secondary cards */}
        {pendingRopeControls.length > 0 && (
          <Card 
            className="border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors shadow-sm"
            onClick={() => navigate('/rope-control')}
          >
            <CardContent className="py-3 sm:py-4">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="p-1.5 rounded-full bg-amber-500/15">
                  <Anchor className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-500" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-wide text-amber-600/80 dark:text-amber-500/80 font-medium mb-1">
                    Utstyr å fikse
                  </p>
                  <p className="font-medium text-foreground text-sm sm:text-base">
                    Du har {pendingRopeControls.length} utstyr som må godkjennes
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* HERO: Main Activity - Large Display with premium styling */}
        {isElementVisible('current_activity') && (() => {
          const activityConfig = getConfigForElement('current_activity');
          return (
            <Card className={cn(
              "border-2 border-primary/20 bg-primary/5 dark:bg-primary/10 shadow-lg",
              getCardStyle(activityConfig)
            )}>
              <CardContent className="py-8 sm:py-10">
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="p-3 rounded-full bg-primary/20">
                    <ActivityIcon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-widest text-primary/70 font-medium mb-2">
                      {getElementTitle('current_activity', 'Din aktivitet')}
                    </p>
                    <p className={cn(
                      "text-2xl sm:text-3xl font-bold font-heading text-foreground",
                      activityConfig?.is_italic && "italic"
                    )}>
                      {content?.current_activity || 'Ingen aktivitet tildelt'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* OBS Alert Box - Secondary styling */}
        {isElementVisible('obs_message') && content?.obs_message && (() => {
          const obsConfig = getConfigForElement('obs_message');
          return (
            <Card className={cn(
              "border border-border/50",
              getCardStyle(obsConfig)
            )}>
              <CardContent className="py-3 sm:py-4">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="p-1.5 rounded-full bg-success/15">
                    <ObsIcon className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-wide text-success/80 font-medium mb-1">
                      {getElementTitle('obs_message', 'OBS')}
                    </p>
                    <p className={cn("text-foreground", getTextStyle(obsConfig))}>{content.obs_message}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Extra Activity - Secondary styling */}
        {isElementVisible('extra_activity') && content?.extra_activity && (() => {
          const extraConfig = getConfigForElement('extra_activity');
          return (
            <Card className={cn(
              "border border-border/50",
              getCardStyle(extraConfig)
            )}>
              <CardContent className="py-3 sm:py-4">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="p-1.5 rounded-full bg-accent/15">
                    <ExtraActivityIcon className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-wide text-accent/80 font-medium mb-1">
                      {getElementTitle('extra_activity', 'Ekstra aktivitet')}
                    </p>
                    <p className={cn("text-foreground", getTextStyle(extraConfig))}>{content.extra_activity}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Personal Notes - Secondary styling */}
        {isElementVisible('personal_notes') && content?.personal_notes && (() => {
          const notesConfig = getConfigForElement('personal_notes');
          return (
            <Card className={cn(
              "border border-border/50",
              getCardStyle(notesConfig)
            )}>
              <CardContent className="py-3 sm:py-4">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="p-1.5 rounded-full bg-primary/10">
                    <NotesIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-wide text-primary/80 font-medium mb-1">
                      {getElementTitle('personal_notes', 'Notater til deg')}
                    </p>
                    <p className={cn("text-foreground", getTextStyle(notesConfig))}>{content.personal_notes}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Extra Fields - Secondary styling */}
        {['extra_1', 'extra_2', 'extra_3', 'extra_4', 'extra_5'].map((fieldKey) => {
          const fieldConfig = config.find(c => c.element_key === fieldKey);
          if (!fieldConfig) return null;
          
          const value = getExtraFieldValue(fieldKey);
          if (!value) return null;
          
          const IconComponent = fieldConfig.icon && iconMap[fieldConfig.icon] ? iconMap[fieldConfig.icon] : Info;
          
          return (
            <Card key={fieldKey} className={cn(
              "border border-border/50",
              getCardStyle(fieldConfig)
            )}>
              <CardContent className="py-3 sm:py-4">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="p-1.5 rounded-full bg-muted">
                    <IconComponent className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80 font-medium mb-1">
                      {fieldConfig.title || fieldKey.replace('_', ' #')}
                    </p>
                    <p className={cn("text-foreground", getTextStyle(fieldConfig))}>{value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Session Activities Text - Secondary styling */}
        {isElementVisible('session_activities') && sessionActivitiesText && (() => {
          const sessionConfig = getConfigForElement('session_activities');
          return (
            <Card className={cn(
              "border border-border/50",
              getCardStyle(sessionConfig)
            )}>
              <CardContent className="py-3 sm:py-4">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="p-1.5 rounded-full bg-primary/10">
                    <SessionIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <p className="text-[10px] uppercase tracking-wide text-primary/80 font-medium">
                    {getElementTitle('session_activities', 'Aktiviteter denne økten')}
                  </p>
                </div>
                <div className="mt-3 text-center">
                  <p className={cn("text-foreground whitespace-pre-wrap", getTextStyle(sessionConfig))}>{sessionActivitiesText}</p>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Empty State */}
        {!hasAnyContent && (
          <Card className="border border-border/50">
            <CardContent className="py-10 text-center">
              <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-base font-medium text-foreground">Alt klart!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Ingen aktiviteter eller beskjeder akkurat nå
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}