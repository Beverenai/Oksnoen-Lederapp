import { WifiOff } from "lucide-react";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { cn } from "@/lib/utils";

export function OfflineIndicator() {
  const isOffline = useOfflineStatus();

  if (!isOffline) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-2 px-4 py-2",
        "bg-destructive text-destructive-foreground",
        "rounded-full shadow-lg",
        "animate-in fade-in slide-in-from-bottom-4 duration-300"
      )}
    >
      <WifiOff className="h-4 w-4" />
      <span className="text-sm font-medium">Offline-modus</span>
    </div>
  );
}
