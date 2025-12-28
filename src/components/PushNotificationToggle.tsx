import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';

interface PushNotificationToggleProps {
  variant?: 'button' | 'switch';
  showLabel?: boolean;
  className?: string;
}

export function PushNotificationToggle({
  variant = 'switch',
  showLabel = true,
  className = '',
}: PushNotificationToggleProps) {
  const {
    isSupported,
    isEnabled,
    isLoading,
    permission,
    error,
    togglePushNotifications,
  } = usePushNotifications();

  const handleToggle = async () => {
    const success = await togglePushNotifications();
    if (success) {
      toast.success(isEnabled ? 'Varsler deaktivert' : 'Varsler aktivert');
    } else if (error) {
      toast.error(error);
    }
  };

  if (!isSupported) {
    return null;
  }

  if (permission === 'denied') {
    return (
      <div className={`flex items-center gap-2 text-muted-foreground ${className}`}>
        <BellOff className="h-4 w-4" />
        {showLabel && (
          <span className="text-sm">Varsler er blokkert i nettleseren</span>
        )}
      </div>
    );
  }

  if (variant === 'button') {
    return (
      <Button
        onClick={handleToggle}
        disabled={isLoading}
        variant={isEnabled ? 'default' : 'outline'}
        className={className}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : isEnabled ? (
          <Bell className="h-4 w-4 mr-2" />
        ) : (
          <BellOff className="h-4 w-4 mr-2" />
        )}
        {isEnabled ? 'Varsler på' : 'Slå på varsler'}
      </Button>
    );
  }

  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      {showLabel && (
        <Label htmlFor="push-toggle" className="flex items-center gap-2 cursor-pointer">
          {isEnabled ? (
            <Bell className="h-4 w-4 text-primary" />
          ) : (
            <BellOff className="h-4 w-4 text-muted-foreground" />
          )}
          Push-varsler
        </Label>
      )}
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Switch
          id="push-toggle"
          checked={isEnabled}
          onCheckedChange={handleToggle}
          disabled={isLoading}
        />
      )}
    </div>
  );
}
