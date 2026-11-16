import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, CloudOff, Link2, QrCode, RefreshCw, ScanLine, Search, Undo2, Users, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QrScanner } from '@/components/qr/QrScanner';
import { useActivities } from '@/hooks/useActivities';
import { useBandDirectory, useScanQueue, type BandParticipant } from '@/hooks/useWristbands';
import { hapticError, hapticImpact, hapticSuccess, hapticWarning } from '@/lib/capacitorHaptics';
import { addScan, getScanQueue, removeScan } from '@/lib/scanQueue';
import { formatWristbandCode, parseWristbandCode } from '@/lib/wristband';
import { cn } from '@/lib/utils';

type Tab = 'koble' | 'oversikt';
type Tone = 'ok' | 'warn' | 'unknown' | 'error';

interface Feedback {
  tone: Tone;
  title: string;
  detail?: string;
  participant?: BandParticipant | null;
  at: number;
}

interface SessionScan {
  client_scan_id: string;
  code: string;
  name: string;
  image: string | null;
  tone: Tone;
}

const RECENT_KEY = 'oksnoen_qr_recent_activities';

function readRecent(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function saveRecent(name: string) {
  try {
    const next = [name, ...readRecent().filter((n) => n.toLowerCase() !== name.toLowerCase())].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ikke kritisk */
  }
}

function age(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) years--;
  return `${years} år`;
}

function FeedbackCard({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) {
    return (
      <div className="ios-surface flex items-center gap-3 p-4 text-muted-foreground">
        <ScanLine className="h-6 w-6 shrink-0" />
        <p className="text-sm">Hold armbåndet foran kameraet</p>
      </div>
    );
  }
  const tone = {
    ok: 'bg-primary/10 ring-1 ring-primary/40',
    warn: 'bg-amber-500/10 ring-1 ring-amber-500/40',
    unknown: 'bg-orange-500/10 ring-1 ring-orange-500/40',
    error: 'bg-destructive/10 ring-1 ring-destructive/40',
  }[feedback.tone];
  return (
    <div key={feedback.at} className={cn('flex items-center gap-3 rounded-3xl p-3 animate-fade-in', tone)}>
      {feedback.participant ? (
        <Avatar className="h-14 w-14">
          <AvatarImage src={feedback.participant.image ?? undefined} />
          <AvatarFallback>{feedback.participant.name.charAt(0)}</AvatarFallback>
        </Avatar>
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-background/70">
          <QrCode className="h-6 w-6" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-semibold leading-tight">{feedback.title}</p>
        {feedback.detail && <p className="truncate text-sm text-muted-foreground">{feedback.detail}</p>}
      </div>
      {feedback.tone === 'ok' && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-5 w-5" />
        </span>
      )}
    </div>
  );
}

export default function Qr() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('koble');
  const directory = useBandDirectory();
  const queue = useScanQueue();

  const { participants, byCode, byParticipant, participantById } = directory;
  const withBand = participants.filter((p) => byParticipant.has(p.id)).length;

  // ---------- Koble bånd ----------
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkFeedback, setLinkFeedback] = useState<Feedback | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [conflict, setConflict] = useState<{ participant: BandParticipant; code: string; holder: string } | null>(null);

  const onLinkCode = useCallback(
    (code: string) => {
      hapticImpact('light');
      setConflict(null);
      setLinkSearch('');
      setPendingCode(code);
    },
    [],
  );

  // Åpnet fra en skannet lenke: /qr?kode=04827
  useEffect(() => {
    const fromUrl = parseWristbandCode(searchParams.get('kode'));
    if (fromUrl) {
      setTab('koble');
      setPendingCode(fromUrl);
      searchParams.delete('kode');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const linkCandidates = useMemo(() => {
    const q = linkSearch.trim().toLowerCase();
    return participants
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.cabin ?? '').toLowerCase().includes(q))
      .sort((a, b) => Number(byParticipant.has(a.id)) - Number(byParticipant.has(b.id)));
  }, [participants, linkSearch, byParticipant]);

  const currentHolder = pendingCode ? participantById.get(byCode.get(pendingCode) ?? '') ?? null : null;

  const doAssign = async (participant: BandParticipant, code: string, force = false) => {
    if (queue.isOffline) {
      hapticError();
      setLinkFeedback({ tone: 'error', title: 'Ingen nett', detail: 'Bånd må kobles når telefonen har nett', at: Date.now() });
      return;
    }
    setIsLinking(true);
    try {
      const result = await directory.assign(participant.id, code, force);
      if (result.status === 'opptatt') {
        hapticWarning();
        setConflict({ participant, code, holder: result.participant_name ?? 'en annen deltaker' });
        return;
      }
      hapticSuccess();
      setLinkFeedback({
        tone: 'ok',
        title: participant.name,
        detail: `Bånd ${formatWristbandCode(code)} er koblet`,
        participant,
        at: Date.now(),
      });
      setPendingCode(null);
      setConflict(null);
    } catch (err) {
      hapticError();
      setLinkFeedback({
        tone: 'error',
        title: 'Kunne ikke koble båndet',
        detail: (err as Error)?.message ?? 'Prøv igjen',
        at: Date.now(),
      });
    } finally {
      setIsLinking(false);
    }
  };

  const doRelease = async (participant: BandParticipant) => {
    setIsLinking(true);
    try {
      await directory.release(participant.id, 'mistet');
      hapticSuccess();
      setLinkFeedback({ tone: 'warn', title: participant.name, detail: 'Båndet er fjernet', participant, at: Date.now() });
      setPendingCode(null);
    } catch (err) {
      hapticError();
      setLinkFeedback({ tone: 'error', title: 'Kunne ikke fjerne båndet', detail: (err as Error)?.message, at: Date.now() });
    } finally {
      setIsLinking(false);
    }
  };

  // ---------- Felles ----------
  const queueLine =
    queue.counts.total === 0
      ? 'Alt er sendt'
      : `${queue.counts.waiting} venter i lageret${queue.counts.unknown ? ` · ${queue.counts.unknown} ukjente bånd` : ''}`;

  const tabs: { id: Tab; label: string; icon: typeof QrCode }[] = [
    { id: 'koble', label: 'Koble bånd', icon: Link2 },
    { id: 'oversikt', label: 'Oversikt', icon: Users },
  ];

  const missing = participants.filter((p) => !byParticipant.has(p.id));

  return (
    <div className="mx-auto max-w-2xl space-y-3 animate-fade-in">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground lg:text-3xl">Armbånd</h1>
          <p className="text-sm text-muted-foreground">
            {withBand} av {participants.length} har bånd
          </p>
        </div>
        <button
          type="button"
          onClick={() => queue.send()}
          disabled={queue.isSending || queue.counts.total === 0}
          className={cn(
            'flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium',
            queue.counts.total === 0 ? 'bg-primary/10 text-primary' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
          )}
        >
          {queue.isOffline ? (
            <CloudOff className="h-4 w-4" />
          ) : (
            <RefreshCw className={cn('h-4 w-4', queue.isSending && 'animate-spin')} />
          )}
          {queue.isOffline && queue.counts.total === 0 ? 'Uten nett' : queueLine}
        </button>
      </div>

      <Button className="h-14 w-full gap-2 rounded-2xl text-base font-semibold" onClick={() => navigate('/skann')}>
        <ScanLine className="h-5 w-5" />
        Skann aktivitet
      </Button>

      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted/60 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              hapticImpact('light');
              setTab(t.id);
            }}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-sm font-medium transition-colors',
              tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            <t.icon className="h-4 w-4" />
            <span className="truncate">{t.label}</span>
          </button>
        ))}
      </div>

      {!directory.periodId && !directory.isLoading && (
        <div className="ios-surface p-4 text-sm text-muted-foreground">Det er ingen aktiv periode akkurat nå.</div>
      )}

      {/* ---------- Koble bånd ---------- */}
      {tab === 'koble' && directory.periodId && (
        <div className="space-y-3">
          <QrScanner onCode={onLinkCode} paused={!!pendingCode} onInvalid={() => {
            hapticWarning();
            setLinkFeedback({ tone: 'warn', title: 'Dette er ikke et Oksnøen-armbånd', at: Date.now() });
          }} />

          {!pendingCode && <FeedbackCard feedback={linkFeedback} />}

          {pendingCode && (
            <div className="ios-surface space-y-3 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Bånd</p>
                  <p className="text-2xl font-bold tabular-nums">{formatWristbandCode(pendingCode)}</p>
                </div>
                <Button variant="ghost" size="icon" aria-label="Avbryt" onClick={() => { setPendingCode(null); setConflict(null); }}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {currentHolder && !conflict && (
                <div className="flex items-center gap-3 rounded-2xl bg-amber-500/10 p-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={currentHolder.image ?? undefined} />
                    <AvatarFallback>{currentHolder.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">Sitter på {currentHolder.name}</p>
                    <p className="text-xs text-muted-foreground">Velg en annen deltaker for å flytte båndet</p>
                  </div>
                  <Button size="sm" variant="outline" disabled={isLinking} onClick={() => doRelease(currentHolder)}>
                    Fjern
                  </Button>
                </div>
              )}

              {conflict && (
                <div className="space-y-2 rounded-2xl bg-amber-500/10 p-3">
                  <p className="text-sm font-semibold">Båndet sitter på {conflict.holder}</p>
                  <p className="text-xs text-muted-foreground">Flytt det til {conflict.participant.name}?</p>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={isLinking} onClick={() => doAssign(conflict.participant, conflict.code, true)}>
                      Flytt båndet
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConflict(null)}>
                      Avbryt
                    </Button>
                  </div>
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="qr-link-search"
                  placeholder="Søk deltaker eller hytte…"
                  value={linkSearch}
                  onChange={(e) => setLinkSearch(e.target.value)}
                  className="h-11 rounded-2xl border-0 bg-muted/50 pl-10"
                />
              </div>

              <div className="max-h-[46vh] space-y-1.5 overflow-y-auto overscroll-contain">
                {linkCandidates.map((p) => {
                  const band = byParticipant.get(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={isLinking}
                      onClick={() => doAssign(p, pendingCode)}
                      className="flex w-full items-center gap-3 rounded-2xl bg-muted/30 p-2 pr-3 text-left transition-all active:scale-[0.99]"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={p.image ?? undefined} />
                        <AvatarFallback className="text-xs">{p.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[age(p.birth_date), p.cabin, p.room].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {band ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                          Bytt {formatWristbandCode(band)}
                        </span>
                      ) : (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">Ingen bånd</span>
                      )}
                    </button>
                  );
                })}
                {linkCandidates.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">Ingen deltakere funnet</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------- Oversikt ---------- */}
      {tab === 'oversikt' && directory.periodId && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="ios-surface p-3">
              <p className="text-2xl font-bold tabular-nums">{withBand}</p>
              <p className="text-xs text-muted-foreground">har bånd</p>
            </div>
            <div className="ios-surface p-3">
              <p className="text-2xl font-bold tabular-nums">{missing.length}</p>
              <p className="text-xs text-muted-foreground">mangler bånd</p>
            </div>
            <div className="ios-surface p-3">
              <p className="text-2xl font-bold tabular-nums">{queue.counts.total}</p>
              <p className="text-xs text-muted-foreground">i lageret</p>
            </div>
          </div>

          {queue.counts.unknown > 0 && (
            <div className="rounded-2xl bg-orange-500/10 p-3 text-sm">
              {queue.counts.unknown} skanning{queue.counts.unknown === 1 ? '' : 'er'} gjelder bånd som ikke er koblet til noen.
              Koble båndet til riktig deltaker, så sendes skanningen inn av seg selv.
            </div>
          )}

          <div className="ios-surface space-y-2 p-3">
            <p className="text-sm font-medium">Mangler bånd ({missing.length})</p>
            <div className="max-h-[50vh] space-y-1 overflow-y-auto overscroll-contain">
              {missing.map((p) => (
                <div key={p.id} className="flex items-center gap-2.5 rounded-xl bg-muted/30 p-1.5 pr-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={p.image ?? undefined} />
                    <AvatarFallback className="text-[10px]">{p.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <p className="min-w-0 flex-1 truncate text-sm">{p.name}</p>
                  <span className="truncate text-xs text-muted-foreground">{p.cabin}</span>
                </div>
              ))}
              {missing.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">Alle deltakerne har bånd</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
