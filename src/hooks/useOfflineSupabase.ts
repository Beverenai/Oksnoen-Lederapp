import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addToSyncQueue } from "@/lib/syncQueue";
import { useOfflineStatus } from "./useOfflineStatus";
import { toast } from "sonner";

type ValidTable = 
  | 'participants'
  | 'participant_activities'
  | 'cabin_reports'
  | 'announcements'
  | 'leader_content'
  | 'room_swaps';

export function useOfflineSupabase() {
  const isOffline = useOfflineStatus();

  const insert = useCallback(async <T extends Record<string, unknown>>(
    table: ValidTable,
    data: T
  ): Promise<{ success: boolean; offline: boolean }> => {
    if (isOffline) {
      addToSyncQueue({ type: 'insert', table, data });
      toast.info("Lagret lokalt - synkroniseres når du er online");
      return { success: true, offline: true };
    }

    try {
      const { error } = await supabase.from(table).insert(data as never);
      if (error) throw error;
      return { success: true, offline: false };
    } catch (err) {
      console.error('[OfflineSupabase] Insert failed, queuing:', err);
      addToSyncQueue({ type: 'insert', table, data });
      toast.info("Lagret lokalt - synkroniseres når du er online");
      return { success: true, offline: true };
    }
  }, [isOffline]);

  const update = useCallback(async <T extends Record<string, unknown>>(
    table: ValidTable,
    id: string,
    data: T
  ): Promise<{ success: boolean; offline: boolean }> => {
    const fullData = { ...data, id };

    if (isOffline) {
      addToSyncQueue({ type: 'update', table, data: fullData });
      toast.info("Lagret lokalt - synkroniseres når du er online");
      return { success: true, offline: true };
    }

    try {
      const { error } = await supabase.from(table).update(data as never).eq('id', id);
      if (error) throw error;
      return { success: true, offline: false };
    } catch (err) {
      console.error('[OfflineSupabase] Update failed, queuing:', err);
      addToSyncQueue({ type: 'update', table, data: fullData });
      toast.info("Lagret lokalt - synkroniseres når du er online");
      return { success: true, offline: true };
    }
  }, [isOffline]);

  const remove = useCallback(async (
    table: ValidTable,
    id: string
  ): Promise<{ success: boolean; offline: boolean }> => {
    if (isOffline) {
      addToSyncQueue({ type: 'delete', table, data: { id } });
      toast.info("Slettet lokalt - synkroniseres når du er online");
      return { success: true, offline: true };
    }

    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return { success: true, offline: false };
    } catch (err) {
      console.error('[OfflineSupabase] Delete failed, queuing:', err);
      addToSyncQueue({ type: 'delete', table, data: { id } });
      toast.info("Slettet lokalt - synkroniseres når du er online");
      return { success: true, offline: true };
    }
  }, [isOffline]);

  return {
    insert,
    update,
    remove,
    isOffline,
  };
}
