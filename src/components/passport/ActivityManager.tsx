import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Check, Plus, Minus, Loader2, ChevronDown } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
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
import { hapticSuccess, hapticImpact } from '@/lib/capacitorHaptics';

interface ActivityManagerProps {
  participantId: string;
  completedActivities: { activity: string; id: string; completed_at: string | null }[];
  onActivityChanged: () => void;
}

// Detect touch device (includes iPad, tablets, phones)
const useTouchDevice = () => {
  const [isTouch, setIsTouch] = useState(false);
  
  useEffect(() => {
    const checkTouch = () => {
      const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const hasTouchPoints = navigator.maxTouchPoints > 0;
      setIsTouch(hasCoarsePointer || hasTouchPoints);
    };
    checkTouch();
    // Also listen for changes (e.g., connecting a mouse to a tablet)
    const mediaQuery = window.matchMedia('(pointer: coarse)');
    mediaQuery.addEventListener('change', checkTouch);
    return () => mediaQuery.removeEventListener('change', checkTouch);
  }, []);
  
  return isTouch;
};

export const ActivityManager = ({
  participantId,
  completedActivities,
  onActivityChanged,
}: ActivityManagerProps) => {
  const { leader } = useAuth();
  const { activities } = useActivities(true);
  const isTouch = useTouchDevice();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [customActivity, setCustomActivity] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);

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

      // Haptic feedback for successful activity add
      hapticSuccess();

      toast({
        title: 'Aktivitet lagt til',
        description: `${activityTitle} er registrert`,
      });
      onActivityChanged();
      setIsOpen(false);
    } catch (error) {
      console.error('Error adding activity:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke legge til aktivitet',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(null);
    }
  };

  const addCustomActivity = async () => {
    const trimmed = customActivity.trim();
    if (!trimmed) return;
    
    setIsAddingCustom(true);
    try {
      const { error } = await supabase.from('participant_activities').insert({
        participant_id: participantId,
        activity: trimmed,
        registered_by: leader?.id,
      });

      if (error) throw error;

      hapticSuccess();
      toast({
        title: 'Aktivitet lagt til',
        description: `${trimmed} er registrert`,
      });
      setCustomActivity('');
      onActivityChanged();
      setIsOpen(false);
    } catch (error) {
      console.error('Error adding custom activity:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke legge til aktivitet',
        variant: 'destructive',
      });
    } finally {
      setIsAddingCustom(false);
    }
  };

  const removeOneActivity = async (activityTitle: string) => {
    setIsLoading(activityTitle);
    try {
      // Find one instance of this activity to remove
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

        // Light haptic for removal
        hapticImpact('light');

        toast({
          title: 'Aktivitet fjernet',
          description: `En registrering av ${activityTitle} er fjernet`,
        });
        onActivityChanged();
      }
    } catch (error) {
      console.error('Error removing activity:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke fjerne aktivitet',
        variant: 'destructive',
      });
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
      
      {/* Custom activity input */}
      <div className="border-t pt-3 mt-3 space-y-2">
        <p className="text-xs text-muted-foreground px-2">Andre aktiviteter</p>
        <div className="flex gap-2 px-2">
          <Input
            placeholder="Skriv inn aktivitet..."
            value={customActivity}
            onChange={(e) => setCustomActivity(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomActivity();
              }
            }}
            className="flex-1 h-9 text-sm"
          />
          <Button
            size="sm"
            onClick={addCustomActivity}
            disabled={!customActivity.trim() || isAddingCustom}
            className="h-9"
          >
            {isAddingCustom ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
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

      {/* Touch devices: Use Drawer for better scroll handling */}
      {isTouch ? (
        <Drawer open={isOpen} onOpenChange={setIsOpen}>
          <DrawerTrigger asChild>
            <Button variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Legg til aktivitet
              <ChevronDown className="h-4 w-4 ml-auto" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[85dvh] flex flex-col">
            <DrawerHeader className="flex-shrink-0">
              <DrawerTitle>Legg til aktivitet</DrawerTitle>
            </DrawerHeader>
            <div className="flex-1 min-h-0 overflow-y-auto app-scroll px-4 pb-6 pb-safe">
              {activityListContent}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        /* Desktop: Use Popover */
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Legg til aktivitet
              <ChevronDown className="h-4 w-4 ml-auto" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <div className="max-h-[60vh] overflow-y-auto app-scroll p-2">
              {activityListContent}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};
