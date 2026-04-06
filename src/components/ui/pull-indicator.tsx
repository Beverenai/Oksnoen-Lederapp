import { RefreshCw } from 'lucide-react';

interface PullIndicatorProps {
  isPulling: boolean;
  isRefreshing: boolean;
  pullProgress: number;
}

export function PullIndicator({ isPulling, isRefreshing, pullProgress }: PullIndicatorProps) {
  const visible = isPulling || isRefreshing;

  return (
    <div 
      className="flex items-center justify-center overflow-hidden transition-all duration-300"
      style={{ 
        height: visible ? `${Math.min(pullProgress * 0.6, 60)}px` : '0px',
        opacity: visible ? pullProgress / 100 : 0 
      }}
    >
      <div 
        className={`w-8 h-8 rounded-full border-2 border-primary flex items-center justify-center transition-transform ${isRefreshing ? 'animate-spin' : ''}`}
        style={{ 
          transform: !isRefreshing ? `rotate(${pullProgress * 3.6}deg)` : undefined 
        }}
      >
        <RefreshCw className="w-4 h-4 text-primary" />
      </div>
    </div>
  );
}
