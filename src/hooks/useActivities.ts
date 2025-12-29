import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ACTIVITIES } from '@/lib/activityUtils';

interface Activity {
  id: string;
  title: string;
  sort_order: number;
  is_active: boolean;
}

export function useActivities(onlyActive = true) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadActivities = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('activities')
        .select('*')
        .order('sort_order');

      if (onlyActive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading activities:', error);
        // Fallback to hardcoded activities
        setActivities(ACTIVITIES.map((a, i) => ({
          id: a.id,
          title: a.title,
          sort_order: i,
          is_active: true,
        })));
        return;
      }

      if (data && data.length > 0) {
        setActivities(data);
      } else {
        // Fallback to hardcoded activities if none in DB
        setActivities(ACTIVITIES.map((a, i) => ({
          id: a.id,
          title: a.title,
          sort_order: i,
          is_active: true,
        })));
      }
    } catch (error) {
      console.error('Error loading activities:', error);
      // Fallback
      setActivities(ACTIVITIES.map((a, i) => ({
        id: a.id,
        title: a.title,
        sort_order: i,
        is_active: true,
      })));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [onlyActive]);

  return { activities, isLoading, refetch: loadActivities };
}
