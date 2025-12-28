import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Phone, Car, Anchor, Mountain } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Leader = Tables<'leaders'>;

interface LeaderWithRole extends Leader {
  isAdmin?: boolean;
  isNurse?: boolean;
}

export default function Leaders() {
  const [leaders, setLeaders] = useState<LeaderWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLeaders();
  }, []);

  const loadLeaders = async () => {
    try {
      // Only fetch active leaders
      const { data: leadersData } = await supabase
        .from('leaders')
        .select('*')
        .eq('is_active', true)
        .order('name');

      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('leader_id, role');

      const adminIds = new Set(rolesData?.filter(r => r.role === 'admin').map(r => r.leader_id) || []);
      const nurseIds = new Set(rolesData?.filter(r => r.role === 'nurse').map(r => r.leader_id) || []);

      const leadersWithRoles = (leadersData || []).map((leader) => ({
        ...leader,
        isAdmin: adminIds.has(leader.id),
        isNurse: nurseIds.has(leader.id),
      }));

      setLeaders(leadersWithRoles);
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
          Ledere
        </h1>
        <p className="text-muted-foreground mt-1">
          {leaders.length} ledere registrert
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {leaders.map((leader) => (
          <Card key={leader.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Avatar className="w-12 h-12">
                  {leader.profile_image_url && (
                    <AvatarImage src={leader.profile_image_url} alt={leader.name} />
                  )}
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {leader.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground truncate">
                      {leader.name}
                    </p>
                    {leader.isAdmin && <Badge variant="default" className="shrink-0">Admin</Badge>}
                    {leader.isNurse && <Badge variant="secondary" className="shrink-0">Sykepleier</Badge>}
                  </div>
                  {leader.ministerpost && (
                    <p className="text-xs text-primary font-medium mt-0.5">{leader.ministerpost}</p>
                  )}
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <Phone className="w-3 h-3" />
                    <span>{leader.phone}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {leader.cabin && <Badge variant="outline">{leader.cabin}</Badge>}
                    {leader.team && <Badge variant="secondary">{leader.team}</Badge>}
                  </div>
                  {/* Certifications */}
                  <div className="flex gap-1 mt-2">
                    {leader.has_drivers_license && <Car className="w-4 h-4 text-muted-foreground" />}
                    {leader.has_boat_license && <Anchor className="w-4 h-4 text-muted-foreground" />}
                    {(leader.can_rappelling || leader.can_climbing || leader.can_zipline) && (
                      <Mountain className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
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
    </div>
  );
}
