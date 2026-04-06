import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Edit, MapPin, FileText, AlertTriangle, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTeamStyles, formatTeamDisplay, formatTeamDisplayMobile, getFirstName } from '@/lib/teamUtils';
import type { LeaderWithContent } from '@/hooks/useLeaderDashboardData';
import { useAuth } from '@/contexts/AuthContext';

interface LeaderCardProps {
  leader: LeaderWithContent;
  onEdit: (leader: LeaderWithContent) => void;
}

export const LeaderCard = React.memo(function LeaderCard({ leader, onEdit }: LeaderCardProps) {
  const { setViewAsLeader } = useAuth();
  const navigate = useNavigate();
  const content = leader.content;
  const hasObs = !!content?.obs_message;
  const hasActivity = !!content?.current_activity;
  const hasExtraActivity = !!content?.extra_activity;
  const hasNotes = !!content?.personal_notes;

  const isFri = content?.current_activity?.toLowerCase().includes('fri');
  const isKitchen = leader.team?.toLowerCase() === 'kjøkken' || leader.team?.toLowerCase() === 'kjokken';
  const isLeaderAdmin = leader.isAdmin;
  const isNurse = leader.isNurse;
  const isAdminOrNurse = isLeaderAdmin || isNurse;

  const getBorderClass = () => {
    if (isAdminOrNurse) return 'ring-green-500';
    if (isKitchen) return 'ring-purple-500';
    if (isFri) return 'ring-blue-500';
    if (content?.has_read) return 'ring-green-500';
    return 'ring-red-500';
  };

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all hover:shadow-md cursor-pointer ring-2',
        'h-[100px] sm:h-auto sm:min-h-[220px]',
        getBorderClass()
      )}
      onClick={() => onEdit(leader)}
    >
      <CardContent className="p-2 sm:p-4 h-full flex flex-col">
        <div className="flex items-center sm:items-start gap-2 sm:gap-3 sm:mb-3">
          <Avatar className="w-8 h-8 sm:w-12 sm:h-12 border-2 border-primary/20 shrink-0">
            {leader.profile_image_url && (
              <AvatarImage src={leader.profile_image_url} alt={leader.name} loading="lazy" />
            )}
            <AvatarFallback className="bg-primary/10 text-primary text-xs sm:text-sm font-medium">
              {getFirstName(leader.name).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-xs sm:text-base truncate">
              {getFirstName(leader.name)}
            </h3>
            {leader.ministerpost && (
              <p className="hidden sm:block text-xs text-muted-foreground truncate">
                {leader.ministerpost}
              </p>
            )}
          </div>

          {hasObs && (
            <span className="sm:hidden w-2.5 h-2.5 rounded-full bg-destructive shrink-0 animate-pulse" title="OBS-melding" />
          )}

          {(leader.team || isLeaderAdmin || isNurse) && (
            <>
              <Badge className={cn("sm:hidden text-[10px] px-1.5 py-0 shrink-0", getTeamStyles(isLeaderAdmin ? 'sjef' : isNurse ? 'nurse' : leader.team))}>
                {formatTeamDisplayMobile(leader.team, isLeaderAdmin, isNurse)}
              </Badge>
              <Badge className={cn("hidden sm:inline-flex text-xs", getTeamStyles(leader.team))}>
                {formatTeamDisplay(leader.team)}
              </Badge>
            </>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="hidden sm:flex h-8 w-8 shrink-0"
            title="Se som denne lederen"
            onClick={(e) => { e.stopPropagation(); setViewAsLeader(leader); navigate('/'); }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden sm:flex h-8 w-8 shrink-0"
            onClick={(e) => { e.stopPropagation(); onEdit(leader); }}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 mt-1 sm:mt-0 space-y-0.5 sm:space-y-2 min-h-0">
          <div className="flex items-center sm:items-start gap-1 sm:gap-2">
            <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-primary shrink-0 sm:mt-0.5" />
            <p className={cn("text-xs sm:text-sm truncate", hasActivity ? 'text-foreground' : 'text-muted-foreground italic')}>
              {hasActivity ? content?.current_activity : '—'}
            </p>
          </div>

          <div className="flex items-center sm:items-start gap-1 sm:gap-2">
            <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0 sm:mt-0.5" />
            <p className={cn("text-xs sm:text-sm truncate", hasExtraActivity ? 'text-muted-foreground' : 'text-transparent')}>
              {hasExtraActivity ? content?.extra_activity : '—'}
            </p>
          </div>

          <div className="hidden sm:flex items-start gap-2">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className={cn("text-sm line-clamp-2", hasNotes ? 'text-foreground' : 'text-muted-foreground italic')}>
              {hasNotes ? content?.personal_notes : 'Ingen notater'}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex flex-wrap gap-1.5 mb-3">
          {leader.cabin && <Badge variant="outline" className="text-xs">{leader.cabin}</Badge>}
        </div>

        {hasObs && (
          <Alert variant="destructive" className="hidden sm:flex mt-3 py-2 px-3 items-center justify-center text-center">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <AlertDescription className="text-xs line-clamp-2">{content?.obs_message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
});
