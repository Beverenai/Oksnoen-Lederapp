import { Badge } from '@/components/ui/badge';
import { useTeamsEnabled } from '@/hooks/useTeamsEnabled';
import { useTeamMap } from '@/hooks/useParticipantTeams';

interface TeamBadgeProps {
  teamId: string | null | undefined;
  size?: 'sm' | 'md';
}

/**
 * Small pill showing a participant's team name + color.
 * Renders nothing when the teams feature is disabled or the participant has no team.
 */
export function TeamBadge({ teamId, size = 'sm' }: TeamBadgeProps) {
  const enabled = useTeamsEnabled();
  const teamMap = useTeamMap();

  if (!enabled || !teamId) return null;
  const team = teamMap.get(teamId);
  if (!team) return null;

  return (
    <Badge
      variant="outline"
      className={size === 'sm' ? 'text-[10px] px-1.5 py-0 gap-1 whitespace-nowrap' : 'text-xs px-2 py-0.5 gap-1.5'}
      style={{
        backgroundColor: `${team.color}20`,
        borderColor: `${team.color}80`,
        color: team.color,
      }}
    >
      <span
        className={size === 'sm' ? 'w-2 h-2 rounded-full' : 'w-2.5 h-2.5 rounded-full'}
        style={{ backgroundColor: team.color }}
      />
      {team.name}
    </Badge>
  );
}