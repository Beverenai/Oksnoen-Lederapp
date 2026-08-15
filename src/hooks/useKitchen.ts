import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActivePeriodId } from '@/hooks/useActivePeriodId';
import type { Tables } from '@/integrations/supabase/types';
import { uniqueRealtimeChannelName } from '@/lib/realtimeChannel';

export type KitchenSection = Tables<'kitchen_sections'>;
export type KitchenItem = Tables<'kitchen_items'>;
export type KitchenCheck = Tables<'kitchen_item_checks'>;

export function useKitchenSections() {
  return useQuery({
    queryKey: ['kitchen-sections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kitchen_sections')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as KitchenSection[];
    },
    staleTime: 60_000,
  });
}

export function useKitchenItems() {
  return useQuery({
    queryKey: ['kitchen-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kitchen_items')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as KitchenItem[];
    },
    staleTime: 60_000,
  });
}

/** Checks for the active period only — a new period starts with empty lists. */
export function useKitchenChecks() {
  const { data: periodId } = useActivePeriodId();
  return useQuery({
    queryKey: ['kitchen-checks', periodId],
    enabled: periodId !== undefined,
    queryFn: async () => {
      let q = supabase.from('kitchen_item_checks').select('*');
      q = periodId ? q.eq('period_id', periodId) : q.is('period_id', null);
      const { data, error } = await q;
      if (error) throw error;
      return data as KitchenCheck[];
    },
    staleTime: 15_000,
  });
}

export function useKitchenRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(uniqueRealtimeChannelName('kitchen-realtime'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kitchen_item_checks' }, () => {
        qc.invalidateQueries({ queryKey: ['kitchen-checks'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kitchen_items' }, () => {
        qc.invalidateQueries({ queryKey: ['kitchen-items'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kitchen_sections' }, () => {
        qc.invalidateQueries({ queryKey: ['kitchen-sections'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);
}

export function useToggleKitchenItem() {
  const qc = useQueryClient();
  const { data: periodId } = useActivePeriodId();

  return useMutation({
    mutationFn: async ({ itemId, checked }: { itemId: string; checked: boolean }) => {
      if (!checked) {
        let q = supabase.from('kitchen_item_checks').delete().eq('item_id', itemId);
        q = periodId ? q.eq('period_id', periodId) : q.is('period_id', null);
        const { error } = await q;
        if (error) throw error;
        return;
      }
      const { data: leaderId } = await supabase.rpc('current_leader_id');
      const { error } = await supabase
        .from('kitchen_item_checks')
        .upsert(
          {
            item_id: itemId,
            period_id: periodId ?? null,
            checked_by: (leaderId as string) ?? null,
            checked_at: new Date().toISOString(),
          },
          { onConflict: 'item_id,period_id' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kitchen-checks'] });
    },
  });
}

/** Admin: create / update / delete sections and items. */
export function useKitchenAdmin() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['kitchen-sections'] });
    qc.invalidateQueries({ queryKey: ['kitchen-items'] });
  };

  const addItem = async (sectionId: string, label: string, hint: string | null, sortOrder: number) => {
    const { error } = await supabase
      .from('kitchen_items')
      .insert({ section_id: sectionId, label, hint, sort_order: sortOrder });
    if (error) throw error;
    invalidate();
  };

  const updateItem = async (id: string, patch: Partial<KitchenItem>) => {
    const { error } = await supabase.from('kitchen_items').update(patch).eq('id', id);
    if (error) throw error;
    invalidate();
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from('kitchen_items').delete().eq('id', id);
    if (error) throw error;
    invalidate();
  };

  const updateSection = async (id: string, patch: Partial<KitchenSection>) => {
    const { error } = await supabase.from('kitchen_sections').update(patch).eq('id', id);
    if (error) throw error;
    invalidate();
  };

  const addSection = async (title: string, kind: 'checklist' | 'guide', sortOrder: number) => {
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'seksjon'}-${Date.now().toString(36)}`;
    const { data, error } = await supabase
      .from('kitchen_sections')
      .insert({ slug, title, kind, sort_order: sortOrder })
      .select()
      .single();
    if (error) throw error;
    invalidate();
    return data as KitchenSection;
  };

  const deleteSection = async (id: string) => {
    const { error } = await supabase.from('kitchen_sections').delete().eq('id', id);
    if (error) throw error;
    invalidate();
  };

  return { addItem, updateItem, deleteItem, addSection, updateSection, deleteSection };
}
