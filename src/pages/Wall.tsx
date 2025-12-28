import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Megaphone } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Announcement = Tables<'announcements'>;

export default function Wall() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnnouncements();

    const channel = supabase
      .channel('wall-updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'announcements'
      }, () => loadAnnouncements())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadAnnouncements = async () => {
    try {
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      setAnnouncements(data || []);
    } catch (error) {
      console.error('Error loading announcements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
          Den store veggen
        </h1>
        <p className="text-muted-foreground mt-1">
          Viktige beskjeder til alle ledere
        </p>
      </div>

      <div className="space-y-4">
        {announcements.map((announcement) => (
          <Card key={announcement.id} className="animate-slide-in">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Megaphone className="w-5 h-5 text-primary" />
                {announcement.title}
              </CardTitle>
              <Badge variant="secondary" className="w-fit">
                {new Date(announcement.created_at!).toLocaleDateString('nb-NO', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Badge>
            </CardHeader>
            {announcement.content && (
              <CardContent>
                <p className="text-foreground whitespace-pre-wrap">{announcement.content}</p>
              </CardContent>
            )}
          </Card>
        ))}

        {announcements.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground">Ingen beskjeder</h3>
              <p className="text-muted-foreground mt-1">
                Veggen er tom akkurat nå
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
