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
import { Search, UserCheck, UserX, Users } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { hapticSuccess, hapticError } from '@/lib/capacitorHaptics';
import type { Tables } from '@/integrations/supabase/types';

type AppRole = 'admin' | 'nurse' | 'leader';

interface LeaderWithRole extends Tables<'leaders'> {
  role: AppRole;
}

interface LeaderActivationTabProps {
  leaders: LeaderWithRole[];
  onLeaderUpdated: () => void;
}

type FilterTab = 'all' | 'active' | 'inactive';

export function LeaderActivationTab({ leaders, onLeaderUpdated }: LeaderActivationTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [confirmDeactivate, setConfirmDeactivate] = useState<LeaderWithRole | null>(null);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Filter out superadmin
  const allLeaders = useMemo(() =>
    leaders.filter(l => l.phone !== '12345678' && l.name.toLowerCase() !== 'superadmin'),
    [leaders]
  );

  const filteredLeaders = useMemo(() => {
    let result = allLeaders;

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.name.toLowerCase().includes(q) || l.phone.includes(q)
      );
    }

    // Tab filter
    if (filterTab === 'active') result = result.filter(l => l.is_active !== false);
    if (filterTab === 'inactive') result = result.filter(l => l.is_active === false);

    // Sort: active first, then alphabetical
    return result.sort((a, b) => {
      const aActive = a.is_active !== false ? 0 : 1;
      const bActive = b.is_active !== false ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return a.name.localeCompare(b.name, 'nb');
    });
  }, [allLeaders, searchQuery, filterTab]);

  const activeCount = allLeaders.filter(l => l.is_active !== false).length;
  const inactiveCount = allLeaders.length - activeCount;

  const toggleActive = async (leader: LeaderWithRole, newActive: boolean) => {
    // If deactivating, show confirmation first
    if (!newActive) {
      setConfirmDeactivate(leader);
      return;
    }
    await performToggle(leader, newActive);
  };

  const performToggle = async (leader: LeaderWithRole, newActive: boolean) => {
    setUpdatingIds(prev => new Set(prev).add(leader.id));
    try {
      const { error } = await supabase
        .from('leaders')
        .update({ is_active: newActive })
        .eq('id', leader.id);
      if (error) throw error;
      hapticSuccess();
      toast.success(`${leader.name} er nå ${newActive ? 'aktiv' : 'deaktivert'}`);
      onLeaderUpdated();
    } catch {
      hapticError();
      toast.error(`Kunne ikke oppdatere ${leader.name}`);
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

  const bulkUpdate = async (activate: boolean) => {
    setIsBulkUpdating(true);
    try {
      const targetIds = allLeaders
        .filter(l => activate ? l.is_active === false : l.is_active !== false)
        .map(l => l.id);

      if (targetIds.length === 0) {
        toast.info(activate ? 'Alle ledere er allerede aktive' : 'Alle ledere er allerede deaktiverte');
        return;
      }

      const { error } = await supabase
        .from('leaders')
        .update({ is_active: activate })
        .in('id', targetIds);
      if (error) throw error;
      hapticSuccess();
      toast.success(`${targetIds.length} ledere ${activate ? 'aktivert' : 'deaktivert'}`);
      onLeaderUpdated();
    } catch {
      hapticError();
      toast.error('Kunne ikke oppdatere ledere');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const getRoleBadge = (role: AppRole) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-slate-600 text-white text-[10px] px-1.5">Admin</Badge>;
      case 'nurse':
        return <Badge className="bg-rose-600 text-white text-[10px] px-1.5">Sykepleier</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] px-1.5">Leder</Badge>;
    }
  };

  const filterTabs: { value: FilterTab; label: string; count: number }[] = [
    { value: 'all', label: 'Alle', count: allLeaders.length },
    { value: 'active', label: 'Aktive', count: activeCount },
    { value: 'inactive', label: 'Inaktive', count: inactiveCount },
  ];

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Søk på navn eller telefonnummer..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filter tabs + Bulk actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {filterTabs.map(tab => (
            <Button
              key={tab.value}
              variant={filterTab === tab.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterTab(tab.value)}
              className="gap-1 text-xs sm:text-sm"
            >
              {tab.value === 'all' && <Users className="h-3.5 w-3.5" />}
              {tab.value === 'active' && <UserCheck className="h-3.5 w-3.5" />}
              {tab.value === 'inactive' && <UserX className="h-3.5 w-3.5" />}
              {tab.label}
              <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-0.5">{tab.count}</Badge>
            </Button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => bulkUpdate(true)}
            disabled={isBulkUpdating}
            className="text-xs gap-1"
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Aktiver alle</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => bulkUpdate(false)}
            disabled={isBulkUpdating}
            className="text-xs gap-1 text-destructive hover:text-destructive"
          >
            <UserX className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Deaktiver alle</span>
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

          return (
            <div
              key={leader.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                isActive ? "bg-card" : "bg-muted/50 opacity-75"
              )}
            >
              <Avatar className={cn("h-10 w-10 border-2 shrink-0", isActive ? "border-green-500" : "border-muted-foreground/30")}>
                {leader.profile_image_url && (
                  <AvatarImage src={leader.profile_image_url} alt={leader.name} loading="lazy" />
                )}
                <AvatarFallback className="text-xs font-medium">
                  {leader.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn("font-medium text-sm truncate", !isActive && "text-muted-foreground")}>
                    {leader.name}
                  </span>
                  {getRoleBadge(leader.role)}
                </div>
                <p className="text-xs text-muted-foreground">{leader.phone}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className={cn("text-xs hidden sm:inline", isActive ? "text-green-600 dark:text-green-400" : "text-muted-foreground")}>
                  {isActive ? 'Aktiv' : 'Inaktiv'}
                </span>
                <Switch
                  checked={isActive}
                  onCheckedChange={(checked) => toggleActive(leader, checked)}
                  disabled={isUpdating}
                  className={cn(isActive && "data-[state=checked]:bg-green-600")}
                />
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
    </div>
  );
}
