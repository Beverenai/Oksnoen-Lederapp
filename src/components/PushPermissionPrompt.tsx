import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogHeader,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function PushPermissionPrompt() {
  const { leader, isProfileComplete, refreshLeader } = useAuth();
  const { enablePushNotifications, isSupported, isEnabled, permission, isLoading, isNative } = usePushNotifications();
  const [open, setOpen] = useState(false);
  const [deniedMode, setDeniedMode] = useState(false);
  const [hasEvaluated, setHasEvaluated] = useState(false);

  const markSeen = async () => {
    if (!leader?.id) return;
    await supabase
      .from('leaders')
      .update({ has_seen_push_prompt: true })
      .eq('id', leader.id);
    await refreshLeader();
  };

  useEffect(() => {
    if (hasEvaluated) return;
    if (!leader || !isProfileComplete) return;
    if (isLoading) return;
    if (!isSupported) return;
    if (isEnabled) return;
    if (leader.has_seen_push_prompt && !(isNative && permission === 'default')) return;

    setHasEvaluated(true);

    // Already granted — silently mark seen
    if (permission === 'granted') {
      void markSeen();
      return;
    }

    const timer = setTimeout(() => {
      if (permission === 'denied') {
        setDeniedMode(true);
      }
      setOpen(true);
    }, 1500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leader?.id, leader?.has_seen_push_prompt, isProfileComplete, isSupported, isEnabled, isLoading, isNative, permission]);

  const handleEnable = async () => {
    const success = await enablePushNotifications();
    if (success || permission === 'denied') {
      await markSeen();
    }
    setOpen(false);
  };

  const handleLater = () => {
    setOpen(false);
  };

  const handleOk = async () => {
    await markSeen();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) void handleLater(); }}>
      <DialogContent className="rounded-2xl max-w-sm">
        <DialogHeader className="items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Bell className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-xl">
            {deniedMode ? 'Varslinger er avslått' : 'Få beskjed med en gang'}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {deniedMode
              ? 'Du har avslått varslinger tidligere. For å aktivere må du gå til Innstillinger → Notifications → Øksnøen LederApp.'
              : 'Aktiver varslinger så du får viktig info, vaktendringer og hurtigvarslinger direkte på telefonen — også når appen er lukket.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {deniedMode ? (
            <Button onClick={handleOk} className="w-full rounded-xl">OK</Button>
          ) : (
            <>
              <Button onClick={handleEnable} disabled={isLoading} className="w-full rounded-xl">
                {isLoading ? 'Aktiverer...' : 'Aktiver varslinger'}
              </Button>
              <Button onClick={handleLater} variant="ghost" className="w-full rounded-xl">
                Senere
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
