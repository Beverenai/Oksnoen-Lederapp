import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { getTeamSortOrder } from '@/lib/teamUtils';

type Leader = Tables<'leaders'>;
type LeaderContent = Tables<'leader_content'>;

function normalizeRoleIds(ids: unknown): string[] {
  if (Array.isArray(ids)) {
    return ids.filter((id): id is string => typeof id === 'string');
  }

  if (ids instanceof Set) {
    return Array.from(ids).filter((id): id is string => typeof id === 'string');
  }

  return [];
}

export interface LeaderWithContent extends Leader {
  content?: LeaderContent | null;
  isAdmin?: boolean;
  isNurse?: boolean;
}

export function useLeaderRoles() {
  return useQuery({
    queryKey: ['leader-roles'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_all_leader_roles');
      if (error) throw error;
      const adminIds = data?.filter(r => r.role === 'admin').map(r => r.leader_id) || [];
      const nurseIds = data?.filter(r => r.role === 'nurse').map(r => r.leader_id) || [];
      return { adminIds, nurseIds };
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });
}

export function useLeaderContent() {
  return useQuery({
    queryKey: ['leader-content'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leader_content').select('*');
      if (error) throw error;
      return data || [];
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });
}

export function useLeaderDashboardData(leaders: Leader[]) {
  const { data: roles, isLoading: rolesLoading } = useLeaderRoles();
  const { data: contentData, isLoading: contentLoading, refetch: refetchContent } = useLeaderContent();

  const adminIds = useMemo(() => new Set(normalizeRoleIds(roles?.adminIds)), [roles?.adminIds]);
  const nurseIds = useMemo(() => new Set(normalizeRoleIds(roles?.nurseIds)), [roles?.nurseIds]);

  // Filter out superadmin and inactive
  const activeLeaders = useMemo(() =>
    leaders.filter(l =>
      l.is_active !== false &&
      l.phone !== '12345678' &&
      l.name.toLowerCase() !== 'superadmin'
    ), [leaders]);

  // Merge content
  const leadersWithContent: LeaderWithContent[] = useMemo(() =>
    activeLeaders.map(leader => ({
      ...leader,
      content: contentData?.find(c => c.leader_id === leader.id) || null,
      isAdmin: adminIds.has(leader.id),
      isNurse: nurseIds.has(leader.id),
    })), [activeLeaders, contentData, adminIds, nurseIds]);

  // Realtime subscription for leader_content
  useEffect(() => {
    const channel = supabase
      .channel('leader-content-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leader_content' }, () => {
        refetchContent();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetchContent]);

  // Filter + sort helpers
  const filterAndSort = useCallback((
    data: LeaderWithContent[],
    searchQuery: string,
    activeTeamFilter: string | null,
    showUnreadOnly: boolean,
  ) => {
    const query = searchQuery.toLowerCase();
    const filtered = data.filter(leader => {
      const matchesSearch = !query ||
        leader.name.toLowerCase().includes(query) ||
        leader.ministerpost?.toLowerCase().includes(query) ||
        leader.team?.toLowerCase().includes(query) ||
        leader.cabin?.toLowerCase().includes(query) ||
        leader.content?.current_activity?.toLowerCase().includes(query) ||
        leader.content?.extra_activity?.toLowerCase().includes(query);

      const matchesTeam = !activeTeamFilter ||
        leader.team?.toLowerCase().trim() === activeTeamFilter.toLowerCase();

      const isKitchen = leader.team?.toLowerCase() === 'kjøkken' || leader.team?.toLowerCase() === 'kjokken';
      const hasFriActivity =
        leader.content?.current_activity?.toLowerCase().includes('fri') ||
        leader.content?.extra_activity?.toLowerCase().includes('fri');
      const matchesUnread = !showUnreadOnly || (
        !leader.isAdmin &&
        !leader.isNurse &&
        !isKitchen &&
        !hasFriActivity &&
        !leader.content?.has_read
      );

      return matchesSearch && matchesTeam && matchesUnread;
    });

    return [...filtered].sort((a, b) => {
      if (a.isAdmin && !b.isAdmin) return -1;
      if (!a.isAdmin && b.isAdmin) return 1;
      if (a.isNurse && !b.isNurse) return -1;
      if (!a.isNurse && b.isNurse) return 1;
      const aOrder = getTeamSortOrder(a.team);
      const bOrder = getTeamSortOrder(b.team);
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.name.localeCompare(b.name, 'nb');
    });
  }, []);

  return {
    leadersWithContent,
    activeLeaders,
    adminIds,
    nurseIds,
    isLoading: rolesLoading || contentLoading,
    refetchContent,
    filterAndSort,
  };
}
