import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState } from 'react';
import { Calendar, Play, Coffee, Send, Loader2, Bell, RefreshCw, MessageSquare, ArrowLeft } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PUSH_DESTINATIONS } from '@/lib/pushDestinations';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { hapticSuccess, hapticError } from '@/lib/capacitorHaptics';

interface QuickNotificationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TargetActivity = 'all' | 'active' | 'free' | 'unread_with_content';

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
  personalize?: boolean;
}

const quickNotifications: QuickNotification[] = [
  {
    id: 'new-session',
    icon: Calendar,
    title: 'Ny økt lagt ut',
    description: 'Hver leder får sin egen aktivitet i varslingen',
    notificationTitle: '🗓️ Ny økt er lagt ut!',
    notificationMessage: 'Din aktivitet denne økten: {activity}',
    target: 'all',
    url: '/schedule',
    color: 'bg-blue-500',
    personalize: true,
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
  {
    id: 'session-changed',
    icon: RefreshCw,
    title: 'Økten er endret',
    description: 'Be alle ledere sjekke appen for endringer',
    notificationTitle: '🔄 Økten har blitt endret!',
    notificationMessage: 'Sjekk appen nå for å se de oppdaterte detaljene for økten.',
    target: 'all',
    url: '/',
    color: 'bg-amber-500',
  },
];

export function QuickNotificationSheet({ open, onOpenChange }: QuickNotificationSheetProps) {
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const { leader } = useAuth();
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [customUrl, setCustomUrl] = useState('/');

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
          target_activity: ['active', 'free'].includes(notification.target) ? notification.target : undefined,
          target_unread_with_content: notification.target === 'unread_with_content',
          sender_leader_id: leader.id,
          personalize_activity: notification.personalize || false,
        },
      });

      if (error) throw error;

      showSuccess(`Varsling sendt til ${data.sent} mottakere`);
      onOpenChange(false);
    } catch (error) {
      console.error('Error sending notification:', error);
      showError('Kunne ikke sende varsling');
    } finally {
      setSendingId(null);
    }
  };

  const handleSendCustom = async () => {
    if (!leader) return;
    const title = customTitle.trim();
    const message = customMessage.trim();
    if (!title || !message) {
      showError('Tittel og melding må fylles ut');
      return;
    }
    setSendingId('custom');
    try {
      const { data, error } = await supabase.functions.invoke('push-send', {
        body: {
          title,
          message,
          url: customUrl || '/',
          broadcast: true,
          sender_leader_id: leader.id,
        },
      });
      if (error) throw error;
      showSuccess(`Varsling sendt til ${data.sent} mottakere`);
      setCustomTitle('');
      setCustomMessage('');
      setCustomUrl('/');
      setCustomMode(false);
      onOpenChange(false);
    } catch (err) {
      console.error('Error sending custom notification:', err);
      showError('Kunne ikke sende varsling');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[85dvh] flex flex-col overflow-hidden">
        <SheetHeader className="mb-4 shrink-0">
          <SheetTitle className="flex items-center gap-2">
            {customMode && (
              <button
                onClick={() => setCustomMode(false)}
                className="p-1 -ml-1 rounded-md hover:bg-muted"
                aria-label="Tilbake"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            {customMode ? 'Egen varsling' : 'Hurtigvarslinger'}
          </SheetTitle>
          <SheetDescription>
            {customMode
              ? 'Skriv din egen melding som sendes til alle ledere'
              : 'Send ut forhåndsdefinerte varslinger med ett trykk'}
          </SheetDescription>
        </SheetHeader>

        {customMode ? (
          <div className="space-y-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] overflow-y-auto flex-1 min-h-0 -mx-1 px-1">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Tittel</label>
              <Input
                placeholder="F.eks. Viktig beskjed"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Melding</label>
              <Textarea
                placeholder="Skriv meldingen som skal sendes til alle ledere…"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                maxLength={300}
                rows={4}
              />
              <div className="text-xs text-muted-foreground text-right">
                {customMessage.length}/300
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Åpne side ved trykk</label>
              <Select value={customUrl} onValueChange={setCustomUrl}>
                <SelectTrigger>
                  <SelectValue placeholder="Velg side" />
                </SelectTrigger>
                <SelectContent>
                  {PUSH_DESTINATIONS.map((d) => (
                    <SelectItem key={d.url} value={d.url}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full h-12"
              onClick={handleSendCustom}
              disabled={sendingId !== null || !customTitle.trim() || !customMessage.trim()}
            >
              {sendingId === 'custom' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send til alle ledere
                </>
              )}
            </Button>
          </div>
        ) : (
        <div className="space-y-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] overflow-y-auto flex-1 min-h-0 -mx-1 px-1">
          <Button
            variant="outline"
            className="w-full h-auto p-4 flex items-start gap-4 justify-start text-left"
            onClick={() => setCustomMode(true)}
            disabled={sendingId !== null}
          >
            <div className={cn('p-3 rounded-xl text-white shrink-0', 'bg-primary')}>
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-foreground">Egen varsling</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                Skriv din egen melding til alle ledere
              </div>
            </div>
            <div className="shrink-0 self-center">
              <Send className="w-5 h-5 text-muted-foreground" />
            </div>
          </Button>

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
        )}
      </SheetContent>
    </Sheet>
  );
}
