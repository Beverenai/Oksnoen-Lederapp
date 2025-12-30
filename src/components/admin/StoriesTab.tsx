import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  Loader2, 
  Edit, 
  Save, 
  X,
  GripVertical,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { hapticSuccess, hapticWarning, hapticError } from '@/lib/capacitorHaptics';

interface Story {
  id: string;
  title: string;
  content: string;
  sort_order: number;
  is_active: boolean;
}

export function StoriesTab() {
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [newStory, setNewStory] = useState({ title: '', content: '' });
  const [showNewForm, setShowNewForm] = useState(false);

  useEffect(() => {
    loadStories();
  }, []);

  const loadStories = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      setStories(data || []);
    } catch (error) {
      console.error('Error loading stories:', error);
      toast.error('Kunne ikke laste historier');
    } finally {
      setIsLoading(false);
    }
  };

  const addStory = async () => {
    if (!newStory.title.trim() || !newStory.content.trim()) {
      toast.error('Fyll ut både tittel og innhold');
      return;
    }

    setIsSaving(true);
    try {
      const maxOrder = stories.length > 0 
        ? Math.max(...stories.map(s => s.sort_order)) 
        : 0;

      const { error } = await supabase
        .from('stories')
        .insert({
          title: newStory.title.trim(),
          content: newStory.content.trim(),
          sort_order: maxOrder + 1,
          is_active: true
        });

      if (error) throw error;

      setNewStory({ title: '', content: '' });
      setShowNewForm(false);
      loadStories();
      hapticSuccess();
      toast.success('Historie lagt til!');
    } catch (error) {
      console.error('Error adding story:', error);
      hapticError();
      toast.error('Kunne ikke legge til historie');
    } finally {
      setIsSaving(false);
    }
  };

  const updateStory = async () => {
    if (!editingStory) return;

    if (!editingStory.title.trim() || !editingStory.content.trim()) {
      toast.error('Fyll ut både tittel og innhold');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('stories')
        .update({
          title: editingStory.title.trim(),
          content: editingStory.content.trim()
        })
        .eq('id', editingStory.id);

      if (error) throw error;

      setEditingStory(null);
      loadStories();
      hapticSuccess();
      toast.success('Historie oppdatert!');
    } catch (error) {
      console.error('Error updating story:', error);
      hapticError();
      toast.error('Kunne ikke oppdatere historie');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (story: Story) => {
    try {
      const { error } = await supabase
        .from('stories')
        .update({ is_active: !story.is_active })
        .eq('id', story.id);

      if (error) throw error;

      loadStories();
      toast.success(story.is_active ? 'Historie deaktivert' : 'Historie aktivert');
    } catch (error) {
      console.error('Error toggling story:', error);
      toast.error('Kunne ikke endre status');
    }
  };

  const deleteStory = async (id: string) => {
    hapticWarning();
    if (!confirm('Er du sikker på at du vil slette denne historien?')) return;

    try {
      const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      loadStories();
      hapticSuccess();
      toast.success('Historie slettet!');
    } catch (error) {
      console.error('Error deleting story:', error);
      hapticError();
      toast.error('Kunne ikke slette historie');
    }
  };

  const moveStory = async (story: Story, direction: 'up' | 'down') => {
    const currentIndex = stories.findIndex(s => s.id === story.id);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex < 0 || newIndex >= stories.length) return;

    const otherStory = stories[newIndex];
    
    try {
      // Swap sort orders
      await supabase
        .from('stories')
        .update({ sort_order: otherStory.sort_order })
        .eq('id', story.id);

      await supabase
        .from('stories')
        .update({ sort_order: story.sort_order })
        .eq('id', otherStory.id);

      loadStories();
    } catch (error) {
      console.error('Error moving story:', error);
      toast.error('Kunne ikke flytte historie');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Historier
              </CardTitle>
              <CardDescription>
                Legg til historier som ledere kan lese for deltakerne.
              </CardDescription>
            </div>
            {!showNewForm && (
              <Button onClick={() => setShowNewForm(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Ny historie
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* New Story Form */}
          {showNewForm && (
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-title">Tittel</Label>
                  <Input
                    id="new-title"
                    placeholder="Historiens tittel"
                    value={newStory.title}
                    onChange={(e) => setNewStory({ ...newStory, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-content">Innhold</Label>
                  <Textarea
                    id="new-content"
                    placeholder="Skriv historien her..."
                    rows={8}
                    value={newStory.content}
                    onChange={(e) => setNewStory({ ...newStory, content: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={addStory} disabled={isSaving} className="gap-2">
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    Legg til
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      setShowNewForm(false);
                      setNewStory({ title: '', content: '' });
                    }}
                  >
                    Avbryt
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stories List */}
          {stories.length === 0 && !showNewForm ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <BookOpen className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Ingen historier lagt til ennå
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {stories.map((story, index) => (
                <Card 
                  key={story.id} 
                  className={story.is_active ? '' : 'opacity-50'}
                >
                  <CardContent className="pt-4">
                    {editingStory?.id === story.id ? (
                      // Edit mode
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Tittel</Label>
                          <Input
                            value={editingStory.title}
                            onChange={(e) => setEditingStory({ ...editingStory, title: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Innhold</Label>
                          <Textarea
                            rows={8}
                            value={editingStory.content}
                            onChange={(e) => setEditingStory({ ...editingStory, content: e.target.value })}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={updateStory} disabled={isSaving} size="sm" className="gap-2">
                            {isSaving ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                            Lagre
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setEditingStory(null)}
                            className="gap-2"
                          >
                            <X className="w-4 h-4" />
                            Avbryt
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => moveStory(story, 'up')}
                            disabled={index === 0}
                          >
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <GripVertical className="w-4 h-4 text-muted-foreground mx-auto" />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => moveStory(story, 'down')}
                            disabled={index === stories.length - 1}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold truncate">{story.title}</h3>
                            {!story.is_active && (
                              <span className="text-xs text-muted-foreground">(deaktivert)</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {story.content}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={story.is_active}
                            onCheckedChange={() => toggleActive(story)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingStory(story)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteStory(story.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}