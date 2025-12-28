import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Phone, Users } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Leader = Tables<'leaders'>;
type LeaderContent = Tables<'leader_content'>;

interface LeaderWithContent extends Leader {
  content?: LeaderContent | null;
}

// Team color styles
const teamStyles: Record<string, { bg: string; text: string; border: string }> = {
  '1': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  '2': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  '1f': { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
  '2f': { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
};

const getTeamStyles = (team: string | null) => {
  if (!team) return 'bg-muted text-muted-foreground border-border';
  const style = teamStyles[team.toLowerCase()];
  if (style) {
    return `${style.bg} ${style.text} ${style.border}`;
  }
  return 'bg-muted text-muted-foreground border-border';
};

const formatTeamDisplay = (team: string | null): string => {
  if (!team) return '';
  const teamLower = team.toLowerCase().trim();
  if (['1', '2', '1f', '2f'].includes(teamLower)) {
    return `Team ${team.toUpperCase()}`;
  }
  return team;
};

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export default function Team() {
  const { team } = useParams<{ team: string }>();
  const navigate = useNavigate();
  const [leaders, setLeaders] = useState<LeaderWithContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!team) return;

      setIsLoading(true);

      // Fetch leaders matching this team (case-insensitive)
      const { data: leadersData, error: leadersError } = await supabase
        .from('leaders')
        .select('*')
        .ilike('team', team)
        .eq('is_active', true)
        .order('name');

      if (leadersError) {
        console.error('Error fetching team members:', leadersError);
        setIsLoading(false);
        return;
      }

      if (!leadersData || leadersData.length === 0) {
        setLeaders([]);
        setIsLoading(false);
        return;
      }

      // Fetch content for all leaders
      const leaderIds = leadersData.map((l) => l.id);
      const { data: contentData } = await supabase
        .from('leader_content')
        .select('*')
        .in('leader_id', leaderIds);

      // Combine leaders with their content
      const leadersWithContent: LeaderWithContent[] = leadersData.map((leader) => ({
        ...leader,
        content: contentData?.find((c) => c.leader_id === leader.id) || null,
      }));

      setLeaders(leadersWithContent);
      setIsLoading(false);
    };

    fetchTeamMembers();
  }, [team]);

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-4">
          <Skeleton className="h-10 w-32 mb-6" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Badge className={`${getTeamStyles(team || null)} text-sm px-3 py-1`}>
              <Users className="w-3.5 h-3.5 mr-1.5" />
              {formatTeamDisplay(team || null)}
            </Badge>
            <span className="text-muted-foreground text-sm">
              ({leaders.length} {leaders.length === 1 ? 'medlem' : 'medlemmer'})
            </span>
          </div>
        </div>
      </div>

      {/* Team members list */}
      <div className="p-4 space-y-3">
        {leaders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Ingen medlemmer funnet i dette teamet</p>
          </div>
        ) : (
          leaders.map((leader) => (
            <Card key={leader.id} className="p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14 border-2 border-border">
                  <AvatarImage src={leader.profile_image_url || ''} alt={leader.name} />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {getInitials(leader.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{leader.name}</h3>
                  {leader.ministerpost && (
                    <p className="text-sm text-muted-foreground truncate">
                      {leader.ministerpost}
                    </p>
                  )}
                  {leader.content?.current_activity && (
                    <p className="text-xs text-primary mt-1 truncate">
                      📍 {leader.content.current_activity}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 h-10 w-10"
                  onClick={() => handleCall(leader.phone)}
                >
                  <Phone className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
