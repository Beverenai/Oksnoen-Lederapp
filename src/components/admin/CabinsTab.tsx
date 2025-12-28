import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Home, 
  Plus, 
  Trash2,
  Loader2,
  GripVertical
} from 'lucide-react';
import { toast } from 'sonner';

interface Cabin {
  id: string;
  name: string;
  sort_order: number | null;
  created_at: string | null;
}

export function CabinsTab() {
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newCabinName, setNewCabinName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadCabins();
  }, []);

  const loadCabins = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('cabins')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setCabins(data || []);
    } catch (error) {
      console.error('Error loading cabins:', error);
      toast.error('Kunne ikke laste hytter');
    } finally {
      setIsLoading(false);
    }
  };

  const addCabin = async () => {
    if (!newCabinName.trim()) {
      toast.error('Skriv inn et hyttenavn');
      return;
    }

    setIsAdding(true);
    try {
      const maxSortOrder = cabins.length > 0 
        ? Math.max(...cabins.map(c => c.sort_order || 0)) 
        : 0;

      const { error } = await supabase
        .from('cabins')
        .insert({ 
          name: newCabinName.trim(),
          sort_order: maxSortOrder + 1
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('Denne hytten finnes allerede');
        } else {
          throw error;
        }
        return;
      }

      setNewCabinName('');
      loadCabins();
      toast.success('Hytte lagt til!');
    } catch (error) {
      console.error('Error adding cabin:', error);
      toast.error('Kunne ikke legge til hytte');
    } finally {
      setIsAdding(false);
    }
  };

  const deleteCabin = async (cabin: Cabin) => {
    // Check if cabin has participants
    const { count } = await supabase
      .from('participants')
      .select('*', { count: 'exact', head: true })
      .eq('cabin_id', cabin.id);

    if (count && count > 0) {
      toast.error(`Kan ikke slette - ${count} deltaker(e) er tilknyttet denne hytten`);
      return;
    }

    if (!confirm(`Er du sikker på at du vil slette "${cabin.name}"?`)) return;

    setDeletingId(cabin.id);
    try {
      const { error } = await supabase
        .from('cabins')
        .delete()
        .eq('id', cabin.id);

      if (error) throw error;
      
      loadCabins();
      toast.success('Hytte slettet');
    } catch (error) {
      console.error('Error deleting cabin:', error);
      toast.error('Kunne ikke slette hytte');
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabin List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="w-5 h-5" />
            Hytter ({cabins.length})
          </CardTitle>
          <CardDescription>
            Administrer hytter for deltakere og ledere
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Cabin grid */}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {cabins.map((cabin) => (
              <div
                key={cabin.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{cabin.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteCabin(cabin)}
                  disabled={deletingId === cabin.id}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  {deletingId === cabin.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>

          {cabins.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Ingen hytter registrert enda
            </p>
          )}
        </CardContent>
      </Card>

      {/* Add Cabin */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Legg til ny hytte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Hyttenavn (f.eks. Marcusbu bak)"
              value={newCabinName}
              onChange={(e) => setNewCabinName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCabin()}
              className="flex-1"
            />
            <Button onClick={addCabin} disabled={isAdding}>
              {isAdding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Hytter brukes til å gruppere deltakere og koble ledere til sine ansvarsområder
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
