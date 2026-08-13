import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface ParticipantChipProps {
  name: string;
  imageUrl?: string | null;
  thumbUrl?: string | null;
  subtitle?: React.ReactNode;
  size?: 'sm' | 'md';
  onClick?: () => void;
  right?: React.ReactNode;
}

export function ParticipantChip({ name, imageUrl, thumbUrl, subtitle, size = 'md', onClick, right }: ParticipantChipProps) {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-2xl bg-muted/40 px-2.5 py-2 text-left',
        onClick && 'active:scale-[0.99] transition-transform',
      )}
    >
      <Avatar className={size === 'sm' ? 'h-9 w-9' : 'h-11 w-11'}>
        <AvatarImage src={thumbUrl || imageUrl || undefined} alt={name} loading="lazy" />
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">{name}</p>
        {subtitle && <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
    </button>
  );
}