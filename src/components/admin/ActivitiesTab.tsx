import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActivities } from '@/hooks/useActivities';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Dumbbell, 
  Plus, 
  Trash2, 
  GripVertical, 
  Loader2,
  Pencil,
  Check,
  X
} from 'lucide-react';
import { hapticSuccess, hapticError, hapticImpact } from '@/lib/capacitorHaptics';

export function ActivitiesTab() {
  const { activities, isLoading, refetch } = useActivities(false);
  const [newActivityTitle, setNewActivityTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const addActivity = async () => {
    if (!newActivityTitle.trim()) {
      showError('Skriv inn et aktivitetsnavn');
      return;
    }

    setIsAdding(true);
    try {
      const maxSortOrder = activities.length > 0 
        ? Math.max(...activities.map(a => a.sort_order)) + 1 
        : 0;

      const { error } = await supabase
        .from('activities')
        .insert({
          title: newActivityTitle.trim(),
          sort_order: maxSortOrder,
          is_active: true,
        });

      if (error) throw error;

      hapticSuccess();
      setNewActivityTitle('');
      refetch();
      showSuccess('Aktivitet lagt til');
    } catch (error) {
      console.error('Error adding activity:', error);
      hapticError();
      showError('Kunne ikke legge til aktivitet');
    } finally {
      setIsAdding(false);
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from('activities')
        .update({ is_active: !currentActive })
        .eq('id', id);

      if (error) throw error;

      hapticImpact('light');
      refetch();
      showSuccess(currentActive ? 'Aktivitet deaktivert' : 'Aktivitet aktivert');
    } catch (error) {
      console.error('Error toggling activity:', error);
      hapticError();
      showError('Kunne ikke oppdatere aktivitet');
    } finally {
      setUpdatingId(null);
    }
  };

  const startEditing = (id: string, title: string) => {
    setEditingId(id);
    setEditingTitle(title);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const saveEditing = async () => {
    if (!editingId || !editingTitle.trim()) return;

    setUpdatingId(editingId);
    try {
      const { error } = await supabase
        .from('activities')
        .update({ title: editingTitle.trim() })
        .eq('id', editingId);

      if (error) throw error;

      hapticSuccess();
      setEditingId(null);
      setEditingTitle('');
      refetch();
      showSuccess('Aktivitet oppdatert');
    } catch (error) {
      console.error('Error updating activity:', error);
      hapticError();
      showError('Kunne ikke oppdatere aktivitet');
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteActivity = async (id: string, title: string) => {
    if (!confirm(`Er du sikker på at du vil slette "${title}"? Dette kan ikke angres.`)) {
      return;
    }

    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', id);

      if (error) throw error;

      hapticSuccess();
      refetch();
      showSuccess('Aktivitet slettet');
    } catch (error) {
      console.error('Error deleting activity:', error);
      hapticError();
      showError('Kunne ikke slette aktivitet');
    } finally {
      setUpdatingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const activeCount = activities.filter(a => a.is_active).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5" />
            Aktiviteter
          </CardTitle>
          <CardDescription>
            Administrer aktiviteter som kan registreres for deltakere. 
            {activeCount} av {activities.length} aktiviteter er aktive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new activity */}
          <div className="flex gap-2">
            <Input
              placeholder="Ny aktivitet..."
              value={newActivityTitle}
              onChange={(e) => setNewActivityTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addActivity()}
              className="flex-1"
            />
            <Button onClick={addActivity} disabled={isAdding}>
              {isAdding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span className="ml-2 hidden sm:inline">Legg til</span>
            </Button>
          </div>

          {/* Activity list */}
          <div className="space-y-2">
            {activities.map((activity) => {
              const isEditing = editingId === activity.id;
              const isUpdating = updatingId === activity.id;

              return (
                <div
                  key={activity.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    activity.is_active ? 'bg-background' : 'bg-muted/50 opacity-60'
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                  
                  {isEditing ? (
                    <Input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEditing();
                        if (e.key === 'Escape') cancelEditing();
                      }}
                      className="flex-1"
                      autoFocus
                    />
                  ) : (
                    <span className="flex-1 font-medium">{activity.title}</span>
                  )}

                  <div className="flex items-center gap-2">
                    {!activity.is_active && (
                      <Badge variant="secondary" className="text-xs">
                        Inaktiv
                      </Badge>
                    )}

                    {isEditing ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={saveEditing}
                          disabled={isUpdating}
                        >
                          {isUpdating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4 text-green-600" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={cancelEditing}
                          disabled={isUpdating}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEditing(activity.id, activity.title)}
                          disabled={isUpdating}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>

                        <Switch
                          checked={activity.is_active}
                          onCheckedChange={() => toggleActive(activity.id, activity.is_active)}
                          disabled={isUpdating}
                        />

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteActivity(activity.id, activity.title)}
                          disabled={isUpdating}
                          className="text-destructive hover:text-destructive"
                        >
                          {isUpdating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {activities.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Ingen aktiviteter lagt til ennå.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
