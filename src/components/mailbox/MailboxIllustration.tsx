import { cn } from '@/lib/utils';

/** Enkel, tegnet postkasse. Luken animerer når `open` er true. */
export function MailboxIllustration({
  open = false,
  className,
}: {
  open?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('relative mx-auto w-40 select-none', className)} aria-hidden>
      {/* brev som stikker opp */}
      <div
        className={cn(
          'absolute left-1/2 top-0 h-10 w-16 -translate-x-1/2 rounded-sm border border-border bg-card shadow-sm transition-all duration-500',
          open ? '-translate-y-6 rotate-[-8deg] opacity-100' : 'translate-y-4 opacity-0',
        )}
      />
      {/* kropp */}
      <div className="relative mt-10 rounded-t-[2.5rem] rounded-b-xl bg-primary/90 px-4 pb-4 pt-6 shadow-lg">
        <div
          className={cn(
            'mx-auto h-2 w-20 rounded-full bg-primary-foreground/70 transition-transform duration-500 origin-left',
            open ? 'rotate-[-25deg]' : 'rotate-0',
          )}
        />
        <div className="mx-auto mt-4 h-10 w-24 rounded-md bg-background/85" />
        <div className="mx-auto mt-3 h-1.5 w-14 rounded-full bg-primary-foreground/50" />
      </div>
      {/* stolpe */}
      <div className="mx-auto h-10 w-6 rounded-b-md bg-muted-foreground/40" />
    </div>
  );
}
