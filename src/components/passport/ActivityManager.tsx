import { useState, useMemo } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Plus, Minus, Loader2, ChevronDown, X } from 'lucide-react';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useActivities } from '@/hooks/useActivities';

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
      // Get one row (prefer ones registered by current leader so RLS won't block)
      const { data: rows, error: selectError } = await supabase
        .from('participant_activities')
        .select('id, registered_by')
        .eq('participant_id', participantId)
        .ilike('activity', activityTitle);

      if (selectError) throw selectError;
      if (!rows || rows.length === 0) {
        showError('Fant ingen', `Ingen ${activityTitle} å fjerne`);
        return;
      }

      const preferred = rows.find((r) => r.registered_by === leader?.id) ?? rows[0];

      const { error, count } = await supabase
        .from('participant_activities')
        .delete({ count: 'exact' })
        .eq('id', preferred.id);

      if (error) throw error;
      if (!count) {
        showError('Kunne ikke fjerne', 'Aktiviteten ble ikke fjernet');
        return;
      }

      showSuccess('Aktivitet fjernet', `En registrering av ${activityTitle} er fjernet`);
      onActivityChanged();
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

  // Native scroll content. Kept outside Vaul/Popover so wheel/touch scrolling
  // is not captured by the parent participant dialog.
  const activityListContent = (
    <div className="space-y-1 pr-1">
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

      <DialogPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
        <DialogPrimitive.Trigger asChild>
          <Button variant="outline" className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Legg til aktivitet
            <ChevronDown className="h-4 w-4 ml-auto" />
          </Button>
        </DialogPrimitive.Trigger>

        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[120] bg-foreground/60" />
          <DialogPrimitive.Content
            data-vaul-no-drag
            className="fixed inset-x-0 bottom-0 z-[121] mx-auto flex max-h-[82dvh] w-full max-w-xl flex-col rounded-t-3xl border bg-background shadow-xl sm:bottom-6 sm:rounded-3xl"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <div className="mx-auto mt-3 h-1.5 w-24 rounded-full bg-muted" />
            <div className="flex shrink-0 items-center justify-between px-4 pb-3 pt-5">
              <div className="w-10" />
              <DialogPrimitive.Title asChild>
                <h3 className="text-lg font-semibold">Legg til aktivitet</h3>
              </DialogPrimitive.Title>
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full">
                  <X className="h-5 w-5" />
                  <span className="sr-only">Lukk</span>
                </Button>
              </DialogPrimitive.Close>
            </div>
            <div
              data-vaul-no-drag
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pb-safe touch-pan-y"
              style={{ WebkitOverflowScrolling: 'touch' }}
              onWheelCapture={(event) => event.stopPropagation()}
              onTouchMoveCapture={(event) => event.stopPropagation()}
            >
              {activityListContent}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
};
