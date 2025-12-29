import { WifiOff, RefreshCw, CloudOff } from "lucide-react";
import { useBackgroundSync } from "@/hooks/useBackgroundSync";
import { cn } from "@/lib/utils";

export function OfflineIndicator() {
  const { isOffline, isSyncing, pendingCount } = useBackgroundSync();

  if (!isOffline && pendingCount === 0 && !isSyncing) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-2 px-4 py-2",
        isOffline 
          ? "bg-destructive text-destructive-foreground" 
          : isSyncing 
            ? "bg-primary text-primary-foreground"
            : "bg-amber-500 text-white",
        "rounded-full shadow-lg",
        "animate-in fade-in slide-in-from-bottom-4 duration-300"
      )}
    >
      {isOffline ? (
        <>
          <WifiOff className="h-4 w-4" />
          <span className="text-sm font-medium">
            Offline{pendingCount > 0 ? ` • ${pendingCount} venter` : ''}
          </span>
        </>
      ) : isSyncing ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">Synkroniserer...</span>
        </>
      ) : pendingCount > 0 ? (
        <>
          <CloudOff className="h-4 w-4" />
          <span className="text-sm font-medium">{pendingCount} venter på sync</span>
        </>
      ) : null}
    </div>
  );
}
