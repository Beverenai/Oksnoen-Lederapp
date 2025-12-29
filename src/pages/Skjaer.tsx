import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Map, X, ZoomIn } from 'lucide-react';

export default function Skjaer() {
  const navigate = useNavigate();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    loadSkjaerImage();
  }, []);

  // Handle escape key to close zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsZoomed(false);
    };
    if (isZoomed) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isZoomed]);

  const loadSkjaerImage = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'skjaer_image_url')
        .maybeSingle();
      
      setImageUrl(data?.value || null);
    } catch (error) {
      console.error('Error loading skjaer image:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-2">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Tilbake
        </Button>
        <div className="text-center py-12">
          <Map className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Ingen skjærkart tilgjengelig</h2>
          <p className="text-muted-foreground">Skjærkartet er ikke lagt ut ennå.</p>
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
          Skjær
        </h1>
      </div>

      <Card>
        <CardContent className="p-2 lg:p-4">
          <div 
            className="relative cursor-zoom-in group"
            onClick={() => setIsZoomed(true)}
          >
            <img 
              src={imageUrl} 
              alt="Skjærkart" 
              className="w-full h-auto rounded-lg transition-transform"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center">
              <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Trykk på bildet for å zoome
          </p>
        </CardContent>
      </Card>

      {/* Fullscreen Zoom Modal */}
      {isZoomed && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center animate-fade-in"
          onClick={() => setIsZoomed(false)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
            onClick={() => setIsZoomed(false)}
          >
            <X className="w-6 h-6" />
          </Button>
          
          <div 
            className="w-full h-full overflow-auto p-4 flex items-start justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={imageUrl} 
              alt="Skjærkart - Fullskjerm" 
              className="max-w-none w-[200%] lg:w-full lg:max-w-[90vw] h-auto cursor-zoom-out"
              onClick={() => setIsZoomed(false)}
            />
          </div>
          
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
            Trykk hvor som helst for å lukke
          </p>
        </div>
      )}
    </div>
  );
}