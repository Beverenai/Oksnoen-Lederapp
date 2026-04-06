import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useActivities } from '@/hooks/useActivities';
import { cn } from '@/lib/utils';

interface ActivitySelectorProps {
  participantId: string;
  completedActivities: string[];
  onActivityChanged: () => void;
}

export function ActivitySelector({
  participantId,
  completedActivities,
  onActivityChanged,
}: ActivitySelectorProps) {
  const { activities } = useActivities(true);
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const isActivityCompleted = (activityTitle: string) => {
    return completedActivities.some(
      (a) => a.toLowerCase() === activityTitle.toLowerCase()
    );
  };

  const toggleActivity = async (activityTitle: string) => {
    setIsLoading(activityTitle);
    
    try {
      if (isActivityCompleted(activityTitle)) {
        // Remove activity
        const { error } = await supabase
          .from('participant_activities')
          .delete()
          .eq('participant_id', participantId)
          .ilike('activity', activityTitle);

        if (error) throw error;
        showSuccess(`${activityTitle} fjernet`);
      } else {
        // Add activity
        const { error } = await supabase
          .from('participant_activities')
          .insert({
            participant_id: participantId,
            activity: activityTitle,
          });

        if (error) throw error;
        showSuccess(`${activityTitle} lagt til!`);
      }
      
      onActivityChanged();
    } catch (error) {
      console.error('Error toggling activity:', error);
      showError('Kunne ikke oppdatere aktivitet');
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {activities.map((activity) => {
        const completed = isActivityCompleted(activity.title);
        const loading = isLoading === activity.title;

        return (
          <Button
            key={activity.id}
            variant={completed ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'transition-all',
              completed && 'bg-success hover:bg-success/90 text-success-foreground'
            )}
            onClick={() => toggleActivity(activity.title)}
            disabled={loading}
          >
            {loading ? (
              <span className="w-4 h-4 mr-1 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : completed ? (
              <Check className="w-4 h-4 mr-1" />
            ) : (
              <Plus className="w-4 h-4 mr-1" />
            )}
            {activity.title}
          </Button>
        );
      })}
    </div>
  );
}
