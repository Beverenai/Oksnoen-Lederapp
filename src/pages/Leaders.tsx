import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Phone, Activity } from 'lucide-react';
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

      <div className="grid gap-3">
        {leaders.map((leader) => (
          <Card 
            key={leader.id} 
            className="cursor-pointer hover:bg-accent/50 transition-colors active:scale-[0.99]"
            onClick={() => setSelectedLeader(leader)}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                {/* Profile image */}
                <Avatar className="w-14 h-14 shrink-0">
                  {leader.profile_image_url && (
                    <AvatarImage src={leader.profile_image_url} alt={leader.name} />
                  )}
                  <AvatarFallback className="bg-primary/10 text-primary text-lg">
                    {leader.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">
                    {leader.name}
                  </p>
                  {leader.ministerpost && (
                    <p className="text-xs text-primary font-medium truncate">
                      {leader.ministerpost}
                    </p>
                  )}
                  
                  {/* Activity */}
                  {leader.content?.current_activity && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Activity className="w-3 h-3" />
                      <span className="truncate">{leader.content.current_activity}</span>
                    </div>
                  )}

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {leader.team && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">
                        {leader.team}
                      </Badge>
                    )}
                    {leader.cabin && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0">
                        {leader.cabin}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Call button */}
                <Button
                  variant="default"
                  size="icon"
                  className="shrink-0 bg-green-600 hover:bg-green-700 text-white rounded-full h-11 w-11"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `tel:${leader.phone}`;
                  }}
                >
                  <Phone className="w-5 h-5" />
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
