import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Home, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, Loader2, UserX } from 'lucide-react';

interface LeaderCabinInfo {
  id: string;
  name: string;
  cabin: string | null; // The raw cabin text from import
  linkedCabins: string[]; // Actual cabin names from leader_cabins join
  team: string | null;
  isExempt: boolean; // Whether leader is exempt from cabin responsibility
  exemptReason: string | null; // Why they are exempt
}

interface CabinAssignmentStats {
  total: number;
  withCabins: number;
  withoutCabins: number;
  exempt: number;
  percentage: number;
}

// Teams that are exempt from cabin responsibility
const EXEMPT_TEAMS = ['kjøkken'];

// Roles that are exempt from cabin responsibility
const EXEMPT_ROLES = ['admin', 'nurse'];

export interface CabinAssignmentStatusRef {
  refresh: () => void;
}

export const CabinAssignmentStatus = forwardRef<CabinAssignmentStatusRef>((_, ref) => {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<CabinAssignmentStats>({ total: 0, withCabins: 0, withoutCabins: 0, exempt: 0, percentage: 0 });
  const [leadersWithCabins, setLeadersWithCabins] = useState<LeaderCabinInfo[]>([]);
  const [leadersWithoutCabins, setLeadersWithoutCabins] = useState<LeaderCabinInfo[]>([]);
  const [exemptLeaders, setExemptLeaders] = useState<LeaderCabinInfo[]>([]);
  const [withCabinsOpen, setWithCabinsOpen] = useState(false);
  const [withoutCabinsOpen, setWithoutCabinsOpen] = useState(true);
  const [exemptOpen, setExemptOpen] = useState(false);

  const loadCabinAssignmentStats = async () => {
    setIsLoading(true);
    try {
      // Fetch all active leaders with their cabin associations
      const { data: leaders, error: leadersError } = await supabase
        .from('leaders')
        .select(`
          id,
          name,
          cabin,
          team,
          leader_cabins (
            cabin_id,
            cabins (
              name
            )
          )
        `)
        .eq('is_active', true)
        .neq('phone', '12345678')
        .order('name');

      if (leadersError) throw leadersError;

      // Fetch user roles to check for admin/nurse
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('leader_id, role');

      const rolesMap = new Map<string, string[]>();
      (userRoles || []).forEach((r) => {
        const existing = rolesMap.get(r.leader_id) || [];
        existing.push(r.role);
        rolesMap.set(r.leader_id, existing);
      });

      const withCabins: LeaderCabinInfo[] = [];
      const withoutCabins: LeaderCabinInfo[] = [];
      const exempt: LeaderCabinInfo[] = [];

      (leaders || []).forEach((leader: any) => {
        const linkedCabins = (leader.leader_cabins || [])
          .map((lc: any) => lc.cabins?.name)
          .filter(Boolean);

        // Check if leader is exempt
        const isTeamExempt = leader.team && EXEMPT_TEAMS.includes(leader.team.toLowerCase());
        const leaderRoles = rolesMap.get(leader.id) || [];
        const hasExemptRole = leaderRoles.some(role => EXEMPT_ROLES.includes(role));
        const isExempt = isTeamExempt || hasExemptRole;
        
        let exemptReason: string | null = null;
        if (isTeamExempt) {
          exemptReason = `Team: ${leader.team}`;
        } else if (hasExemptRole) {
          exemptReason = `Rolle: ${leaderRoles.filter(r => EXEMPT_ROLES.includes(r)).join(', ')}`;
        }

        const leaderInfo: LeaderCabinInfo = {
          id: leader.id,
          name: leader.name,
          cabin: leader.cabin,
          linkedCabins,
          team: leader.team,
          isExempt,
          exemptReason,
        };

        if (isExempt) {
          exempt.push(leaderInfo);
        } else if (linkedCabins.length > 0) {
          withCabins.push(leaderInfo);
        } else {
          withoutCabins.push(leaderInfo);
        }
      });

      // Total excludes exempt leaders for percentage calculation
      const totalNonExempt = withCabins.length + withoutCabins.length;
      setStats({
        total: totalNonExempt,
        withCabins: withCabins.length,
        withoutCabins: withoutCabins.length,
        exempt: exempt.length,
        percentage: totalNonExempt > 0 ? Math.round((withCabins.length / totalNonExempt) * 100) : 0,
      });
      setLeadersWithCabins(withCabins);
      setLeadersWithoutCabins(withoutCabins);
      setExemptLeaders(exempt);
    } catch (error) {
      console.error('Error loading cabin assignment stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    refresh: loadCabinAssignmentStats
  }));

  useEffect(() => {
    loadCabinAssignmentStats();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="w-5 h-5" />
            Hyttetilknytning Status
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Home className="w-5 h-5" />
              Hyttetilknytning Status
            </CardTitle>
            <CardDescription>
              Oversikt over lederes kobling til hytter i databasen
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={loadCabinAssignmentStats}>
            <Loader2 className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats overview */}
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Med hytteansvar</div>
          </div>
          <div className="p-3 rounded-lg bg-green-500/10 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.withCabins}</div>
            <div className="text-xs text-green-600/80">Med tilknytning</div>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 text-center">
            <div className="text-2xl font-bold text-amber-600">{stats.withoutCabins}</div>
            <div className="text-xs text-amber-600/80">Uten tilknytning</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-500/10 text-center">
            <div className="text-2xl font-bold text-slate-600">{stats.exempt}</div>
            <div className="text-xs text-slate-600/80">Unntatt</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tilknytningsgrad</span>
            <span className="font-medium">{stats.percentage}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 transition-all duration-500"
              style={{ width: `${stats.percentage}%` }}
            />
          </div>
        </div>

        {/* Leaders without cabins */}
        {leadersWithoutCabins.length > 0 && (
          <Collapsible open={withoutCabinsOpen} onOpenChange={setWithoutCabinsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-3 h-auto">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="font-medium">Mangler tilknytning ({leadersWithoutCabins.length})</span>
                </div>
                {withoutCabinsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-1 pt-2 max-h-64 overflow-y-auto">
                {leadersWithoutCabins.map((leader) => (
                  <div key={leader.id} className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm">
                    <span className="font-medium">{leader.name}</span>
                    {leader.cabin && (
                      <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/30">
                        Import: "{leader.cabin}"
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Leaders with cabins */}
        {leadersWithCabins.length > 0 && (
          <Collapsible open={withCabinsOpen} onOpenChange={setWithCabinsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-3 h-auto">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="font-medium">Med tilknytning ({leadersWithCabins.length})</span>
                </div>
                {withCabinsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-1 pt-2 max-h-64 overflow-y-auto">
                {leadersWithCabins.map((leader) => (
                  <div key={leader.id} className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm">
                    <span className="font-medium">{leader.name}</span>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {leader.linkedCabins.map((cabin, i) => (
                        <Badge key={i} variant="outline" className="text-xs bg-green-500/10 text-green-700 border-green-500/30">
                          {cabin}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Exempt leaders */}
        {exemptLeaders.length > 0 && (
          <Collapsible open={exemptOpen} onOpenChange={setExemptOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-3 h-auto">
                <div className="flex items-center gap-2">
                  <UserX className="w-4 h-4 text-slate-500" />
                  <span className="font-medium">Unntatt fra hytteansvar ({exemptLeaders.length})</span>
                </div>
                {exemptOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-1 pt-2 max-h-64 overflow-y-auto">
                {exemptLeaders.map((leader) => (
                  <div key={leader.id} className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm">
                    <span className="font-medium">{leader.name}</span>
                    {leader.exemptReason && (
                      <Badge variant="outline" className="text-xs bg-slate-500/10 text-slate-700 border-slate-500/30">
                        {leader.exemptReason}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {stats.total === 0 && exemptLeaders.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            Ingen aktive ledere funnet
          </div>
        )}
      </CardContent>
    </Card>
  );
});
