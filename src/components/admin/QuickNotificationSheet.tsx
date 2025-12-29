import { useState } from 'react';
import { Calendar, Play, Coffee, Send, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface QuickNotificationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TargetActivity = 'all' | 'active' | 'free';

interface QuickNotification {
  id: string;
  icon: typeof Calendar;
  title: string;
  description: string;
  notificationTitle: string;
  notificationMessage: string;
  target: TargetActivity;
  url: string;
  color: string;
}

const quickNotifications: QuickNotification[] = [
  {
    id: 'new-session',
    icon: Calendar,
    title: 'Ny økt lagt ut',
    description: 'Informer alle om at ny økt er tilgjengelig',
    notificationTitle: '🗓️ Ny økt er lagt ut!',
    notificationMessage: 'Sjekk vaktplanen for å se din aktivitet denne økten.',
    target: 'all',
    url: '/schedule',
    color: 'bg-blue-500',
  },
  {
    id: 'session-started-active',
    icon: Play,
    title: 'Økten er igang (aktive)',
    description: 'Til ledere som har aktivitet denne økten',
    notificationTitle: '⏰ Økten starter nå!',
    notificationMessage: 'Din aktivitet begynner nå. Ha en fin økt!',
    target: 'active',
    url: '/',
    color: 'bg-green-500',
  },
  {
    id: 'session-started-free',
    icon: Coffee,
    title: 'Økten er igang (fri)',
    description: 'Til ledere som har fri denne økten',
    notificationTitle: '☕ Økten starter - du har fri!',
    notificationMessage: 'Kos deg med pausen! Neste økt er snart.',
    target: 'free',
    url: '/',
    color: 'bg-orange-500',
  },
];

export function QuickNotificationSheet({ open, onOpenChange }: QuickNotificationSheetProps) {
  const { leader } = useAuth();
  const [sendingId, setSendingId] = useState<string | null>(null);

  const handleSendNotification = async (notification: QuickNotification) => {
    if (!leader) return;
    
    setSendingId(notification.id);
    
    try {
      const { data, error } = await supabase.functions.invoke('push-send', {
        body: {
          title: notification.notificationTitle,
          message: notification.notificationMessage,
          url: notification.url,
          broadcast: notification.target === 'all',
          target_activity: notification.target !== 'all' ? notification.target : undefined,
          sender_leader_id: leader.id,
        },
      });

      if (error) throw error;

      toast.success(`Varsling sendt til ${data.sent} mottakere`);
      onOpenChange(false);
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('Kunne ikke sende varsling');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[80vh]">
        <SheetHeader className="mb-4">
          <SheetTitle>Hurtigvarslinger</SheetTitle>
          <SheetDescription>
            Send ut forhåndsdefinerte varslinger med ett trykk
          </SheetDescription>
        </SheetHeader>
        
        <div className="space-y-3 pb-6">
          {quickNotifications.map((notification) => {
            const Icon = notification.icon;
            const isSending = sendingId === notification.id;
            
            return (
              <Button
                key={notification.id}
                variant="outline"
                className="w-full h-auto p-4 flex items-start gap-4 justify-start text-left"
                onClick={() => handleSendNotification(notification)}
                disabled={sendingId !== null}
              >
                <div className={cn('p-3 rounded-xl text-white shrink-0', notification.color)}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground">{notification.title}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">{notification.description}</div>
                </div>
                <div className="shrink-0 self-center">
                  {isSending ? (
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  ) : (
                    <Send className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </Button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
