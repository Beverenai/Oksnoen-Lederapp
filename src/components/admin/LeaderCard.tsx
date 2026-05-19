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
        'h-[100px] sm:h-[240px] flex flex-col',
        getBorderClass()
      )}
      onClick={() => onEdit(leader)}
    >
      <CardContent className="p-2 sm:p-4 h-full flex flex-col gap-2 sm:gap-3">
        <div className="flex items-center sm:items-start gap-2 sm:gap-3">
          <Avatar className="w-8 h-8 sm:w-11 sm:h-11 shrink-0">
            {leader.profile_image_url && (
              <AvatarImage src={leader.profile_image_url} alt={leader.name} loading="lazy" className="object-cover" />
            )}
            <AvatarFallback className="bg-muted text-muted-foreground text-xs sm:text-sm font-medium">
              {getFirstName(leader.name).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-xs sm:text-sm truncate leading-tight">
              {getFirstName(leader.name)}
            </h3>
            {leader.ministerpost && (
              <p className="hidden sm:block text-[11px] text-muted-foreground truncate mt-0.5">
                {leader.ministerpost}
              </p>
            )}
            {leader.cabin && (
              <p className="hidden sm:block text-[11px] text-muted-foreground truncate">
                {leader.cabin}
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
              <Badge className={cn("hidden sm:inline-flex text-[10px] px-1.5 py-0 h-5 shrink-0 self-start", getTeamStyles(isLeaderAdmin ? 'sjef' : isNurse ? 'nurse' : leader.team))}>
                {formatTeamDisplay(leader.team)}
              </Badge>
            </>
          )}
        </div>

        {/* Mobile: compact activity row */}
        <div className="sm:hidden flex-1 min-h-0">
          {hasActivity && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3 text-primary shrink-0" />
              <p className="text-xs truncate text-foreground">{content?.current_activity}</p>
            </div>
          )}
        </div>

        {/* Desktop: structured content */}
        <div className="hidden sm:flex flex-1 flex-col gap-1.5 min-h-0">
          {hasActivity && (
            <div className="flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-foreground truncate flex-1">{content?.current_activity}</p>
            </div>
          )}
          {hasExtraActivity && (
            <div className="flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground truncate flex-1">{content?.extra_activity}</p>
            </div>
          )}
          {hasNotes && (
            <div className="flex items-start gap-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-foreground line-clamp-2 flex-1">{content?.personal_notes}</p>
            </div>
          )}
        </div>

        {/* Desktop footer: actions + OBS */}
        <div className="hidden sm:flex items-center justify-between gap-2 mt-auto pt-2 border-t border-border/50">
          {hasObs ? (
            <div className="flex items-center gap-1.5 text-destructive min-w-0 flex-1">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[11px] truncate">{content?.obs_message}</span>
            </div>
          ) : isAdminOrNurse ? (
            <span className="text-[11px] text-muted-foreground/60" />
          ) : (
            <span className="text-[11px] text-muted-foreground/60">
              {content?.has_read ? 'Lest' : 'Ulest'}
            </span>
          )}
          <div className="flex gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Se som denne lederen"
              onClick={(e) => { e.stopPropagation(); setViewAsLeader(leader); navigate('/'); }}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => { e.stopPropagation(); onEdit(leader); }}
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
