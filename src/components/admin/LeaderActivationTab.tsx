import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Search, UserCheck, UserX, Users, ShieldCheck, ShieldOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hapticSuccess, hapticError } from '@/lib/capacitorHaptics';
import type { Tables } from '@/integrations/supabase/types';

type AppRole = 'superadmin' | 'admin' | 'nurse' | 'leader';

interface LeaderWithRole extends Tables<'leaders'> {
  role: AppRole;
}

interface LeaderActivationTabProps {
  leaders: LeaderWithRole[];
  onLeaderUpdated: () => void;
  isSuperAdmin: boolean;
}

type FilterTab = 'all' | 'active' | 'inactive';

const ROLE_ORDER: Record<AppRole, number> = { superadmin: 0, admin: 1, leader: 2, nurse: 2 };

function getRoleBadge(role: AppRole) {
  switch (role) {
    case 'superadmin':
      return <Badge className="bg-amber-500 text-white text-[10px] px-1.5">Superadmin</Badge>;
    case 'admin':
      return <Badge className="bg-blue-600 text-white text-[10px] px-1.5">Admin</Badge>;
    case 'nurse':
      return <Badge className="bg-emerald-600 text-white text-[10px] px-1.5">Sykepleier</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px] px-1.5">Leder</Badge>;
  }
}

export function LeaderActivationTab({ leaders, onLeaderUpdated, isSuperAdmin }: LeaderActivationTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [confirmDeactivate, setConfirmDeactivate] = useState<LeaderWithRole | null>(null);
  const [confirmRoleChange, setConfirmRoleChange] = useState<{ leader: LeaderWithRole; action: 'grant' | 'revoke' } | null>(null);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const filteredLeaders = useMemo(() => {
    let result = [...leaders];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l => l.name.toLowerCase().includes(q) || l.phone.includes(q));
    }

    if (filterTab === 'active') result = result.filter(l => l.is_active !== false);
    if (filterTab === 'inactive') result = result.filter(l => l.is_active === false);

    // Sort: superadmin → admin → active leaders → inactive leaders, then alphabetical
    return result.sort((a, b) => {
      const aRoleOrder = ROLE_ORDER[a.role] ?? 3;
      const bRoleOrder = ROLE_ORDER[b.role] ?? 3;
      if (aRoleOrder !== bRoleOrder) return aRoleOrder - bRoleOrder;
      const aActive = a.is_active !== false ? 0 : 1;
      const bActive = b.is_active !== false ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return a.name.localeCompare(b.name, 'nb');
    });
  }, [leaders, searchQuery, filterTab]);

  const activeCount = leaders.filter(l => l.is_active !== false).length;
  const inactiveCount = leaders.length - activeCount;

  // Can this user toggle the given leader's active status?
  const canToggle = (leader: LeaderWithRole): { allowed: boolean; reason?: string } => {
    if (leader.role === 'superadmin') return { allowed: false, reason: 'Superadmin kan ikke deaktiveres' };
    if (!isSuperAdmin && (leader.role === 'admin')) return { allowed: false, reason: 'Kun superadmin kan endre admin-er' };
    return { allowed: true };
  };

  const toggleActive = async (leader: LeaderWithRole, newActive: boolean) => {
    if (!newActive) {
      setConfirmDeactivate(leader);
      return;
    }
    await performToggle(leader, newActive);
  };

  const performToggle = async (leader: LeaderWithRole, newActive: boolean) => {
    setUpdatingIds(prev => new Set(prev).add(leader.id));
    try {
      const { error } = await supabase.from('leaders').update({ is_active: newActive }).eq('id', leader.id);
      if (error) throw error;
      hapticSuccess();
      showSuccess(`${leader.name} er nå ${newActive ? 'aktiv' : 'deaktivert'}`);
      onLeaderUpdated();
    } catch {
      hapticError();
      showError(`Kunne ikke oppdatere ${leader.name}`);
    } finally {
      setUpdatingIds(prev => { const s = new Set(prev); s.delete(leader.id); return s; });
    }
  };

  const handleConfirmDeactivate = async () => {
    if (confirmDeactivate) {
      await performToggle(confirmDeactivate, false);
      setConfirmDeactivate(null);
    }
  };

  const handleAdminRoleChange = async () => {
    if (!confirmRoleChange) return;
    const { leader, action } = confirmRoleChange;
    setUpdatingIds(prev => new Set(prev).add(leader.id));
    try {
      const { error } = await supabase.functions.invoke('manage-roles', {
        body: {
          leader_id: leader.id,
          role: 'admin',
          action: action === 'grant' ? 'add' : 'remove',
        }
      });
      if (error) throw error;
      hapticSuccess();
      showSuccess(action === 'grant' ? `${leader.name} er nå admin` : `Admin-rolle fjernet fra ${leader.name}`);
      onLeaderUpdated();
    } catch {
      hapticError();
      showError('Kunne ikke endre rolle');
    } finally {
      setUpdatingIds(prev => { const s = new Set(prev); s.delete(leader.id); return s; });
      setConfirmRoleChange(null);
    }
  };

  const bulkUpdate = async (activate: boolean) => {
    setIsBulkUpdating(true);
    try {
      // Bulk only affects regular leaders, not admins or superadmin
      const targetIds = leaders
        .filter(l => l.role === 'leader' || l.role === 'nurse')
        .filter(l => activate ? l.is_active === false : l.is_active !== false)
        .map(l => l.id);

      if (targetIds.length === 0) {
        showInfo(activate ? 'Alle ledere er allerede aktive' : 'Alle ledere er allerede deaktiverte');
        return;
      }

      const { error } = await supabase.from('leaders').update({ is_active: activate }).in('id', targetIds);
      if (error) throw error;
      hapticSuccess();
      showSuccess(`${targetIds.length} ledere ${activate ? 'aktivert' : 'deaktivert'}`);
      onLeaderUpdated();
    } catch {
      hapticError();
      showError('Kunne ikke oppdatere ledere');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const filterTabs: { value: FilterTab; label: string; count: number }[] = [
    { value: 'all', label: 'Alle', count: leaders.length },
    { value: 'active', label: 'Aktive', count: activeCount },
    { value: 'inactive', label: 'Inaktive', count: inactiveCount },
  ];

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Søk på navn eller telefonnummer..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>

        {/* Filter tabs + Bulk actions */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1">
            {filterTabs.map(tab => (
              <Button key={tab.value} variant={filterTab === tab.value ? 'default' : 'outline'} size="sm" onClick={() => setFilterTab(tab.value)} className="gap-1 text-xs sm:text-sm">
                {tab.value === 'all' && <Users className="h-3.5 w-3.5" />}
                {tab.value === 'active' && <UserCheck className="h-3.5 w-3.5" />}
                {tab.value === 'inactive' && <UserX className="h-3.5 w-3.5" />}
                {tab.label}
                <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-0.5">{tab.count}</Badge>
              </Button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" onClick={() => bulkUpdate(true)} disabled={isBulkUpdating} className="text-xs gap-1">
              <UserCheck className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Aktiver alle ledere</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => bulkUpdate(false)} disabled={isBulkUpdating} className="text-xs gap-1 text-destructive hover:text-destructive">
              <UserX className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Deaktiver alle ledere</span>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <p className="text-sm text-muted-foreground">
          {filteredLeaders.length} ledere · {activeCount} aktive · {inactiveCount} inaktive
        </p>

        {/* Leader list */}
        <div className="space-y-1">
          {filteredLeaders.map(leader => {
            const isActive = leader.is_active !== false;
            const isUpdating = updatingIds.has(leader.id);
            const toggle = canToggle(leader);

            return (
              <div
                key={leader.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                  isActive ? "bg-card" : "bg-muted/50 opacity-75"
                )}
              >
                <Avatar className={cn("h-10 w-10 border-2 shrink-0", isActive ? "border-green-500" : "border-muted-foreground/30")}>
                  {leader.profile_image_url && <AvatarImage src={leader.profile_image_url} alt={leader.name} loading="lazy" />}
                  <AvatarFallback className="text-xs font-medium">
                    {leader.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("font-medium text-sm truncate", !isActive && "text-muted-foreground")}>{leader.name}</span>
                    {getRoleBadge(leader.role)}
                  </div>
                  <p className="text-xs text-muted-foreground">{leader.phone}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Admin role toggle — only visible to superadmin, not on superadmin row */}
                  {isSuperAdmin && leader.role !== 'superadmin' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={isUpdating}
                          onClick={() => setConfirmRoleChange({
                            leader,
                            action: leader.role === 'admin' ? 'revoke' : 'grant'
                          })}
                        >
                          {leader.role === 'admin' ? (
                            <ShieldOff className="h-4 w-4 text-blue-600" />
                          ) : (
                            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {leader.role === 'admin' ? 'Fjern admin-rolle' : 'Gi admin-rolle'}
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Active toggle */}
                  <span className={cn("text-xs hidden sm:inline", isActive ? "text-green-600 dark:text-green-400" : "text-muted-foreground")}>
                    {isActive ? 'Aktiv' : 'Inaktiv'}
                  </span>
                  {toggle.allowed ? (
                    <Switch
                      checked={isActive}
                      onCheckedChange={(checked) => toggleActive(leader, checked)}
                      disabled={isUpdating}
                      className={cn(isActive && "data-[state=checked]:bg-green-600")}
                    />
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Switch checked={isActive} disabled className="opacity-50" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{toggle.reason}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            );
          })}

          {filteredLeaders.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Ingen ledere funnet{searchQuery ? ` for "${searchQuery}"` : ''}
            </div>
          )}
        </div>

        {/* Deactivation confirmation dialog */}
        <AlertDialog open={!!confirmDeactivate} onOpenChange={(open) => !open && setConfirmDeactivate(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deaktiver leder?</AlertDialogTitle>
              <AlertDialogDescription>
                Er du sikker på at du vil deaktivere <strong>{confirmDeactivate?.name}</strong>? De vil ikke kunne logge inn i appen.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Avbryt</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDeactivate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Deaktiver
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Admin role change confirmation */}
        <AlertDialog open={!!confirmRoleChange} onOpenChange={(open) => !open && setConfirmRoleChange(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmRoleChange?.action === 'grant' ? 'Gi admin-rolle?' : 'Fjern admin-rolle?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmRoleChange?.action === 'grant'
                  ? <><strong>{confirmRoleChange?.leader.name}</strong> vil få tilgang til admin-panelet og kunne administrere ledere.</>
                  : <><strong>{confirmRoleChange?.leader.name}</strong> vil miste tilgang til admin-panelet.</>
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Avbryt</AlertDialogCancel>
              <AlertDialogAction onClick={handleAdminRoleChange}>
                {confirmRoleChange?.action === 'grant' ? 'Gi admin-rolle' : 'Fjern admin-rolle'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
