import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Phone, Activity, Cross } from 'lucide-react';
import { LeaderDetailSheet } from '@/components/leaders/LeaderDetailSheet';
import type { Tables } from '@/integrations/supabase/types';

type Leader = Tables<'leaders'>;
type LeaderContent = Tables<'leader_content'>;
type ExtraFieldConfig = Tables<'extra_fields_config'>;

interface LeaderWithContent extends Leader {
  content?: LeaderContent | null;
  isAdmin?: boolean;
  isNurse?: boolean;
}

// Team color mapping based on provided design
const getTeamStyles = (team: string | null): string => {
  const teamLower = team?.toLowerCase().trim();
  switch (teamLower) {
    case 'team 1':
      return 'bg-red-500 text-white border-red-500';
    case 'team 2':
      return 'bg-orange-500 text-white border-orange-500';
    case 'team 1f':
      return 'bg-yellow-400 text-black border-yellow-400';
    case 'team 2f':
      return 'bg-blue-500 text-white border-blue-500';
    case 'kjøkken':
      return 'bg-purple-500 text-white border-purple-500';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

export default function Leaders() {
  const [leaders, setLeaders] = useState<LeaderWithContent[]>([]);
  const [extraFieldsConfig, setExtraFieldsConfig] = useState<ExtraFieldConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLeader, setSelectedLeader] = useState<LeaderWithContent | null>(null);

  useEffect(() => {
    loadLeaders();
  }, []);

  const loadLeaders = async () => {
    try {
      // Fetch leaders, content, roles, and extra fields config in parallel
      const [leadersRes, contentRes, rolesRes, configRes] = await Promise.all([
        supabase
          .from('leaders')
          .select('*')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('leader_content')
          .select('*'),
        supabase
          .from('user_roles')
          .select('leader_id, role'),
        supabase
          .from('extra_fields_config')
          .select('*')
          .eq('is_visible', true)
          .order('sort_order')
      ]);

      const leadersData = leadersRes.data || [];
      const contentData = contentRes.data || [];
      const rolesData = rolesRes.data || [];
      const configData = configRes.data || [];

      // Create lookup maps
      const contentMap = new Map(contentData.map(c => [c.leader_id, c]));
      const adminIds = new Set(rolesData.filter(r => r.role === 'admin').map(r => r.leader_id));
      const nurseIds = new Set(rolesData.filter(r => r.role === 'nurse').map(r => r.leader_id));

      const leadersWithContent: LeaderWithContent[] = leadersData.map((leader) => ({
        ...leader,
        content: contentMap.get(leader.id) || null,
        isAdmin: adminIds.has(leader.id),
        isNurse: nurseIds.has(leader.id),
      }));

      setLeaders(leadersWithContent);
      setExtraFieldsConfig(configData);
    } catch (error) {
      console.error('Error loading leaders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get first name only
  const getFirstName = (fullName: string) => fullName.split(' ')[0];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">
          Ledere
        </h1>
        <p className="text-sm text-muted-foreground">
          {leaders.length} ledere registrert
        </p>
      </div>

      <div className="grid gap-2">
        {leaders.map((leader) => (
          <Card 
            key={leader.id} 
            className="cursor-pointer hover:bg-accent/50 transition-colors active:scale-[0.99]"
            onClick={() => setSelectedLeader(leader)}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                {/* Profile image */}
                <Avatar className="w-12 h-12 shrink-0">
                  {leader.profile_image_url && (
                    <AvatarImage src={leader.profile_image_url} alt={leader.name} />
                  )}
                  <AvatarFallback className="bg-primary/10 text-primary text-base">
                    {getFirstName(leader.name).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground">
                      {getFirstName(leader.name)}
                    </p>
                    {leader.isAdmin && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-slate-500 text-white border-slate-500">
                        Admin
                      </Badge>
                    )}
                    {leader.isNurse && (
                      <span className="text-red-600 flex items-center" title="Sykepleier">
                        <Cross className="w-4 h-4" fill="currentColor" />
                      </span>
                    )}
                  </div>
                  
                  {leader.ministerpost && (
                    <p className="text-xs text-muted-foreground truncate">
                      {leader.ministerpost}
                    </p>
                  )}
                  
                  {/* Activity - prominent */}
                  {leader.content?.current_activity && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Activity className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-sm font-medium text-primary truncate">
                        {leader.content.current_activity}
                      </span>
                    </div>
                  )}

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {leader.team && (
                      <Badge className={`text-[10px] px-1.5 py-0 ${getTeamStyles(leader.team)}`}>
                        {leader.team}
                      </Badge>
                    )}
                    {leader.cabin && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {leader.cabin}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Call button - smaller */}
                <Button
                  variant="default"
                  size="icon"
                  className="shrink-0 bg-green-600 hover:bg-green-700 text-white rounded-full h-9 w-9"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `tel:${leader.phone}`;
                  }}
                >
                  <Phone className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {leaders.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">Ingen ledere</h3>
            <p className="text-muted-foreground mt-1">
              Kontakt admin for å bli lagt til
            </p>
          </CardContent>
        </Card>
      )}

      {/* Leader detail sheet */}
      <LeaderDetailSheet
        leader={selectedLeader}
        open={!!selectedLeader}
        onOpenChange={(open) => !open && setSelectedLeader(null)}
        extraFieldsConfig={extraFieldsConfig}
      />
    </div>
  );
}
