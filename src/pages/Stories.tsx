import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

interface Story {
  id: string;
  title: string;
  content: string;
  sort_order: number;
}

export default function Stories() {
  const navigate = useNavigate();
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedStory, setExpandedStory] = useState<string | null>(null);

  useEffect(() => {
    loadStories();
  }, []);

  const loadStories = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      setStories(data || []);
    } catch (error) {
      console.error('Error loading stories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStory = (id: string) => {
    setExpandedStory(expandedStory === id ? null : id);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (stories.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-2">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Tilbake
        </Button>
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Ingen historier tilgjengelig</h2>
          <p className="text-muted-foreground">Det er ingen historier lagt ut ennå.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" onClick={() => navigate('/')} className="mb-2">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Tilbake
      </Button>

      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
          Historier
        </h1>
        <p className="text-muted-foreground mt-1">
          Historier du kan lese for deltakerne
        </p>
      </div>

      <div className="space-y-3">
        {stories.map((story) => (
          <Card 
            key={story.id} 
            className="cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() => toggleStory(story.id)}
          >
            <CardHeader className="py-4">
              <CardTitle className="flex items-center justify-between text-lg">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-primary" />
                  {story.title}
                </div>
                {expandedStory === story.id ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </CardTitle>
            </CardHeader>
            {expandedStory === story.id && (
              <CardContent className="pt-0 pb-4">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-foreground/90 leading-relaxed">
                    {story.content}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}