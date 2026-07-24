import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Car, Anchor, Mountain, ArrowDown, Cable, Wrench, ShieldCheck, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { hapticSelection, hapticImpact } from '@/lib/capacitorHaptics';
import { supabase } from '@/integrations/supabase/client';
import oksnoenLogo from '@/assets/oksnoen-logo.png';
import oksnoenHeaderAsset from '@/assets/oksnoen-header.png.asset.json';
import redCloth from '@/assets/red-bookcloth.webp.asset.json';
import ivoryPaper from '@/assets/ivory-paper.webp.asset.json';

type Leader = Tables<'leaders'>;

interface PeriodHistoryEntry {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  status: string | null;
}

interface LederPassProps {
  leader: Leader | null | undefined;
  /**
   * When true, always render the fullscreen passport (used by inactive-mode
   * home). When false (default), render only the small 3D icon, and open
   * the fullscreen view on click.
   */
  fill?: boolean;
  /** Optional active period label shown on the "godkjenninger" spread. */
  periodLabel?: string | null;
}

const RED_CLOTH_URL = redCloth.url;
const IVORY_URL = ivoryPaper.url;
const HEADER_URL = oksnoenHeaderAsset.url;

function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatTeamDisplay(team: string | null | undefined): string {
  if (!team) return '';
  const t = team.toLowerCase().trim();
  if (['1', '2', '1f', '2f'].includes(t)) return `Team ${team.toUpperCase()}`;
  return team;
}

/* -------------------------------------------------------------------------- */
/*  Small 3D icon                                                             */
/* -------------------------------------------------------------------------- */

interface LederPassIconProps {
  size?: number;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
}

export function LederPassIcon({
  size = 56,
  onClick,
  ariaLabel = 'Åpne ditt lederpass',
  className,
}: LederPassIconProps) {
  const w = size;
  const h = Math.round(size * 1.32);
  return (
    <button
      type="button"
      onClick={() => {
        hapticSelection();
        onClick?.();
      }}
      aria-label={ariaLabel}
      className={cn(
        'group relative shrink-0 rounded-[6px] outline-none transition-transform',
        'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-700',
        'hover:-translate-y-0.5 active:translate-y-0',
        className,
      )}
      style={{ width: w, height: h, perspective: 400 }}
    >
      {/* Shadow */}
      <span
        aria-hidden
        className="absolute -bottom-1 left-1 right-1 h-2 rounded-full bg-black/40 blur-md"
      />
      {/* Pages peeking */}
      <span
        aria-hidden
        className="absolute inset-y-[6%] left-[3%] right-[3%] rounded-[3px] bg-[#f5ecd8] shadow-[inset_0_-1px_0_rgba(0,0,0,0.15)]"
      />
      {/* Cover */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-[6px] shadow-[0_6px_14px_-6px_rgba(0,0,0,0.55),0_2px_4px_rgba(0,0,0,0.35),inset_0_0_0_1px_rgba(0,0,0,0.35)]"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.15), rgba(0,0,0,0.35)), url(${RED_CLOTH_URL})`,
          backgroundSize: 'cover',
          backgroundBlendMode: 'overlay, normal',
          backgroundColor: '#7a0a0e',
          transform: 'rotateY(-8deg)',
          transformOrigin: 'left center',
        }}
      />
      {/* Gold border + text */}
      <span
        aria-hidden
        className="absolute inset-[8%] rounded-[3px] border pointer-events-none"
        style={{
          borderColor: 'rgba(240,205,120,0.55)',
          transform: 'rotateY(-8deg)',
          transformOrigin: 'left center',
        }}
      />
      <span
        aria-hidden
        className="absolute inset-0 flex flex-col items-center justify-between py-[14%]"
        style={{ transform: 'rotateY(-8deg)', transformOrigin: 'left center' }}
      >
        <span
          className="font-semibold tracking-[0.15em] text-[8px] leading-none"
          style={{ color: '#f0cd78', fontSize: Math.max(7, size * 0.16) }}
        >
          PASS
        </span>
        <img
          src={oksnoenLogo}
          alt=""
          className="object-contain opacity-95"
          style={{ width: size * 0.45, height: size * 0.45 }}
        />
        <span
          className="font-semibold tracking-[0.18em] leading-none"
          style={{ color: '#f0cd78', fontSize: Math.max(6, size * 0.13) }}
        >
          LEDER
        </span>
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Fullscreen passport view                                                  */
/* -------------------------------------------------------------------------- */

interface Spread {
  key: string;
  eyebrow: string;
  left: React.ReactNode;
  right: React.ReactNode;
}

function SealMark({ label = 'OKSNØEN' }: { label?: string }) {
  return (
    <div className="relative w-24 h-24 rounded-full flex items-center justify-center shrink-0"
      style={{
        background: 'radial-gradient(circle at 30% 30%, #a01a1e, #6a0a10 70%)',
        boxShadow: 'inset 0 0 0 2px rgba(240,205,120,0.65), 0 2px 6px rgba(0,0,0,0.25)',
      }}>
      <img src={oksnoenLogo} alt="Oksnøen" className="w-14 h-14 object-contain" />
      <span className="absolute -bottom-2 text-[9px] tracking-[0.25em] text-[#6a0a10] font-semibold bg-[#f0cd78] rounded-full px-2 py-0.5">
        {label}
      </span>
    </div>
  );
}

function LabeledField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5 text-center">
      <div className="text-[9px] tracking-[0.25em] uppercase text-[#7a5a20] font-semibold">
        {label}
      </div>
      <div className="text-[15px] leading-tight font-semibold text-[#3a2410]">{value}</div>
    </div>
  );
}

function CertBadge({ icon: Icon, label, active }: { icon: any; label: string; active: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-[11px] leading-none',
        active
          ? 'border-[#7a0a0e]/40 bg-[#f0cd78]/30 text-[#3a2410]'
          : 'border-[#3a2410]/15 bg-transparent text-[#3a2410]/40',
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="font-medium">{label}</span>
    </div>
  );
}

function buildSpreads(
  leader: Leader | null | undefined,
  periodLabel?: string | null,
  history: PeriodHistoryEntry[] = [],
): Spread[] {
  const name = leader?.name ?? 'Ukjent leder';
  const initials = getInitials(name);
  const role = leader?.ministerpost || 'Leder';
  const team = formatTeamDisplay(leader?.team ?? null);
  const age = leader?.age ? `${leader.age} år` : '—';

  const photo = leader?.profile_image_url;

  const Photo = (
    <div className="mx-auto w-24 h-28 rounded-sm overflow-hidden bg-[#e8dcc0] border border-[#3a2410]/25 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.5),0_1px_2px_rgba(0,0,0,0.15)] flex items-center justify-center">
      {photo ? (
        <img src={photo} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="text-2xl font-serif font-bold text-[#3a2410]/70">{initials}</span>
      )}
    </div>
  );

  return [
    {
      key: 'legitimasjon',
      eyebrow: 'Legitimasjon',
      left: (
        <div className="flex flex-col items-center justify-center h-full gap-3 px-3 text-center">
          <div className="text-[10px] tracking-[0.3em] uppercase text-[#7a5a20]">Lederpass</div>
          <SealMark />
          <div className="text-lg font-serif font-bold text-[#3a2410] leading-tight">OKSNØEN</div>
          <div className="text-[10px] tracking-[0.25em] uppercase text-[#3a2410]/70">
            Leirskole & sommerleir
          </div>
          <div className="text-[10px] italic text-[#3a2410]/60">Anno 1962</div>
          <div className="h-px w-14 bg-[#3a2410]/30" />
          <div className="text-[10px] italic text-[#3a2410]/60">Det åpne lederpasset</div>
        </div>
      ),
      right: (
        <div className="flex flex-col items-center justify-center h-full gap-3 px-3 text-center">
          <div className="text-[10px] tracking-[0.3em] uppercase text-[#7a5a20]">Leder</div>
          {Photo}
          <LabeledField label="Navn" value={name} />
          <LabeledField label="Stilling" value={role} />
        </div>
      ),
    },
    {
      key: 'opplysninger',
      eyebrow: 'Lederopplysninger',
      left: (
        <div className="flex flex-col justify-center h-full gap-4 px-4">
          <LabeledField label="Fullt navn" value={name} />
          <LabeledField label="Alder" value={age} />
          <LabeledField label="Statsborgerskap" value="Øksnøyaner" />
        </div>
      ),
      right: (
        <div className="flex flex-col justify-center h-full gap-4 px-4">
          <LabeledField label="Rolle" value={role} />
          <LabeledField label="Lag" value={team || '—'} />
          <LabeledField label="Telefon" value={leader?.phone || '—'} />
        </div>
      ),
    },
    {
      key: 'historikk',
      eyebrow: 'Tjenestehistorikk',
      left: (
        <div className="flex flex-col justify-center h-full gap-3 px-3 text-center">
          <div className="text-[10px] tracking-[0.3em] uppercase text-[#7a5a20]">
            Tjenestehistorikk
          </div>
          <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center border border-[#3a2410]/30 bg-[#f0cd78]/30">
            <CalendarDays className="w-6 h-6 text-[#7a0a0e]" />
          </div>
          <div className="text-[11px] italic text-[#3a2410]/70 leading-relaxed px-2">
            Perioder {name.split(' ')[0]} har jobbet eller er satt opp på ved Øksnøen.
          </div>
          <div className="h-px w-14 mx-auto bg-[#3a2410]/30" />
          <div className="text-[10px] uppercase tracking-[0.25em] text-[#3a2410]/60">
            {history.length} {history.length === 1 ? 'periode' : 'perioder'}
          </div>
        </div>
      ),
      right: (
        <div className="flex flex-col justify-center h-full gap-2 px-3">
          <div className="text-[10px] tracking-[0.3em] uppercase text-[#7a5a20] text-center mb-1">
            Stempler
          </div>
          {history.length === 0 ? (
            <div className="text-[11px] italic text-[#3a2410]/60 text-center px-2 leading-relaxed">
              Ingen registrerte perioder ennå.
            </div>
          ) : (
            <ul className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
              {history.map((p) => {
                const range = [p.start_date, p.end_date]
                  .filter(Boolean)
                  .map((d) => new Date(d as string).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' }))
                  .join(' – ');
                return (
                  <li
                    key={p.id}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-[11px]',
                      p.is_active
                        ? 'border-[#7a0a0e]/50 bg-[#f0cd78]/30 text-[#3a2410]'
                        : 'border-[#3a2410]/20 bg-[#f4ede0]/70 text-[#3a2410]/80',
                    )}
                  >
                    <span className="font-semibold truncate">{p.name}</span>
                    <span className="shrink-0 text-[10px] text-[#3a2410]/60">
                      {range || (p.is_active ? 'Aktiv' : '')}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ),
    },
    {
      key: 'godkjenninger',
      eyebrow: 'Godkjenninger',
      left: (
        <div className="flex flex-col justify-center h-full gap-2.5 px-4">
          <div className="text-[10px] tracking-[0.3em] uppercase text-[#7a5a20] text-center mb-1">
            Sertifiseringer
          </div>
          <CertBadge icon={Car} label="Førerkort" active={!!leader?.has_drivers_license} />
          <CertBadge icon={Car} label="Bil" active={!!leader?.has_car} />
          <CertBadge icon={Anchor} label="Båtførerbevis" active={!!leader?.has_boat_license} />
          <CertBadge icon={ArrowDown} label="Rappellering" active={!!leader?.can_rappelling} />
          <CertBadge icon={Mountain} label="Klatring" active={!!leader?.can_climbing} />
          <CertBadge icon={Cable} label="Taubane" active={!!leader?.can_zipline} />
          <CertBadge icon={Wrench} label="Tau-oppsett" active={!!leader?.can_rope_setup} />
        </div>
      ),
      right: (
        <div className="flex flex-col items-center justify-center h-full gap-4 px-4 text-center">
          <div className="text-[10px] tracking-[0.3em] uppercase text-[#7a5a20]">
            Aktiv periode
          </div>
          <div className="text-xl font-serif font-bold text-[#3a2410]">
            {periodLabel || 'Sesong'}
          </div>
          <div className="h-px w-16 bg-[#3a2410]/30" />
          <div className="text-[11px] italic text-[#3a2410]/70 leading-relaxed">
            Gyldig kun ved oppmøte<br />på Øksnøen sommerleir.
          </div>
        </div>
      ),
    },
    {
      key: 'lederloftet',
      eyebrow: 'Lederløftet',
      left: (
        <div className="flex flex-col justify-center h-full gap-3 px-4">
          <div className="text-[10px] tracking-[0.3em] uppercase text-[#7a5a20] text-center">
            Lederløftet
          </div>
          <p className="text-[12px] leading-relaxed text-[#3a2410] font-serif italic text-center">
            «Jeg lover å ta vare på deltakerne, kollegene og øya. Å gå foran med
            varme, oppmerksomhet og godt humør — og å bære Øksnøen-ånden videre.»
          </p>
          <div className="mt-2 text-center text-[10px] uppercase tracking-[0.25em] text-[#3a2410]/60">
            — {name}
          </div>
        </div>
      ),
      right: (
        <div className="flex flex-col items-center justify-center h-full gap-4 px-4 text-center">
          <div className="text-[10px] tracking-[0.3em] uppercase text-[#7a5a20]">
            Passkontroll
          </div>
          <div
            className="relative w-28 h-28 rounded-full border-[3px] flex items-center justify-center"
            style={{
              borderColor: '#7a0a0e',
              color: '#7a0a0e',
              transform: 'rotate(-8deg)',
            }}
          >
            <div className="text-center">
              <ShieldCheck className="w-6 h-6 mx-auto" />
              <div className="text-[10px] tracking-[0.25em] font-bold mt-1">GODKJENT</div>
              <div className="text-[8px] italic mt-0.5">Øksnøen</div>
            </div>
          </div>
          <div className="text-[10px] italic text-[#3a2410]/60">
            Undertegnet på Øksnøen.
          </div>
        </div>
      ),
    },
  ];
}

interface FullViewProps {
  leader: Leader | null | undefined;
  onClose?: () => void;
  /** When true, renders inline filling its container (no modal chrome). */
  inline?: boolean;
  periodLabel?: string | null;
}

/* -------------------------------------------------------------------------- */
/*  Individual page components (used inside HTMLFlipBook)                     */
/* -------------------------------------------------------------------------- */

interface PassportPageProps {
  side: 'left' | 'right';
  eyebrow?: string;
  children: React.ReactNode;
}

// react-pageflip passes a ref to each direct child; that ref must land on a
// DOM node, so we use forwardRef.
const PassportPage = forwardRef<HTMLDivElement, PassportPageProps>(function PassportPage(
  { side, children },
  ref,
) {
  return (
    <div
      ref={ref}
      className="relative w-full h-full overflow-hidden"
      style={{
        backgroundImage: `url(${IVORY_URL})`,
        backgroundSize: 'cover',
        backgroundColor: '#f5ecd8',
      }}
    >
      <div className="absolute inset-0 p-4 overflow-hidden">{children}</div>
      {/* Spine shadow along the binding edge */}
      <div
        aria-hidden
        className="absolute inset-y-0 w-6 pointer-events-none"
        style={{
          [side === 'left' ? 'right' : 'left']: 0,
          background:
            side === 'left'
              ? 'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(60,30,10,0.22) 100%)'
              : 'linear-gradient(to left, rgba(0,0,0,0) 0%, rgba(60,30,10,0.22) 100%)',
        }}
      />
    </div>
  );
});

// Hard cover pages (front / back). Uses the red bookcloth texture.
const PassportCoverPage = forwardRef<HTMLDivElement, { side: 'front' | 'back' }>(
  function PassportCoverPage({ side }, ref) {
    return (
      <div
        ref={ref}
        className="relative w-full h-full flex items-center justify-center overflow-hidden"
        data-density="hard"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.10), rgba(0,0,0,0.35)), url(${RED_CLOTH_URL})`,
          backgroundSize: 'cover',
          backgroundColor: '#7a0a0e',
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.5)',
        }}
      >
        {/* Gold inner frame */}
        <div
          aria-hidden
          className="absolute inset-[6%] rounded-sm pointer-events-none"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(240,205,120,0.55)' }}
        />
        {side === 'front' ? (
          <div className="relative flex flex-col items-center gap-3 text-center px-6">
            <span
              className="text-[10px] tracking-[0.35em] font-semibold"
              style={{ color: '#f0cd78' }}
            >
              PASS
            </span>
            <img src={oksnoenLogo} alt="" className="w-20 h-20 object-contain opacity-95" />
            <span
              className="text-lg tracking-[0.25em] font-serif font-bold"
              style={{ color: '#f0cd78' }}
            >
              ØKSNØEN
            </span>
            <span
              className="text-[10px] tracking-[0.3em]"
              style={{ color: '#f0cd78', opacity: 0.85 }}
            >
              LEDERPASS
            </span>
          </div>
        ) : (
          <div className="relative flex flex-col items-center gap-2 text-center px-6">
            <span
              className="text-[9px] tracking-[0.3em] italic"
              style={{ color: '#f0cd78', opacity: 0.85 }}
            >
              Anno 1962
            </span>
            <img src={oksnoenLogo} alt="" className="w-12 h-12 object-contain opacity-80" />
          </div>
        )}
      </div>
    );
  },
);

function LederPassFullView({ leader, onClose, inline = false, periodLabel }: FullViewProps) {
  const [history, setHistory] = useState<PeriodHistoryEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    const leaderId = leader?.id;
    if (!leaderId) {
      setHistory([]);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('leader_period_history')
        .select('periods!inner(id,name,start_date,end_date,is_active)')
        .eq('leader_id', leaderId);
      if (cancelled) return;
      if (error || !data) {
        setHistory([]);
        return;
      }
      const rows: PeriodHistoryEntry[] = (data as any[])
        .map((r) => ({
          id: r.periods.id as string,
          name: r.periods.name as string,
          start_date: (r.periods.start_date as string | null) ?? null,
          end_date: (r.periods.end_date as string | null) ?? null,
          is_active: !!r.periods.is_active,
          status: null,
        }))
        .sort((a, b) => {
          const av = a.start_date ?? '';
          const bv = b.start_date ?? '';
          return bv.localeCompare(av);
        });
      setHistory(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [leader?.id]);

  const spreads = useMemo(() => buildSpreads(leader, periodLabel, history), [leader, periodLabel, history]);

  // Flatten spreads into a linear list of pages so the book flips one leaf at
  // a time (front cover → left/right per spread → back cover).
  const pages = useMemo(() => {
    const inner: { key: string; eyebrow: string; side: 'left' | 'right'; content: React.ReactNode }[] = [];
    spreads.forEach((s) => {
      inner.push({ key: `${s.key}-l`, eyebrow: s.eyebrow, side: 'left', content: s.left });
      inner.push({ key: `${s.key}-r`, eyebrow: s.eyebrow, side: 'right', content: s.right });
    });
    return inner;
  }, [spreads]);

  const totalPages = pages.length + 2; // + front + back cover
  const [pageIndex, setPageIndex] = useState(0);
  const bookRef = useRef<any>(null);

  // Spread index shown in the pill/dot indicator. Front cover -> 0, back
  // cover -> last spread. Otherwise map inner page → spread.
  const spreadIndex = useMemo(() => {
    if (pageIndex === 0) return 0;
    if (pageIndex >= totalPages - 1) return spreads.length - 1;
    return Math.floor((pageIndex - 1) / 2);
  }, [pageIndex, totalPages, spreads.length]);

  const currentEyebrow = spreads[spreadIndex]?.eyebrow ?? 'Lederpass';

  const goToSpread = useCallback(
    (i: number) => {
      const target = 1 + i * 2; // land on the left page of the spread
      bookRef.current?.pageFlip?.()?.flip(target);
    },
    [],
  );

  useEffect(() => {
    if (inline) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
      else if (e.key === 'ArrowLeft') bookRef.current?.pageFlip?.()?.flipPrev();
      else if (e.key === 'ArrowRight') bookRef.current?.pageFlip?.()?.flipNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inline, onClose]);

  const onFlip = useCallback((e: { data: number }) => {
    setPageIndex(e.data);
    hapticSelection();
  }, []);

  const containerClass = inline
    ? 'relative w-full h-full flex flex-col'
    : 'fixed inset-0 z-50 flex flex-col bg-[#f4ede0] motion-safe:animate-fade-in';

  const passportBody = (
    <div className={containerClass} role={inline ? undefined : 'dialog'} aria-modal={inline ? undefined : true} aria-label="Lederpass">
      {/* Header image */}
      <div className="relative shrink-0 h-32 md:h-40 overflow-hidden">
        <img src={HEADER_URL} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 to-[#f4ede0]" />
        {!inline && (
          <button
            type="button"
            onClick={() => {
              hapticImpact('light');
              onClose?.();
            }}
            aria-label="Lukk passet"
            className="absolute top-3 right-3 rounded-full bg-white/90 backdrop-blur px-3 py-1.5 text-xs font-medium text-[#3a2410] shadow-sm inline-flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-red-700"
          >
            <X className="w-3.5 h-3.5" /> Lukk
          </button>
        )}
      </div>

      {/* Title */}
      <div className="px-5 pt-3 pb-2 shrink-0">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#7a5a20]">Lederpass</div>
        <h1 className="text-2xl font-serif font-bold text-[#3a2410] leading-tight">{leader?.name ?? 'Ditt pass'}</h1>
        <p className="text-xs text-[#3a2410]/60 mt-0.5">Dra hjørnet for å bla i passet.</p>
      </div>

      {/* Book */}
      <div className="flex-1 min-h-0 overflow-hidden px-3 py-3 flex flex-col items-center">
        <div className="w-full max-w-[560px] mx-auto flex-1 min-h-0">
          <HTMLFlipBook
            ref={bookRef}
            width={340}
            height={520}
            size="stretch"
            minWidth={280}
            maxWidth={560}
            minHeight={380}
            maxHeight={760}
            showCover
            drawShadow
            flippingTime={700}
            maxShadowOpacity={0.4}
            usePortrait
            mobileScrollSupport
            className="mx-auto"
            style={{}}
            startPage={0}
            startZIndex={0}
            autoSize
            clickEventForward
            useMouseEvents
            swipeDistance={30}
            showPageCorners
            disableFlipByClick={false}
            onFlip={onFlip}
          >
            {/* Front cover */}
            <PassportCoverPage side="front" />
            {/* Inner pages */}
            {pages.map((p) => (
              <PassportPage key={p.key} side={p.side} eyebrow={p.eyebrow}>
                {p.content}
              </PassportPage>
            ))}
            {/* Back cover */}
            <PassportCoverPage side="back" />
          </HTMLFlipBook>
        </div>

          {/* Page indicator (dots only — no arrows; use swipe to turn pages) */}
          <div className="mt-3 flex flex-col items-center gap-1.5 shrink-0">
            <div className="text-xs font-semibold tracking-wide text-[#3a2410]">
              {currentEyebrow}
            </div>
            <div
              role="tablist"
              aria-label="Sidevalg"
              className="flex items-center justify-center gap-1.5"
            >
              {spreads.map((s, i) => (
                <button
                  key={s.key}
                  role="tab"
                  aria-selected={i === spreadIndex}
                  aria-label={`Gå til ${s.eyebrow}`}
                  onClick={() => goToSpread(i)}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i === spreadIndex ? 'w-6 bg-[#7a0a0e]' : 'w-1.5 bg-[#3a2410]/25',
                  )}
                />
              ))}
            </div>
            <div className="text-[10px] text-[#3a2410]/50">
              Dra hjørnet for å bla
            </div>
          </div>

          {!inline && (
            <div className="mt-3 flex justify-center pb-4 shrink-0">
              <button
                type="button"
                onClick={() => {
                  hapticImpact('light');
                  onClose?.();
                }}
                className="inline-flex items-center gap-2 rounded-full bg-white/90 border border-[#3a2410]/15 px-4 py-2 text-sm text-[#3a2410] shadow-sm focus-visible:ring-2 focus-visible:ring-red-700"
              >
                <X className="w-4 h-4" /> Lukk passet
              </button>
            </div>
          )}
      </div>
    </div>
  );

  return passportBody;
}

/* -------------------------------------------------------------------------- */
/*  Public orchestrator                                                       */
/* -------------------------------------------------------------------------- */

export function LederPass({ leader, fill = false, periodLabel }: LederPassProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || fill) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, fill]);

  if (fill) {
    return <LederPassFullView leader={leader} inline periodLabel={periodLabel} />;
  }

  return (
    <>
      <LederPassIcon onClick={() => setOpen(true)} />
      {open &&
        createPortal(
          <LederPassFullView
            leader={leader}
            onClose={() => setOpen(false)}
            periodLabel={periodLabel}
          />,
          document.body,
        )}
    </>
  );
}

export default LederPass;