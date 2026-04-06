import { useStatusPopup } from '@/hooks/useStatusPopup';
import { Bell, BellOff, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface PushNotificationStatusProps {
  variant?: 'card' | 'inline' | 'button';
  className?: string;
  onSuccess?: () => void;
}

export function PushNotificationStatus({
  variant = 'inline',
  className = '',
  onSuccess,
}: PushNotificationStatusProps) {
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const {
    isSupported,
    isEnabled,
    isLoading,
    isSyncing,
    permission,
    error,
    enablePushNotifications,
    retrySync,
  } = usePushNotifications();

  const handleActivate = async () => {
    const success = await enablePushNotifications();
    if (success) {
      showSuccess('Varsler aktivert!');
      onSuccess?.();
    } else if (error) {
      showError(error);
    }
  };

  const handleRetry = async () => {
    const success = await retrySync();
    if (success) {
      showSuccess('Varsler synkronisert!');
    }
  };

  // Not supported
  if (!isSupported) {
    return (
      <div className={`flex items-center gap-2 text-muted-foreground ${className}`}>
        <BellOff className="h-4 w-4" />
        <span className="text-sm">Varsler støttes ikke på denne enheten</span>
      </div>
    );
  }

  // Permission denied
  if (permission === 'denied') {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Varsler er blokkert</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Gå til innstillinger i nettleseren for å tillate varsler fra denne appen.
        </p>
      </div>
    );
  }

  // Loading initial state
  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 text-muted-foreground ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Sjekker varselstatus...</span>
      </div>
    );
  }

  // Syncing
  if (isSyncing) {
    return (
      <div className={`flex items-center gap-2 text-muted-foreground ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Synkroniserer varsler...</span>
      </div>
    );
  }

  // Error with retry option
  if (error && permission === 'granted') {
    return (
      <div className={`flex flex-col gap-3 ${className}`}>
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleRetry} className="w-fit">
          <RefreshCw className="h-4 w-4 mr-2" />
          Prøv igjen
        </Button>
      </div>
    );
  }

  // Enabled - show success status
  if (isEnabled && permission === 'granted') {
    return (
      <div className={`flex items-center gap-2 text-primary ${className}`}>
        <CheckCircle className="h-4 w-4" />
        <span className="text-sm font-medium">Varsler er aktivert</span>
      </div>
    );
  }

  // Button variant for onboarding
  if (variant === 'button') {
    return (
      <Button
        onClick={handleActivate}
        disabled={isLoading}
        className={`w-full ${className}`}
        size="lg"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Bell className="h-4 w-4 mr-2" />
        )}
        Aktiver varsler
      </Button>
    );
  }

  // Default - show activate button
  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <BellOff className="h-4 w-4" />
        <span className="text-sm">Varsler er ikke aktivert</span>
      </div>
      <Button variant="outline" size="sm" onClick={handleActivate} disabled={isLoading}>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Bell className="h-4 w-4 mr-2" />
            Aktiver
          </>
        )}
      </Button>
    </div>
  );
}
