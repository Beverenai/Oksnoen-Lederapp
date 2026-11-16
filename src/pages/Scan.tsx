import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, CloudOff, History, Link2, RefreshCw, Undo2, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { QrScanner } from '@/components/qr/QrScanner';
import { ActivityPicker } from '@/components/qr/ActivityPicker';
import { ScanHistory } from '@/components/qr/ScanHistory';
import { useBandDirectory, useScanQueue } from '@/hooks/useWristbands';
import { supabase } from '@/integrations/supabase/client';
import { hapticError, hapticImpact, hapticSuccess, hapticWarning } from '@/lib/capacitorHaptics';
import { addScan, getScanQueue, removeScan } from '@/lib/scanQueue';
import { activitySymbol } from '@/lib/activityStyle';
import { formatWristbandCode } from '@/lib/wristband';
import { cn } from '@/lib/utils';
import { ActivityRegistration, registrationKey, scanResultText } from '@/lib/activityRegistration';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

type Tone = 'ok' | 'wait' | 'warn' | 'unknown';

/** Kortet som vises i tre sekunder når et bånd er skannet. */
interface Flash {
  id: string;
  name: string;
  image: string | null;
  text: string;
  tone: Tone;
}

/** Skannet, men aktivitet er ikke valgt ennå. */
interface Pending {
  code: string;
  participant_id: string | null;
  name: string;
  image: string | null;
  scanned_at: string;
}

type UndoStep =
  | { kind: 'pending'; code: string; name: string }
  | { kind: 'scan'; client_scan_id: string; key: string; name: string };

const FLASH_MS = 3000;

const RING: Record<Tone, string> = {
  ok: 'ring-emerald-400',
  wait: 'ring-white',
  warn: 'ring-amber-400',
  unknown: 'ring-orange-400',
};

export default function Scan() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const directory = useBandDirectory();
  const queue = useScanQueue();
  const { byCode, participantById } = directory;

  const [activity, setActivity] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [count, setCount] = useState(0);
  const [undoStack, setUndoStack] = useState<UndoStep[]>([]);

  const registrationRef = useRef(new ActivityRegistration());
  const pendingRef = useRef<Pending[]>([]);
  const sendTimer = useRef<ReturnType<typeof setTimeout>>();
  const flashTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  pendingRef.current = pending;

  // Lås siden bak, så bare kameraet vises.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timers = flashTimers.current;
    return () => {
      document.body.style.overflow = previous;
      clearTimeout(sendTimer.current);
      timers.forEach(clearTimeout);
    };
  }, []);

  const flash = useCallback((f: Omit<Flash, 'id'>) => {
    const id = crypto.randomUUID();
    setFlashes((prev) => [{ ...f, id }, ...prev].slice(0, 3));
    flashTimers.current.push(setTimeout(() => setFlashes((prev) => prev.filter((x) => x.id !== id)), FLASH_MS));
  }, []);

  const scheduleSend = useCallback(() => {
    clearTimeout(sendTimer.current);
    sendTimer.current = setTimeout(() => queue.send(), 4000);
  }, [queue]);

  /** Legger én skanning i lageret. Svarer false hvis den allerede er registrert. */
  const register = useCallback(
    (p: Pending, act: string): boolean => {
      const key = registrationKey(p.participant_id, p.code, act);
      if (!registrationRef.current.add(key)) return false;
      const queued = addScan({
        session_id: registrationRef.current.sessionId,
        code: p.code,
        activity: act,
        participant_id: p.participant_id,
        participant_name: p.participant_id ? p.name : null,
        scanned_at: p.scanned_at,
      });
      setUndoStack((prev) => [{ kind: 'scan' as const, client_scan_id: queued.client_scan_id, key, name: p.name }, ...prev].slice(0, 50));
      setCount((c) => c + 1);
      return true;
    },
    [],
  );

  const onCode = useCallback(
    (code: string) => {
      const participantId = byCode.get(code) ?? null;
      const participant = participantId ? participantById.get(participantId) ?? null : null;
      const name = participant?.name ?? `Bånd ${formatWristbandCode(code)}`;
      const image = participant?.image ?? null;
      const item: Pending = { code, participant_id: participantId, name, image, scanned_at: new Date().toISOString() };

      if (!activity) {
        if (pendingRef.current.some((p) => p.code === code)) {
          hapticWarning();
          flash({ name, image, text: 'Allerede skannet', tone: 'warn' });
          return;
        }
        setPending((prev) => [...prev, item]);
        setUndoStack((prev) => [{ kind: 'pending' as const, code, name }, ...prev].slice(0, 50));
        if (participant) hapticSuccess();
        else hapticWarning();
        flash({
          name,
          image,
          text: participant ? 'Skannet. Velg aktivitet' : 'Ukjent bånd. Velg aktivitet',
          tone: participant ? 'wait' : 'unknown',
        });
        return;
      }

      if (!register(item, activity)) {
        hapticWarning();
        flash({ name, image, text: `Allerede lagt inn på ${activity}`, tone: 'warn' });
        return;
      }
      if (participant) {
        hapticSuccess();
        flash({ name, image, text: activity, tone: 'ok' });
      } else {
        hapticWarning();
        flash({ name, image, text: 'Ukjent bånd. Lagret til det er koblet', tone: 'unknown' });
      }
      scheduleSend();
    },
    [activity, byCode, participantById, flash, register, scheduleSend],
  );

  const pickActivity = (act: string) => {
    setPickerOpen(false);
    registrationRef.current.start();
    setCount(0);
    setUndoStack(prev => prev.filter(u => u.kind === 'pending'));
    setActivity(act);
    const waiting = pendingRef.current;
    if (waiting.length > 0) {
      const added = waiting.filter((p) => register(p, act)).length;
      setPending([]);
      setUndoStack((prev) => prev.filter((u) => u.kind !== 'pending'));
      hapticSuccess();
      flash({
        name: `${added} lagt til`,
        image: null,
        text: act,
        tone: 'ok',
      });
      scheduleSend();
    }
  };

  const undoLast = async () => {
    const step = undoStack[0];
    if (!step) return;
    if (step.kind === 'pending') {
      setPending((prev) => prev.filter((p) => p.code !== step.code));
    } else {
      const inQueue = getScanQueue().some((s) => s.client_scan_id === step.client_scan_id);
      if (inQueue) {
        removeScan(step.client_scan_id);
      } else {
        // Allerede sendt inn: slett registreringen på serveren.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('participant_activities')
          .delete()
          .eq('client_scan_id', step.client_scan_id);
        if (error) {
          hapticError();
          flash({ name: step.name, image: null, text: 'Kunne ikke angres uten nett', tone: 'warn' });
          return;
        }
      }
      registrationRef.current.undo(step.key);
      setCount((c) => Math.max(0, c - 1));
    }
    hapticImpact('medium');
    setUndoStack((prev) => prev.slice(1));
    flash({ name: step.name, image: null, text: 'Angret', tone: 'warn' });
  };

  const close = () => {
    if (pendingRef.current.length > 0 && !window.confirm('Du har skannet deltakere uten å velge aktivitet. Lukke likevel?')) return;
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  useEffect(() => {
    queue.lastResult?.outcomes.forEach(({ scan, status, gang, participant_id }) => {
      if (scan.session_id !== registrationRef.current.sessionId || status === 'ukjent_band') return;
      const person = participantById.get(participant_id ?? scan.participant_id ?? '');
      flash({ name: person?.name ?? scan.participant_name ?? 'Deltaker', image: person?.image ?? null,
        text: scanResultText(scan.activity, status, gang), tone: status === 'registrert' || status === 'gjentatt' ? 'ok' : 'warn' });
      if (status === 'dobbel' || status === 'ugyldig') setCount(c => Math.max(0, c - 1));
    });
  }, [queue.lastResult, flash]);

  const overlayOpen = pickerOpen || historyOpen;

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-black text-white">
      <QrScanner
        fill
        onCode={onCode}
        paused={overlayOpen}
        onInvalid={() => {
          hapticWarning();
          flash({ name: 'Ikke et Oksnøen-armbånd', image: null, text: 'Prøv et annet', tone: 'warn' });
        }}
      />

      {/* Topp: lukk og aktivitet */}
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-3 pb-10 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
        <div className="pointer-events-auto flex items-center gap-2">
          <button type="button" onClick={close} aria-label="Lukk" className="rounded-full bg-black/55 p-3 backdrop-blur">
            <X className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              hapticImpact('light');
              setPickerOpen(true);
            }}
            className={cn(
              'flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-base font-semibold backdrop-blur',
              activity ? 'bg-white text-black' : 'bg-primary text-primary-foreground',
            )}
          >
            {activity && <span aria-hidden>{activitySymbol(activity)}</span>}
            <span className="truncate">{activity || 'Velg aktivitet'}</span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
          </button>
          <div className="w-11" />
        </div>
        {(queue.isOffline || queue.counts.total > 0) && (
          <div className="mt-2 flex justify-center">
            <span className="flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs backdrop-blur">
              {queue.isOffline ? <CloudOff className="h-3.5 w-3.5" /> : <RefreshCw className={cn('h-3.5 w-3.5', queue.isSending && 'animate-spin')} />}
              {queue.isOffline ? 'Uten nett. ' : ''}
              {queue.counts.total > 0 ? `${queue.counts.total} i lageret` : 'Skanning virker'}
            </span>
          </div>
        )}
      </div>

      {/* Deltakeren som nettopp ble skannet: ansikt i sirkel og navn, tre sekunder */}
      <div className="pointer-events-none absolute inset-x-4 top-[calc(env(safe-area-inset-top,0px)+7.5rem)] flex flex-col items-center gap-2">
        {flashes.map((f, i) => (
          <div
            key={f.id}
            className={cn(
              'flex w-full max-w-sm items-center gap-3 rounded-[2rem] bg-black/75 p-2.5 pr-5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-200',
              i > 0 && 'scale-95 opacity-80',
            )}
          >
            <Avatar className={cn('ring-4', RING[f.tone], i === 0 ? 'h-20 w-20' : 'h-12 w-12')}>
              <AvatarImage src={f.image ?? undefined} className="object-cover" />
              <AvatarFallback className="bg-white/15 text-xl font-bold text-white">{f.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className={cn('truncate font-bold leading-tight', i === 0 ? 'text-2xl' : 'text-base')}>{f.name}</p>
              <p className="truncate text-sm text-white/75">{f.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Bunn: venter på aktivitet, og knapper */}
      <div className="absolute inset-x-0 bottom-0 space-y-3 bg-gradient-to-t from-black/80 to-transparent px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-12">
        {pending.length > 0 && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex w-full items-center gap-3 rounded-3xl bg-primary p-3 pr-5 text-left text-primary-foreground shadow-xl active:scale-[0.99]"
          >
            <div className="flex -space-x-3">
              {pending.slice(-4).map((p) => (
                <Avatar key={p.code} className="h-11 w-11 ring-2 ring-primary">
                  <AvatarImage src={p.image ?? undefined} className="object-cover" />
                  <AvatarFallback className="text-foreground">{p.name.charAt(0)}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold leading-tight">Velg aktivitet</p>
              <p className="text-sm opacity-85">
                {pending.length} {pending.length === 1 ? 'deltaker venter' : 'deltakere venter'}
              </p>
            </div>
          </button>
        )}

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={undoLast}
            disabled={undoStack.length === 0}
            className="flex flex-1 flex-col items-center gap-1 rounded-2xl bg-black/55 py-2.5 text-xs backdrop-blur disabled:opacity-40"
          >
            <Undo2 className="h-5 w-5" />
            Angre
          </button>
          <div className="flex flex-1 flex-col items-center">
            <span className="text-3xl font-bold leading-none tabular-nums">{activity ? count : pending.length}</span>
            <span className="text-xs text-white/75">skannet</span>
          </div>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="flex flex-1 flex-col items-center gap-1 rounded-2xl bg-black/55 py-2.5 text-xs backdrop-blur"
          >
            <History className="h-5 w-5" />
            Historikk
          </button>
          <Button variant="ghost"
            type="button"
            onClick={() => {
              registrationRef.current.start();
              setCount(0);
              setActivity('');
              setUndoStack([]);
              if (isAdmin) navigate('/qr');
            }}
            className="flex flex-1 flex-col items-center gap-1 rounded-2xl bg-black/55 py-2.5 text-xs backdrop-blur"
          >
            {isAdmin ? <Link2 className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
            {isAdmin ? 'Bånd' : 'Avslutt'}
          </Button>
        </div>
      </div>

      <div className="text-foreground">
        <ActivityPicker
          open={pickerOpen}
          current={activity}
          pendingCount={pending.length}
          onPick={pickActivity}
          onClose={() => setPickerOpen(false)}
        />
        <ScanHistory
          open={historyOpen}
          periodId={directory.periodId}
          participantById={participantById}
          onClose={() => setHistoryOpen(false)}
          onUndone={(participantId, act, sessionId) => {
            if (participantId && sessionId === registrationRef.current.sessionId) registrationRef.current.undo(registrationKey(participantId, '', act));
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
