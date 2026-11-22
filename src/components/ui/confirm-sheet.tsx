import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { hapticImpact, hapticWarning } from '@/lib/capacitorHaptics';

/**
 * iOS-lik bekreftelse (handlingsark nederst) i stedet for nettleserens confirm().
 *
 *   if (!(await confirmDialog('Slette denne?'))) return;
 *
 * Knappeteksten og om den er rød gjettes ut fra teksten (slett, fjern, nullstill),
 * men kan settes med `confirmLabel` og `destructive`.
 */

export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface Request extends ConfirmOptions {
  message: string;
  resolve: (ok: boolean) => void;
}

let push: ((req: Request) => void) | null = null;

function guess(message: string): { label: string; destructive: boolean } {
  const m = message.toLowerCase();
  if (/slett|slette/.test(m)) return { label: 'Slett', destructive: true };
  if (/fjern/.test(m)) return { label: 'Fjern', destructive: true };
  if (/nullstill|tilbakestill|reset/.test(m)) return { label: 'Nullstill', destructive: true };
  if (/off-season|deaktiver/.test(m)) return { label: 'Fortsett', destructive: true };
  return { label: 'Fortsett', destructive: false };
}

export function confirmDialog(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!push) {
      // Verten er ikke montert (skal ikke skje). Fall tilbake til nettleseren.
      resolve(window.confirm(message));
      return;
    }
    push({ ...options, message, resolve });
  });
}

export function ConfirmHost() {
  const [req, setReq] = useState<Request | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    push = (r) => {
      setLeaving(false);
      setReq(r);
    };
    return () => {
      push = null;
    };
  }, []);

  useEffect(() => {
    if (!req) return;
    const g = guess(req.message);
    if (req.destructive ?? g.destructive) hapticWarning();
    else hapticImpact('light');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(false);
      if (e.key === 'Enter') finish(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req]);

  if (!req) return null;

  const g = guess(req.message);
  const destructive = req.destructive ?? g.destructive;
  const confirmLabel = req.confirmLabel ?? g.label;

  function finish(ok: boolean) {
    if (!req) return;
    const r = req;
    setLeaving(true);
    if (ok) hapticImpact(destructive ? 'medium' : 'light');
    window.setTimeout(() => {
      setReq(null);
      r.resolve(ok);
    }, 160);
  }

  // Første linje blir tittel hvis teksten har flere avsnitt og ingen tittel er gitt.
  const [first, ...rest] = req.message.split(/\n\s*\n/);
  const title = req.title ?? (rest.length ? first : undefined);
  const body = req.title ? req.message : rest.length ? rest.join('\n\n') : first;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center" role="alertdialog" aria-modal="true">
      <button
        type="button"
        aria-label={req.cancelLabel ?? 'Avbryt'}
        className={cn(
          'absolute inset-0 bg-black/40 transition-opacity duration-150',
          leaving ? 'opacity-0' : 'animate-in fade-in-0',
        )}
        onClick={() => finish(false)}
      />
      <div
        className={cn(
          'relative w-full max-w-md px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-transform duration-150',
          leaving ? 'translate-y-full' : 'animate-in slide-in-from-bottom-8 duration-200',
        )}
      >
        <div className="overflow-hidden rounded-2xl bg-background/95 backdrop-blur-xl">
          <div className="px-5 py-4 text-center">
            {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
            <p className={cn('whitespace-pre-line text-[13px] text-muted-foreground', title && 'mt-1')}>{body}</p>
          </div>
          <button
            type="button"
            autoFocus
            onClick={() => finish(true)}
            className={cn(
              'w-full border-t border-border/60 py-3.5 text-[17px] active:bg-muted',
              destructive ? 'font-semibold text-red-600 dark:text-red-500' : 'font-semibold text-primary',
            )}
          >
            {confirmLabel}
          </button>
        </div>
        <button
          type="button"
          onClick={() => finish(false)}
          className="mt-2 w-full rounded-2xl bg-background py-3.5 text-[17px] font-semibold text-primary active:bg-muted"
        >
          {req.cancelLabel ?? 'Avbryt'}
        </button>
      </div>
    </div>,
    document.body,
  );
}
