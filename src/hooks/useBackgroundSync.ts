import { useEffect, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  getSyncQueue, 
  removeFromSyncQueue, 
  incrementRetryCount,
  getQueueCount,
  type SyncQueueItem 
} from "@/lib/syncQueue";
import { useOfflineStatus } from "./useOfflineStatus";
import { toast } from "sonner";

// Valid table names for type safety
type ValidTable = 
  | 'participants'
  | 'participant_activities'
  | 'cabin_reports'
  | 'announcements'
  | 'leader_content'
  | 'room_swaps';

const VALID_TABLES: ValidTable[] = [
  'participants',
  'participant_activities', 
  'cabin_reports',
  'announcements',
  'leader_content',
  'room_swaps'
];

function isValidTable(table: string): table is ValidTable {
  return VALID_TABLES.includes(table as ValidTable);
}

export function useBackgroundSync() {
  const isOffline = useOfflineStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(getQueueCount());

  const processQueueItem = useCallback(async (item: SyncQueueItem): Promise<boolean> => {
    if (!isValidTable(item.table)) {
      console.error('[BackgroundSync] Invalid table:', item.table);
      return false;
    }

    try {
      console.log('[BackgroundSync] Processing item:', item.id, item.type, item.table);
      
      let error = null;

      switch (item.type) {
        case 'insert': {
          const result = await supabase.from(item.table).insert(item.data as never);
          error = result.error;
          break;
        }
        case 'update': {
          const { id, ...updateData } = item.data;
          if (id) {
            const result = await supabase.from(item.table).update(updateData as never).eq('id', id as string);
            error = result.error;
          }
          break;
        }
        case 'delete': {
          const deleteId = item.data.id;
          if (deleteId) {
            const result = await supabase.from(item.table).delete().eq('id', deleteId as string);
            error = result.error;
          }
          break;
        }
      }

      if (error) {
        console.error('[BackgroundSync] Error processing item:', error);
        return false;
      }

      console.log('[BackgroundSync] Successfully processed item:', item.id);
      return true;
    } catch (err) {
      console.error('[BackgroundSync] Exception processing item:', err);
      return false;
    }
  }, []);

  const processQueue = useCallback(async () => {
    const queue = getSyncQueue();
    
    if (queue.length === 0) {
      console.log('[BackgroundSync] Queue is empty');
      return;
    }

    setIsSyncing(true);
    console.log('[BackgroundSync] Processing queue with', queue.length, 'items');
    
    let successCount = 0;
    let failCount = 0;

    for (const item of queue) {
      const success = await processQueueItem(item);
      
      if (success) {
        removeFromSyncQueue(item.id);
        successCount++;
      } else {
        const shouldRetry = incrementRetryCount(item.id);
        if (!shouldRetry) {
          failCount++;
        }
      }
    }

    setPendingCount(getQueueCount());
    setIsSyncing(false);

    if (successCount > 0) {
      toast.success(`Synkronisert ${successCount} ${successCount === 1 ? 'endring' : 'endringer'}`);
    }
    
    if (failCount > 0) {
      toast.error(`${failCount} ${failCount === 1 ? 'endring' : 'endringer'} kunne ikke synkroniseres`);
    }
  }, [processQueueItem]);

  // Process queue when coming back online
  useEffect(() => {
    if (!isOffline) {
      const timeoutId = setTimeout(() => {
        processQueue();
      }, 1000); // Wait 1 second after coming online
      
      return () => clearTimeout(timeoutId);
    }
  }, [isOffline, processQueue]);

  // Update pending count periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setPendingCount(getQueueCount());
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  return {
    isSyncing,
    pendingCount,
    processQueue,
    isOffline,
  };
}
