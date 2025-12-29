import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Wrench, 
  Plus, 
  CheckCircle, 
  MapPin, 
  Camera, 
  X, 
  ChevronDown, 
  User,
  Clock,
  MessageSquare,
  Loader2,
  Image as ImageIcon,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import { compressImage } from '@/lib/imageUtils';

interface FixTask {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  what_to_fix: string | null;
  image_url: string | null;
  created_by: string | null;
  created_at: string;
  assigned_to: string | null;
  assigned_at: string | null;
  admin_notes: string | null;
  status: string;
  fixed_at: string | null;
  fixed_by: string | null;
}

interface Leader {
  id: string;
  name: string;
}

export default function Fix() {
  const { leader, isAdmin } = useAuth();
  const [tasks, setTasks] = useState<FixTask[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [fixedOpen, setFixedOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<FixTask | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [whatToFix, setWhatToFix] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Assignment state
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    try {
      const [tasksRes, leadersRes] = await Promise.all([
        supabase
          .from('fix_tasks')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('leaders')
          .select('id, name')
          .eq('is_active', true)
          .order('name')
      ]);

      if (tasksRes.data) setTasks(tasksRes.data);
      if (leadersRes.data) setLeaders(leadersRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Realtime subscription
    const channel = supabase
      .channel('fix-tasks-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'fix_tasks'
      }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file);
      setImageFile(compressed);
      
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(compressed);
    } catch (error) {
      console.error('Error compressing image:', error);
      toast.error('Kunne ikke laste bilde');
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileName = `${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
      .from('fix-images')
      .upload(fileName, file);

    if (error) {
      console.error('Error uploading image:', error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('fix-images')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Skriv inn en tittel');
      return;
    }

    setIsSubmitting(true);

    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const { error } = await supabase.from('fix_tasks').insert({
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        what_to_fix: whatToFix.trim() || null,
        image_url: imageUrl,
        created_by: leader?.id,
        status: 'pending'
      });

      if (error) throw error;

      toast.success('Fix-oppgave opprettet!');
      resetForm();
      setShowNewForm(false);
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Kunne ikke opprette oppgave');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setLocation('');
    setWhatToFix('');
    setImageFile(null);
    setImagePreview(null);
  };

  const handleAssign = async (taskId: string, leaderId: string) => {
    try {
      const { error } = await supabase
        .from('fix_tasks')
        .update({
          assigned_to: leaderId,
          assigned_at: new Date().toISOString(),
          admin_notes: adminNotes.trim() || null,
          status: 'assigned'
        })
        .eq('id', taskId);

      if (error) throw error;

      toast.success('Oppgave tildelt!');
      setAssigningTaskId(null);
      setAdminNotes('');
    } catch (error) {
      console.error('Error assigning task:', error);
      toast.error('Kunne ikke tildele oppgave');
    }
  };

  const handleMarkAsFixed = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('fix_tasks')
        .update({
          status: 'fixed',
          fixed_at: new Date().toISOString(),
          fixed_by: leader?.id
        })
        .eq('id', taskId);

      if (error) throw error;

      toast.success('Markert som fikset!');
      setSelectedTask(null);
    } catch (error) {
      console.error('Error marking as fixed:', error);
      toast.error('Kunne ikke markere som fikset');
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Er du sikker på at du vil slette denne oppgaven?')) return;

    try {
      const { error } = await supabase
        .from('fix_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      toast.success('Oppgave slettet');
      setSelectedTask(null);
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Kunne ikke slette oppgave');
    }
  };

  const getLeaderName = (leaderId: string | null) => {
    if (!leaderId) return 'Ukjent';
    return leaders.find(l => l.id === leaderId)?.name || 'Ukjent';
  };

  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'assigned');
  const fixedTasks = tasks.filter(t => t.status === 'fixed');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Wrench className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">FIX</h1>
            <p className="text-sm text-muted-foreground">
              Vedlikeholdsoppgaver
            </p>
          </div>
        </div>
        <Button onClick={() => setShowNewForm(true)} size="sm">
          <Plus className="w-4 h-4 mr-1" />
          Ny Fix
        </Button>
      </div>

      {/* New Task Form Dialog */}
      <Dialog open={showNewForm} onOpenChange={setShowNewForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Ny Fix-oppgave</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Bilde (valgfritt)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageSelect}
                className="hidden"
              />
              {imagePreview ? (
                <div className="relative">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-32 flex flex-col gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="w-8 h-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Ta eller velg bilde</span>
                </Button>
              )}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Hva skal fikses? *</Label>
              <Input
                id="title"
                placeholder="F.eks. Ødelagt dør"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">Hvor er det?</Label>
              <Input
                id="location"
                placeholder="F.eks. Hytte 3, rom 2"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Beskrivelse</Label>
              <Textarea
                id="description"
                placeholder="Beskriv problemet mer detaljert..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* What to fix */}
            <div className="space-y-2">
              <Label htmlFor="whatToFix">Hva trengs for å fikse?</Label>
              <Textarea
                id="whatToFix"
                placeholder="F.eks. Trenger ny hengsel og skrutrekker"
                value={whatToFix}
                onChange={(e) => setWhatToFix(e.target.value)}
                rows={2}
              />
            </div>

            {/* Submit */}
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  resetForm();
                  setShowNewForm(false);
                }}
              >
                Avbryt
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-1" />
                    Opprett
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Task Detail Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedTask && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading">{selectedTask.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {selectedTask.image_url && (
                  <img 
                    src={selectedTask.image_url} 
                    alt={selectedTask.title}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                )}

                {selectedTask.location && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <span className="text-sm">{selectedTask.location}</span>
                  </div>
                )}

                {selectedTask.description && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Beskrivelse</p>
                    <p className="text-sm">{selectedTask.description}</p>
                  </div>
                )}

                {selectedTask.what_to_fix && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Hva trengs</p>
                    <p className="text-sm">{selectedTask.what_to_fix}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span>Opprettet av {getLeaderName(selectedTask.created_by)}</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>{format(new Date(selectedTask.created_at), 'PPp', { locale: nb })}</span>
                </div>

                {selectedTask.assigned_to && (
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <p className="text-sm font-medium">Tildelt til: {getLeaderName(selectedTask.assigned_to)}</p>
                    {selectedTask.admin_notes && (
                      <p className="text-sm text-muted-foreground mt-1">{selectedTask.admin_notes}</p>
                    )}
                  </div>
                )}

                {selectedTask.status === 'fixed' && (
                  <div className="p-3 bg-green-500/10 rounded-lg">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      <span className="font-medium">Fikset</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Av {getLeaderName(selectedTask.fixed_by)} • {format(new Date(selectedTask.fixed_at!), 'PPp', { locale: nb })}
                    </p>
                  </div>
                )}

                {/* Admin Assignment Section */}
                {isAdmin && selectedTask.status !== 'fixed' && (
                  <div className="border-t pt-4 space-y-3">
                    <Label>Tildel til leder</Label>
                    <Select 
                      value={selectedTask.assigned_to || ''} 
                      onValueChange={(value) => {
                        setAssigningTaskId(selectedTask.id);
                        handleAssign(selectedTask.id, value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Velg leder..." />
                      </SelectTrigger>
                      <SelectContent>
                        {leaders.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {!selectedTask.assigned_to && (
                      <>
                        <Label>Admin-notat (valgfritt)</Label>
                        <Textarea
                          placeholder="F.eks. Husk å ta med verktøy"
                          value={adminNotes}
                          onChange={(e) => setAdminNotes(e.target.value)}
                          rows={2}
                        />
                      </>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  {selectedTask.status !== 'fixed' && (
                    <Button 
                      onClick={() => handleMarkAsFixed(selectedTask.id)}
                      className="flex-1"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Marker som Fixed
                    </Button>
                  )}
                  {isAdmin && (
                    <Button 
                      variant="destructive" 
                      size="icon"
                      onClick={() => handleDelete(selectedTask.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Pending/Assigned Tasks */}
      <div className="space-y-3">
        {pendingTasks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-lg font-medium text-foreground">Alt er i orden!</p>
              <p className="text-sm text-muted-foreground">Ingen ventende Fix-oppgaver</p>
            </CardContent>
          </Card>
        ) : (
          pendingTasks.map((task) => (
            <Card 
              key={task.id} 
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedTask(task)}
            >
              <CardContent className="p-4">
                <div className="flex gap-3">
                  {task.image_url ? (
                    <img 
                      src={task.image_url} 
                      alt={task.title}
                      className="w-16 h-16 object-cover rounded-lg shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center shrink-0">
                      <ImageIcon className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground truncate">{task.title}</h3>
                    {task.location && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{task.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      {task.status === 'assigned' ? (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          Tildelt: {getLeaderName(task.assigned_to)}
                        </span>
                      ) : (
                        <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">
                          Venter
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Fixed Tasks Collapsible */}
      {fixedTasks.length > 0 && (
        <Collapsible open={fixedOpen} onOpenChange={setFixedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Fixed ({fixedTasks.length})
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${fixedOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 mt-3">
            {fixedTasks.map((task) => (
              <Card 
                key={task.id} 
                className="cursor-pointer hover:bg-muted/50 transition-colors opacity-60"
                onClick={() => setSelectedTask(task)}
              >
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    {task.image_url ? (
                      <img 
                        src={task.image_url} 
                        alt={task.title}
                        className="w-12 h-12 object-cover rounded-lg shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center shrink-0">
                        <ImageIcon className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground truncate line-through">{task.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Fikset av {getLeaderName(task.fixed_by)} • {format(new Date(task.fixed_at!), 'PP', { locale: nb })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
