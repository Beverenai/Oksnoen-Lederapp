import oksnoenLogo from '@/assets/oksnoen-logo.png';
import { cn } from '@/lib/utils';

interface PassIconProps {
  className?: string;
  size?: number;
}

export const PassIcon = ({ className, size = 24 }: PassIconProps) => {
  return (
    <div 
      className={cn(
        'flex flex-col items-center justify-center rounded border-2 border-current',
        className
      )}
      style={{ width: size, height: size }}
    >
      <span 
        className="font-bold leading-none tracking-tight"
        style={{ fontSize: size * 0.25 }}
      >
        PASS
      </span>
      <img 
        src={oksnoenLogo} 
        alt="" 
        className="object-contain opacity-80"
        style={{ width: size * 0.45, height: size * 0.45 }}
      />
    </div>
  );
};
