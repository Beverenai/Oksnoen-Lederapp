import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Plus, Minus, Loader2, ChevronDown } from 'lucide-react';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { useActivities } from '@/hooks/useActivities';
import { useIsMobile } from '@/hooks/use-mobile';
import { hapticSuccess, hapticImpact } from '@/lib/capacitorHaptics';

interface ActivityManagerProps {
  participantId: string;
  completedActivities: { activity: string; id: string; completed_at: string | null }[];
  onActivityChanged: () => void;
}

export const ActivityManager = ({
  participantId,
  completedActivities,
  onActivityChanged,
}: ActivityManagerProps) => {
  const { leader } = useAuth();
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const { activities } = useActivities(true);
  const isMobile = useIsMobile();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Group activities by name and count occurrences
  const activityCounts = useMemo(() => {
    const counts = new Map<string, number>();
    completedActivities.forEach((a) => {
      const normalized = a.activity.toLowerCase();
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    });
    return counts;
  }, [completedActivities]);

  // Get unique activities the participant has done
  const uniqueActivities = useMemo(() => {
    const seen = new Set<string>();
    return completedActivities.filter((a) => {
      const normalized = a.activity.toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }, [completedActivities]);

  const addActivity = async (activityTitle: string) => {
    setIsLoading(activityTitle);
    try {
      const { error } = await supabase.from('participant_activities').insert({
        participant_id: participantId,
        activity: activityTitle,
        registered_by: leader?.id,
      });

      if (error) throw error;


      showSuccess('Aktivitet lagt til', `${activityTitle} er registrert`);
      onActivityChanged();
      setIsOpen(false);
    } catch (error) {
      console.error('Error adding activity:', error);
      showError('Feil', 'Kunne ikke legge til aktivitet');
    } finally {
      setIsLoading(null);
    }
  };

  const removeOneActivity = async (activityTitle: string) => {
    setIsLoading(activityTitle);
    try {
      const { data } = await supabase
        .from('participant_activities')
        .select('id')
        .eq('participant_id', participantId)
        .ilike('activity', activityTitle)
        .limit(1)
        .single();

      if (data) {
        const { error } = await supabase
          .from('participant_activities')
          .delete()
          .eq('id', data.id);

        if (error) throw error;


        showSuccess('Aktivitet fjernet', `En registrering av ${activityTitle} er fjernet`);
        onActivityChanged();
      }
    } catch (error) {
      console.error('Error removing activity:', error);
      showError('Feil', 'Kunne ikke fjerne aktivitet');
    } finally {
      setIsLoading(null);
    }
  };

  const getCount = (activityTitle: string) => {
    return activityCounts.get(activityTitle.toLowerCase()) || 0;
  };

  // Activity list content - shared between Drawer and Popover
  const activityListContent = (
    <div className="space-y-1">
      {activities.map((activity) => {
        const count = getCount(activity.title);
        const isCurrentlyLoading = isLoading === activity.title;

        return (
          <Button
            key={activity.id}
            variant="ghost"
            className="w-full justify-start text-left h-auto py-2"
            onClick={() => addActivity(activity.title)}
            disabled={isCurrentlyLoading}
          >
            <div className="flex items-center gap-2 w-full">
              {isCurrentlyLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : count > 0 ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Plus className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="flex-1 text-sm">{activity.title}</span>
              {count > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {count}
                </Badge>
              )}
            </div>
          </Button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-3">
      {uniqueActivities.length > 0 ? (
        <div className="space-y-2">
          {uniqueActivities.map((activity) => {
            const count = getCount(activity.activity);
            const isCurrentlyLoading = isLoading === activity.activity;

            return (
              <div
                key={activity.id}
                className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">{activity.activity}</span>
                  {count > 1 && (
                    <Badge variant="secondary" className="text-xs">
                      x{count}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removeOneActivity(activity.activity)}
                    disabled={isCurrentlyLoading}
                  >
                    {isCurrentlyLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Minus className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => addActivity(activity.activity)}
                    disabled={isCurrentlyLoading}
                  >
                    {isCurrentlyLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Ingen aktiviteter registrert ennå</p>
      )}

      {/* Mobile: Drawer, Desktop: Popover */}
      {isMobile ? (
        <Drawer open={isOpen} onOpenChange={setIsOpen}>
          <DrawerTrigger asChild>
            <Button variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Legg til aktivitet
              <ChevronDown className="h-4 w-4 ml-auto" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[70dvh] flex flex-col">
            <DrawerHeader className="flex-shrink-0">
              <DrawerTitle>Legg til aktivitet</DrawerTitle>
            </DrawerHeader>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-6 pb-safe">
              {activityListContent}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Legg til aktivitet
              <ChevronDown className="h-4 w-4 ml-auto" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <div className="max-h-[50vh] overflow-y-auto overscroll-contain p-2">
              {activityListContent}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};
