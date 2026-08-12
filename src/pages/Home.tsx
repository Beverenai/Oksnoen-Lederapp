import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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
  Bed,
  Dices,
  ChefHat,
  type LucideIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullIndicator } from '@/components/ui/pull-indicator';
import { updateWidgetData } from '@/lib/capacitorWidget';
import { MessageSquareWarning } from 'lucide-react';
import { useTeamsEnabled } from '@/hooks/useTeamsEnabled';
import { useKitchenDutyToday } from '@/hooks/useKitchenDutyToday';
import { useAppMode } from '@/hooks/useAppMode';
import { Link as LinkIcon } from 'lucide-react';
import { LederPass } from '@/components/passport/LederPass';
import { OffSeasonHome } from '@/components/home/OffSeasonHome';
import { useMyMurderState } from '@/hooks/useMurderGame';
import { Skull } from 'lucide-react';
import { Tent, AlertCircle } from 'lucide-react';
import { HomeQuickActions, type QuickAction } from '@/components/home/HomeQuickActions';
import { ParticipantTaskCards } from '@/components/home/ParticipantTaskCards';
import { SnusBadge } from '@/components/snus/SnusBadge';
import { SnusCan3D } from '@/components/snus/SnusCan3D';
import { getSnusProduct, customSnusProduct } from '@/lib/snusCatalog';
import { MailboxIcon3D } from '@/components/mailbox/MailboxIcon3D';
import { useMailboxUnreadCount, useMyMailboxMessages } from '@/hooks/useMailbox';
import { OvernattingGateDialog, OvernattingEditDialog } from '@/components/home/OvernattingDialogs';
import { groupMainCabins } from '@/lib/cabinDisplay';

type SessionData = { reminder: string; items: string[] };
type SessionsPayload = { active: 1 | 2 | 3; sessions: Record<'1' | '2' | '3', SessionData> };

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
  const { leader, effectiveLeader, isAdmin, isNurse, isSuperAdmin, isLimitedAccess } = useAuth();
  const { mode: appMode } = useAppMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [content, setContent] = useState<LeaderContent | null>(null);
  const [sessionsPayload, setSessionsPayload] = useState<SessionsPayload | null>(null);
  const [config, setConfig] = useState<HomeScreenConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [hasRead, setHasRead] = useState(false);
  const [leaderCabins, setLeaderCabins] = useState<LeaderCabin[]>([]);
  const [assignedFixTasks, setAssignedFixTasks] = useState<FixTask[]>([]);
  const [pendingRopeControls, setPendingRopeControls] = useState<PendingRopeControl[]>([]);
  const [overnattingEnabled, setOvernattingEnabled] = useState(false);
  const [overnattingTitle, setOvernattingTitle] = useState('Overnatting');
  const [overnattingQuestion, setOvernattingQuestion] = useState('Vil du være med på overnatting?');
  const [overnattingJoining, setOvernattingJoining] = useState(false);
  const [overnattingSaving, setOvernattingSaving] = useState(false);
  const [overnattingAnswered, setOvernattingAnswered] = useState(true);
  const [overnattingEditOpen, setOvernattingEditOpen] = useState(false);
  const [rouletteEnabled, setRouletteEnabled] = useState(false);
  const [activePeriodLabel, setActivePeriodLabel] = useState<string | null>(null);
  const [snusBrothers, setSnusBrothers] = useState<{ id: string; name: string }[]>([]);
  const [snusBrothersOpen, setSnusBrothersOpen] = useState(false);
  const [mySnus, setMySnus] = useState<{ productId: string | null; customLabel: string | null } | null>(null);
  const { data: mailboxUnread = 0 } = useMailboxUnreadCount(!!isAdmin);
  const { data: myMailboxMessages = [] } = useMyMailboxMessages();
  const hasNewReply = !isAdmin && myMailboxMessages.some((m) => !!m.admin_reply);
  const inRoulette = !!(effectiveLeader as any)?.in_roulette;
  const showRoulette = rouletteEnabled && inRoulette;
  const teamsEnabled = useTeamsEnabled();
  const { data: murderState } = useMyMurderState();
  const showMurder = !!murderState?.is_active;
  const { teamA: dutyTeamA, teamB: dutyTeamB } = useKitchenDutyToday();

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
    setLoadFailed(false);
    try {
      const periodRes = await supabase.from('periods').select('id,name').eq('is_active', true).maybeSingle();
      const activePeriodId = periodRes.data?.id ?? null;
      setActivePeriodLabel(periodRes.data?.name ?? null);
      const sessionActivitiesKey = activePeriodId
        ? `session_activities_data:${activePeriodId}`
        : 'session_activities_data';
      const fixTasksQuery = supabase
        .from('fix_tasks')
        .select('id, title, assigned_to, status')
        .eq('assigned_to', effectiveLeader.id)
        .neq('status', 'fixed');
      if (activePeriodId) fixTasksQuery.eq('period_id', activePeriodId);
      const [contentRes, activitiesTextRes, configRes, cabinsRes, fixTasksRes, ropeControlsRes] = await Promise.all([
        supabase
          .from('leader_content')
          .select('*')
          .eq('leader_id', effectiveLeader.id)
          .maybeSingle(),
        supabase
          .from('app_config')
          .select('value')
          .in('key', [sessionActivitiesKey, 'session_activities_data'])
          .order('key', { ascending: false })
          .limit(1)
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
        fixTasksQuery,
        supabase
          .from('rope_controls')
          .select('id, activity, assigned_to, fixed_at')
          .eq('period_id', activePeriodId)
          .eq('assigned_to', effectiveLeader.id)
          .is('fixed_at', null),
      ]);

      const [overCfgRes, overRespRes] = await Promise.all([
        supabase.from('app_config').select('key,value').in('key', ['overnatting_enabled', 'overnatting_title', 'overnatting_question', 'roulette_enabled']),
        supabase.from('overnatting_responses').select('is_joining').eq('leader_id', effectiveLeader.id).maybeSingle(),
      ]);
      const cfgMap = new Map((overCfgRes.data || []).map((r: { key: string; value: string }) => [r.key, r.value]));
      setOvernattingEnabled(cfgMap.get('overnatting_enabled') === 'true');
      setOvernattingTitle(cfgMap.get('overnatting_title') || 'Overnatting');
      setOvernattingQuestion(cfgMap.get('overnatting_question') || 'Vil du være med på overnatting?');
      setOvernattingJoining(overRespRes.data?.is_joining ?? false);
      setOvernattingAnswered(!!overRespRes.data);
      setRouletteEnabled(cfgMap.get('roulette_enabled') === 'true');

      setContent(contentRes.data);
      updateWidgetData({
        currentActivity: contentRes.data?.current_activity ?? null,
        extraActivity: contentRes.data?.extra_activity ?? null,
        obsMessage: contentRes.data?.obs_message ?? null,
      });
      if (activitiesTextRes.data?.value) {
        try {
          const parsed = JSON.parse(activitiesTextRes.data.value);
          setSessionsPayload(parsed);
        } catch {
          setSessionsPayload(null);
        }
      } else {
        setSessionsPayload(null);
      }
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
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveLeader]);

  // Pull-to-refresh
  const { pullRef, isPulling, pullProgress, isRefreshing } = usePullToRefresh({
    onRefresh: loadData,
  });

  useEffect(() => {
    if (!effectiveLeader) return;
    const timeout = setTimeout(() => {
      setIsLoading(prev => {
        if (prev) setLoadFailed(true);
        return false;
      });
    }, 8000);
    loadData();
    return () => clearTimeout(timeout);
  }, [effectiveLeader]);

  // Force refresh when navigated from Hajolo with red status
  useEffect(() => {
    let cancelled = false;
    const loadSnusBrothers = async () => {
      if (!effectiveLeader) {
        setSnusBrothers([]);
        setMySnus(null);
        return;
      }
      // Hent egen snus-status ferskt fra basen (auth-context kan være utdatert)
      const { data: me } = await supabase
        .from('leaders')
        .select('snus_user, snus_product_id, snus_product_ids, snus_custom_label, is_active')
        .eq('id', effectiveLeader.id)
        .maybeSingle();
      const productId = (me as any)?.snus_product_id;
      const snusUser = !!(me as any)?.snus_user;
      const myIds: string[] = (((me as any)?.snus_product_ids as string[] | null) ?? []).length
        ? ((me as any).snus_product_ids as string[])
        : productId
          ? [productId]
          : [];
      if (!cancelled) {
        setMySnus(snusUser
          ? { productId: productId ?? null, customLabel: (me as any)?.snus_custom_label ?? null }
          : null);
      }
      if (!snusUser || myIds.length === 0) {
        setSnusBrothers([]);
        return;
      }
      // Aktive ledere ser kun andre aktive snusere.
      // Inaktive ledere (off season) ser alle.
      const iAmActive = (me as any)?.is_active !== false;
      let query = supabase
        .from('leaders')
        .select('id, name, profile_image_url, snus_product_id, snus_product_ids')
        .eq('snus_user', true)
        .neq('id', effectiveLeader.id);
      if (iAmActive) query = query.eq('is_active', true);
      const { data } = await query.order('name');
      // Deles man minst én boks, er man snus brothers
      const matches = ((data as any[]) || []).filter((l) => {
        const ids: string[] = (l.snus_product_ids as string[] | null)?.length
          ? (l.snus_product_ids as string[])
          : l.snus_product_id
            ? [l.snus_product_id]
            : [];
        return ids.some((id) => myIds.includes(id));
      });
      if (!cancelled) setSnusBrothers(matches as any);
    };
    loadSnusBrothers();
    return () => { cancelled = true; };
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
        filter: `leader_id=eq.${effectiveLeader?.id}`
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

  const handleOvernattingToggle = async (next: boolean) => {
    if (!effectiveLeader) return;
    setOvernattingJoining(next);
    setOvernattingSaving(true);
    try {
      const { error } = await supabase
        .from('overnatting_responses')
        .upsert({ leader_id: effectiveLeader.id, is_joining: next, updated_at: new Date().toISOString() }, { onConflict: 'leader_id' });
      if (error) throw error;
      setOvernattingAnswered(true);
    } catch (e) {
      console.error('Overnatting toggle failed', e);
      setOvernattingJoining(!next);
      throw e;
    } finally {
      setOvernattingSaving(false);
    }
  };

  if (isLoading && !loadFailed) {
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

  if (loadFailed && !content) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 animate-fade-in">
        <p className="text-muted-foreground">Kunne ikke laste data</p>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Prøv igjen
        </Button>
      </div>
    );
  }

  // App-wide inactive mode (off-season): the real interactive 3D lederpass
  // fills the entire home surface. Chat remains reachable via bottom nav.
  // Superadmin keeps the full home to manage the app.
  if ((appMode === 'inactive' || isLimitedAccess) && !isSuperAdmin) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <OffSeasonHome leader={effectiveLeader} periodLabel={activePeriodLabel} />
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
    (sessionsPayload && (sessionsPayload.sessions[String(sessionsPayload.active) as '1'|'2'|'3']?.items?.length || sessionsPayload.sessions[String(sessionsPayload.active) as '1'|'2'|'3']?.reminder)) ||
    hasExtraContent;

  const ActivityIcon = getElementIcon('current_activity', Activity);
  const ExtraActivityIcon = getElementIcon('extra_activity', Plus);
  const NotesIcon = getElementIcon('personal_notes', MessageSquare);
  const ObsIcon = getElementIcon('obs_message', AlertTriangle);
  const SessionIcon = getElementIcon('session_activities', Calendar);

  const mainCabins = groupMainCabins(leaderCabins);

  const quickActions: QuickAction[] = [
    {
      key: 'hendelser',
      icon: AlertCircle,
      label: 'Hendelser',
      tone: 'danger',
      onClick: () => navigate('/hendelser'),
    },
    ...(mySnus
      ? [{
          key: 'snus',
          icon: AlertCircle,
          label: snusBrothers.length > 0 ? 'Snus brothers' : 'Snus',
          visual: (
            <SnusCan3D
              product={getSnusProduct(mySnus.productId) ?? customSnusProduct(mySnus.customLabel || 'Snus')}
              size={36}
              interactive={false}
              spin={-22}
              hideHint
            />
          ),
          count: snusBrothers.length || undefined,
          onClick: () => {
            if (snusBrothers.length > 0) setSnusBrothersOpen(true);
            else navigate('/profile');
          },
        } as QuickAction]
      : []),
    {
      key: 'postkasse',
      icon: AlertCircle,
      label: 'Postkasse',
      visual: <MailboxIcon3D size={38} />,
      count: isAdmin ? (mailboxUnread || undefined) : undefined,
      badge: !isAdmin && hasNewReply,
      onClick: () => navigate('/postkasse'),
    },
    ...(overnattingEnabled
      ? [{
          key: 'overnatting',
          icon: Tent,
          label: overnattingTitle,
          active: overnattingJoining,
          onClick: () => setOvernattingEditOpen(true),
        } as QuickAction]
      : []),
  ];

  return (
    <div ref={pullRef} className="animate-fade-in -mx-4 lg:-mx-8 -mt-4 lg:-mt-8 pb-24 overflow-y-auto">
      <PullIndicator isPulling={isPulling} isRefreshing={isRefreshing} pullProgress={pullProgress} />
      {/* Profile hero — centered avatar, name and chips */}
      <div className="px-4 pt-3 relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={loadData}
          aria-label="Oppdater"
          className="absolute right-3 top-2 h-9 w-9 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>

        <div className="flex flex-col items-center text-center">
          <Avatar className={cn(
            "h-24 w-24 border-2 shadow-sm ring-2",
            (isAdmin || isNurse || hasRead)
              ? "border-green-500 ring-green-500/20"
              : "border-red-500 ring-red-500/20"
          )}>
            <AvatarImage src={effectiveLeader?.profile_image_url || ''} alt={effectiveLeader?.name} />
            <AvatarFallback className="bg-primary text-primary-foreground font-heading text-xl">
              {effectiveLeader?.name ? getInitials(effectiveLeader.name) : '?'}
            </AvatarFallback>
          </Avatar>

          <h1 className="mt-3 text-xl font-heading font-bold text-foreground">
            {effectiveLeader?.name}
          </h1>

          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
            {mainCabins.length > 0 ? (
              mainCabins.map(cabin => (
                <Badge
                  key={cabin.key}
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
            {effectiveLeader?.ministerpost && (
              <Badge variant="outline" className="text-xs">{effectiveLeader.ministerpost}</Badge>
            )}
            {(() => {
              // "Rommet du skal bo på" (extra_1) vises som en pill sammen med
              // ministerpost/lag i stedet for et eget kort lenger ned.
              const roomConfig = config.find((c) => c.element_key === 'extra_1');
              const roomValue = getExtraFieldValue('extra_1');
              if (!roomConfig || !roomValue) return null;
              const RoomIcon =
                roomConfig.icon && iconMap[roomConfig.icon] ? iconMap[roomConfig.icon] : Info;
              return (
                <Badge variant="outline" className="text-xs">
                  <RoomIcon className="w-3 h-3 mr-1" />
                  {roomValue}
                </Badge>
              );
            })()}
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

        <Sheet open={snusBrothersOpen} onOpenChange={setSnusBrothersOpen}>
          <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <SnusBadge
                  productId={(effectiveLeader as any)?.snus_product_id}
                  customLabel={(effectiveLeader as any)?.snus_custom_label}
                  compact
                  isBrother
                />
                Snus brothers ({snusBrothers.length})
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-2">
              {snusBrothers.map((b: any) => (
                <div key={b.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={b.profile_image_url || undefined} alt={b.name} />
                    <AvatarFallback className="text-xs">{b.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{b.name}</span>
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>

        {/* Round quick actions */}
        <div className="mt-5">
          <HomeQuickActions actions={quickActions} />
        </div>
      </div>

      {/* Content Cards - consistent spacing */}
      <div className="px-4 mt-4 sm:mt-6 space-y-3 sm:space-y-4">
        {/* Deltakeroppdrag fra admin — øverst */}
        <ParticipantTaskCards />

        {/* HERO: Din aktivitet — viktigst, øverst */}
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

        {/* Kjøkkentjeneste i dag */}
        {teamsEnabled && dutyTeamA && dutyTeamB && (
          <Card className="border border-orange-500/30 bg-orange-50/50 dark:bg-orange-950/20 shadow-sm">
            <CardContent className="py-3 sm:py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-orange-500/15 shrink-0">
                  <ChefHat className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-orange-600/80 dark:text-orange-400/80 font-medium mb-1">
                    Kjøkkentjeneste i dag
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[dutyTeamA, dutyTeamB].map((t) => (
                      <button
                        key={t.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/passport?teams=${t.id}`);
                        }}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border transition hover:opacity-80"
                        style={{ backgroundColor: `${t.color}20`, borderColor: `${t.color}80`, color: t.color }}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                        {t.slot}. {t.name}
                      </button>
                    ))}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/passport?teams=${dutyTeamA.id},${dutyTeamB.id}&kitchenDuty=1`)}
                >
                  Vis alle
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Morder-leken: kun ikonet ved profilbildet (ingen kort her) */}
        {showRoulette && (
        <Card
          className="border border-violet-500/30 bg-violet-50/50 dark:bg-violet-950/20 cursor-pointer hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors shadow-sm"
          onClick={() => navigate('/roulette')}
        >
          <CardContent className="py-3 sm:py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-violet-500/15 shrink-0">
                <Dices className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-violet-600/80 dark:text-violet-400/80 font-medium mb-0.5">
                  Oppgave-roulette
                </p>
                <p className="text-sm sm:text-base font-medium text-foreground">
                  Trekk en oppgave og marker den som gjort
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        )}

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
        {/* extra_1 vises som pill i profilheaderen, ikke som kort */}
        {['extra_2', 'extra_3', 'extra_4', 'extra_5'].map((fieldKey) => {
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

        {/* Aktiviteter denne økten — nederst */}
        {isElementVisible('session_activities') && sessionsPayload && (() => {
          const sessionConfig = getConfigForElement('session_activities');
          const activeKey = String(sessionsPayload.active) as '1' | '2' | '3';
          const current = sessionsPayload.sessions[activeKey];
          if (!current || (!current.reminder && !current.items?.length)) return null;
          const reminder = current.reminder?.trim() || '';
          const activities = current.items || [];
          const sessionLabel = `${sessionsPayload.active}. økt`;
          return (
            <div className={cn("ios-surface p-4 space-y-3", getCardStyle(sessionConfig))}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                    <SessionIcon className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-sm font-semibold truncate">
                    {getElementTitle('session_activities', 'Aktiviteter denne økten')}
                  </p>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-muted/70 text-muted-foreground shrink-0">
                  {sessionLabel}
                </span>
              </div>

              {reminder && (
                <div className="rounded-2xl bg-amber-50/80 dark:bg-amber-500/10 ring-1 ring-amber-300/40 dark:ring-amber-500/25 p-3 flex gap-2.5 items-start">
                  <span className="w-7 h-7 rounded-full bg-amber-400/25 flex items-center justify-center shrink-0">
                    <Bell className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700/80 dark:text-amber-300/80">
                      Viktig
                    </p>
                    <p className="text-sm text-amber-900 dark:text-amber-100 leading-snug">{reminder}</p>
                  </div>
                </div>
              )}

              {activities.length > 0 && (
                <ul className="space-y-1.5">
                  {activities.map((a, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 rounded-2xl bg-muted/40 px-3 py-2.5"
                    >
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-primary/70 shrink-0" />
                      <span className={cn("text-foreground leading-snug", getTextStyle(sessionConfig))}>{a}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })()}

        {/* Morder-leken — liten boks helt nederst */}
        {showMurder && (
          <button
            type="button"
            onClick={() => navigate('/morder')}
            className="w-full flex items-center gap-3 rounded-2xl bg-foreground/90 px-4 py-3 text-left shadow-sm active:scale-[0.99] transition-transform"
          >
            <span className="relative w-9 h-9 rounded-xl bg-background/15 flex items-center justify-center shrink-0">
              <Skull className="w-5 h-5 text-background" />
              {murderState?.incoming_claim_id && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-destructive ring-2 ring-foreground" />
              )}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-background">Morder-leken</span>
              <span className="block text-[11px] text-background/70">
                {murderState?.incoming_claim_id ? 'Noen hevder å ha drept deg' : 'Åpne for å se målet ditt'}
              </span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-background/80">Åpne</span>
          </button>
        )}

      </div>

      {/* Overnatting: tvunget førstegangssvar */}
      {overnattingEnabled && !overnattingAnswered && (
        <OvernattingGateDialog
          open
          title={overnattingTitle}
          question={overnattingQuestion}
          onAnswer={handleOvernattingToggle}
        />
      )}

      {/* Overnatting: endre svar */}
      {overnattingEnabled && (
        <OvernattingEditDialog
          open={overnattingEditOpen}
          onOpenChange={setOvernattingEditOpen}
          title={overnattingTitle}
          question={overnattingQuestion}
          joining={overnattingJoining}
          onAnswer={handleOvernattingToggle}
        />
      )}
    </div>
  );
}