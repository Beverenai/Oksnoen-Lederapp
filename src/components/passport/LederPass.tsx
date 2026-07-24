import { useEffect, useMemo, useRef, useState, useCallback, useLayoutEffect } from 'react';
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
        hapticImpact('medium');
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

/* -------------------------------------------------------------------------- */
/*  Period stamp — one distinct ink stamp per period                          */
/* -------------------------------------------------------------------------- */

const STAMP_INKS: { ink: string; shadow: string }[] = [
  { ink: '#7a0a0e', shadow: 'rgba(122,10,14,0.30)' },
  { ink: '#1b3a5b', shadow: 'rgba(27,58,91,0.30)' },
  { ink: '#2f5d3a', shadow: 'rgba(47,93,58,0.30)' },
  { ink: '#6a3410', shadow: 'rgba(106,52,16,0.30)' },
  { ink: '#5a2a6a', shadow: 'rgba(90,42,106,0.30)' },
  { ink: '#1f5f66', shadow: 'rgba(31,95,102,0.30)' },
  { ink: '#8a5a10', shadow: 'rgba(138,90,16,0.30)' },
];

function stampInkFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return STAMP_INKS[h % STAMP_INKS.length];
}

function stampTiltFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 17 + seed.charCodeAt(i)) >>> 0;
  return (h % 17) - 8; // -8°..+8°
}

function shortPeriodLabel(name: string): string {
  const m = name.match(/(\d+\+?)/);
  return m ? m[1] : name.trim().slice(0, 3).toUpperCase();
}

function stampYearFor(p: PeriodHistoryEntry): string {
  const src = p.start_date || p.end_date;
  if (!src) return '';
  const y = new Date(src).getFullYear();
  return Number.isFinite(y) ? String(y) : '';
}

function PeriodStamp({ period, size = 72 }: { period: PeriodHistoryEntry; size?: number }) {
  const ink = stampInkFor(period.id || period.name);
  const tilt = stampTiltFor(period.id || period.name);
  const label = shortPeriodLabel(period.name);
  const year = stampYearFor(period);

  const rOuter = 46;
  const rInner = 39;
  const rText = 42;

  const topPathId = `stamp-top-${period.id}`;
  const bottomPathId = `stamp-bot-${period.id}`;

  return (
    <div
      className="relative flex items-center justify-center select-none"
      style={{
        width: size,
        height: size,
        transform: `rotate(${tilt}deg)`,
        filter: `drop-shadow(0 1px 0 ${ink.shadow})`,
      }}
      aria-label={`Stempel ${period.name}${year ? ` ${year}` : ''}`}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{ color: ink.ink, opacity: 0.92 }}
      >
        <defs>
          <path
            id={topPathId}
            d={`M ${50 - rText},50 a ${rText},${rText} 0 1,1 ${rText * 2},0`}
            fill="none"
          />
          <path
            id={bottomPathId}
            d={`M ${50 - rText + 2},50 a ${rText - 2},${rText - 2} 0 1,0 ${(rText - 2) * 2},0`}
            fill="none"
          />
        </defs>

        <circle cx="50" cy="50" r={rOuter} fill="none" stroke="currentColor" strokeWidth="2.4" />
        <circle cx="50" cy="50" r={rInner} fill="none" stroke="currentColor" strokeWidth="0.9" />

        <g fill="currentColor">
          <circle cx="7.5" cy="50" r="1.4" />
          <circle cx="92.5" cy="50" r="1.4" />
        </g>

        <text
          fill="currentColor"
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontWeight: 700,
            fontSize: 8.2,
            letterSpacing: 2.6,
          }}
        >
          <textPath href={`#${topPathId}`} startOffset="50%" textAnchor="middle">
            ØKSNØEN · LEDER
          </textPath>
        </text>

        <text
          fill="currentColor"
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontWeight: 600,
            fontSize: 7,
            letterSpacing: 3,
          }}
        >
          <textPath href={`#${bottomPathId}`} startOffset="50%" textAnchor="middle">
            {year ? `ANNO ${year}` : 'ANNO 1962'}
          </textPath>
        </text>

        <line x1="34" y1="60" x2="66" y2="60" stroke="currentColor" strokeWidth="0.9" />

        <text
          x="50"
          y="52"
          textAnchor="middle"
          fill="currentColor"
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontWeight: 800,
            fontSize: label.length > 2 ? 18 : 22,
            letterSpacing: 0.5,
          }}
        >
          {label}
        </text>

        <text
          x="50"
          y="70"
          textAnchor="middle"
          fill="currentColor"
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontWeight: 600,
            fontSize: 6.2,
            letterSpacing: 2.4,
          }}
        >
          PERIODE
        </text>
      </svg>

      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.35), transparent 40%), radial-gradient(circle at 70% 75%, rgba(0,0,0,0.10), transparent 45%)',
          mixBlendMode: 'multiply',
        }}
      />
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
/*  3D page-flip mechanics                                                    */
/* -------------------------------------------------------------------------- */

const FLIP_TRANSITION_SPREAD = 'transform 470ms cubic-bezier(0.32, 0.72, 0.28, 1)';
const FLIP_TRANSITION_SINGLE = 'transform 540ms cubic-bezier(0.32, 0.72, 0.28, 1)';

type FlipState = {
  direction: 'next' | 'prev';
  progress: number; // 0..1
  animating: boolean;
};

function BookPageFace({
  content,
  side,
  isFlipping = false,
  variant = 'ivory',
}: {
  content: React.ReactNode;
  side: 'left' | 'right';
  isFlipping?: boolean;
  variant?: 'ivory' | 'cover';
}) {
  if (variant === 'cover') {
    return (
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.10), rgba(0,0,0,0.32)), url(${RED_CLOTH_URL})`,
          backgroundSize: 'cover',
          backgroundColor: '#7a0a0e',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      >
        {/* Gold inner border */}
        <div
          className="absolute inset-3 rounded-[6px] pointer-events-none"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(240,205,120,0.55)' }}
        />
        <div className="absolute inset-0 p-3">{content}</div>
        {/* Spine shadow on left */}
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 w-6 pointer-events-none"
          style={{
            background:
              'linear-gradient(to right, rgba(0,0,0,0.35), rgba(0,0,0,0) 100%)',
          }}
        />
      </div>
    );
  }
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        backgroundImage: `url(${IVORY_URL})`,
        backgroundSize: 'cover',
        backgroundColor: '#f5ecd8',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        // Back faces are pre-rotated 180° in the parent; those pass isFlipping.
        transform: isFlipping && side === 'right' ? 'rotateY(180deg)' : undefined,
      }}
    >
      <div className="absolute inset-0 p-3">{content}</div>
      {/* Spine shadow along the binding edge */}
      <div
        aria-hidden
        className="absolute inset-y-0 w-5 pointer-events-none"
        style={{
          [side === 'left' ? 'right' : 'left']: 0,
          background:
            side === 'left'
              ? 'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(60,30,10,0.20) 100%)'
              : 'linear-gradient(to left, rgba(0,0,0,0) 0%, rgba(60,30,10,0.20) 100%)',
        }}
      />
    </div>
  );
}

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
  // Flat page list for single-page (portrait / passport) mode.
  // The FIRST page is always the red cloth cover.
  const pages = useMemo(() => {
    const cover = {
      key: 'cover',
      eyebrow: 'Forside',
      variant: 'cover' as const,
      content: (
        <div className="flex flex-col items-center justify-between h-full py-8 text-center">
          <div
            className="text-[10px] tracking-[0.35em] font-semibold"
            style={{ color: '#f0cd78' }}
          >
            LEDERPASS
          </div>
          <div className="flex flex-col items-center gap-4">
            <div
              className="relative w-24 h-24 rounded-full flex items-center justify-center"
              style={{
                background: 'radial-gradient(circle at 30% 30%, #b7212a, #6a0a10 70%)',
                boxShadow:
                  'inset 0 0 0 2px rgba(240,205,120,0.65), 0 4px 10px rgba(0,0,0,0.35)',
              }}
            >
              <img src={oksnoenLogo} alt="" className="w-14 h-14 object-contain" />
            </div>
            <div
              className="text-xl font-serif font-bold tracking-wide"
              style={{ color: '#f0cd78' }}
            >
              OKSNØEN
            </div>
            <div
              className="text-[10px] tracking-[0.3em]"
              style={{ color: '#f0cd78', opacity: 0.75 }}
            >
              LEIRSKOLE & SOMMERLEIR
            </div>
          </div>
          <div
            className="text-[9px] tracking-[0.3em] font-semibold"
            style={{ color: '#f0cd78' }}
          >
            LEDER · ANNO 1962
          </div>
        </div>
      ),
    };
    const inner = spreads.flatMap((s) => [
      { key: `${s.key}-l`, eyebrow: s.eyebrow, variant: 'ivory' as const, content: s.left },
      { key: `${s.key}-r`, eyebrow: s.eyebrow, variant: 'ivory' as const, content: s.right },
    ]);
    return [cover, ...inner];
  }, [spreads]);

  // Measure the book container and decide layout (single portrait vs. spread).
  const bookAreaRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ mode: 'single' | 'spread'; W: number; H: number }>({
    mode: 'single',
    W: 300,
    H: 450,
  });

  useLayoutEffect(() => {
    const el = bookAreaRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      // Reserve a bit of breathing room inside the area.
      const availW = Math.max(200, rect.width - 24);
      const availH = Math.max(240, rect.height - 24);
      const useSpread = availW >= 720 && availW > availH;
      // ratio = W / H
      const ratio = useSpread ? 3 / 2 : 2 / 3;
      let H = availH;
      let W = H * ratio;
      if (W > availW) {
        W = availW;
        H = W / ratio;
      }
      setSize({
        mode: useSpread ? 'spread' : 'single',
        W: Math.floor(W),
        H: Math.floor(H),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isSingle = size.mode === 'single';
  const total = isSingle ? pages.length : spreads.length;
  const [index, setIndex] = useState(0);
  useEffect(() => {
    // Keep index in range when mode toggles between single/spread.
    setIndex((i) => Math.max(0, Math.min(total - 1, i)));
    setFlip(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);
  const [flip, setFlip] = useState<FlipState | null>(null);

  const bookRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    x: number;
    y: number;
    locked: 'x' | 'y' | null;
    direction: 'next' | 'prev' | null;
    started: boolean;
    pointerId: number;
  } | null>(null);
  const prefersReducedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedRef.current = mq.matches;
    const handler = () => { prefersReducedRef.current = mq.matches; };
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  const canNext = index < total - 1;
  const canPrev = index > 0;

  // Kick off a flip animation programmatically (buttons/keyboard).
  const startAnimatedFlip = useCallback(
    (direction: 'next' | 'prev') => {
      if (flip) return;
      if (direction === 'next' && !canNext) return;
      if (direction === 'prev' && !canPrev) return;
      if (prefersReducedRef.current) {
        setIndex((i) => (direction === 'next' ? i + 1 : i - 1));
        hapticImpact('light');
        return;
      }
      // Paint the 0-progress frame first, then flip transition ON and set
      // progress→1. Two rAFs guarantee the browser committed the starting
      // transform before the transition kicks in.
      setFlip({ direction, progress: 0, animating: false });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setFlip((f) => (f ? { ...f, progress: 1, animating: true } : f));
        });
      });
    },
    [flip, canNext, canPrev],
  );

  const goToSpread = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(total - 1, i));
      if (clamped === index) return;
      // Jump target when it's more than one spread away or reduced-motion.
      if (Math.abs(clamped - index) !== 1 || prefersReducedRef.current) {
        setFlip(null);
        setIndex(clamped);
        hapticImpact('light');
        return;
      }
      startAnimatedFlip(clamped > index ? 'next' : 'prev');
    },
    [total, index, startAnimatedFlip],
  );

  useEffect(() => {
    if (inline) return;
    // Åpning: kraftigere impact når passet vises i full skjerm
    hapticImpact('medium');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
      else if (e.key === 'ArrowLeft') startAnimatedFlip('prev');
      else if (e.key === 'ArrowRight') startAnimatedFlip('next');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inline, onClose, startAnimatedFlip]);

  const onLeafTransitionEnd = useCallback((e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.propertyName !== 'transform') return;
    setFlip((f) => {
      if (!f || !f.animating) return f;
      if (f.progress >= 1) {
        setIndex((i) => (f.direction === 'next' ? i + 1 : i - 1));
        // Sidebytte fullført
        hapticImpact('light');
      } else {
        // Snap-back: brukeren slapp hjørnet under 50 %
        hapticImpact('light');
      }
      return null;
    });
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (flip?.animating) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      locked: null,
      direction: null,
      started: false,
      pointerId: e.pointerId,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (d.locked == null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      // Favor horizontal: only release to vertical when clearly a vertical swipe.
      if (Math.abs(dy) > Math.abs(dx) * 1.4) {
        // Vertical gesture — release, let the page scroll.
        d.locked = 'y';
        return;
      }
      d.locked = 'x';
      d.direction = dx < 0 ? 'next' : 'prev';
      if ((d.direction === 'next' && !canNext) || (d.direction === 'prev' && !canPrev)) {
        d.direction = null;
        d.locked = 'y';
        return;
      }
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      d.started = true;
      setFlip({ direction: d.direction, progress: 0, animating: false });
    }
    if (d.locked === 'x' && d.direction) {
      e.preventDefault();
      const w = bookRef.current?.clientWidth ?? 320;
      const half = w / 2;
      const progress = Math.max(0, Math.min(1, Math.abs(dx) / half));
      setFlip((f) => (f && !f.animating ? { ...f, progress } : f));
    }
  };

  const onPointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    try {
      (e.currentTarget as Element).releasePointerCapture(d.pointerId);
    } catch {
      /* noop */
    }
    if (!d.started || !d.direction) return;
    setFlip((f) => {
      if (!f) return f;
      const commit = f.progress > 0.5;
      if (prefersReducedRef.current) {
        if (commit) {
          setIndex((i) => (f.direction === 'next' ? i + 1 : i - 1));
        }
        return null;
      }
      // Kick off transition to the resolved endpoint.
      requestAnimationFrame(() => {
        setFlip((cur) => (cur ? { ...cur, progress: commit ? 1 : 0, animating: true } : cur));
      });
      return f;
    });
  };

  const currentSpread = spreads[index];
  const nextSpread = spreads[index + 1];
  const prevSpread = spreads[index - 1];

  // ------- Derived content per current mode -------
  // In single mode: base = destination page during flip, else current page.
  // In spread mode: two halves, keep the existing model.
  const currentPage = pages[index];
  const nextPage = pages[index + 1];
  const prevPage = pages[index - 1];

  // Flipping progress + shading (shared)
  const flipProgress = flip?.progress ?? 0;
  const frontShadow = flipProgress <= 0.5 ? flipProgress * 0.55 : (1 - flipProgress) * 0.55;
  const backShadow = flipProgress >= 0.5 ? (1 - flipProgress) * 0.55 : flipProgress * 0.55;

  const currentEyebrow = isSingle
    ? currentPage?.eyebrow ?? 'Lederpass'
    : currentSpread?.eyebrow ?? 'Lederpass';

  // ---- Single mode leaf geometry ----
  // Pivot at LEFT edge for both directions.
  //   next: angle 0 → -180 (progress 0..1)
  //   prev: angle -180 → 0 (progress 0..1)
  const singleLeafAngle = flip
    ? flip.direction === 'next'
      ? -180 * flip.progress
      : -180 * (1 - flip.progress)
    : 0;

  // ---- Spread mode leaf geometry (existing) ----
  const spreadLeafAngle = flip
    ? flip.direction === 'next'
      ? -180 * flip.progress
      : 180 * flip.progress
    : 0;
  const spreadLeafOrigin = flip?.direction === 'next' ? 'left center' : 'right center';
  const spreadLeafSideStyle: React.CSSProperties =
    flip?.direction === 'next' ? { left: '50%' } : { left: 0 };

  // Spread base halves + leaf faces (existing model).
  const spreadLeftBase = flip?.direction === 'prev' ? prevSpread?.left : currentSpread?.left;
  const spreadRightBase = flip?.direction === 'next' ? nextSpread?.right : currentSpread?.right;
  const spreadLeafFront: React.ReactNode =
    flip?.direction === 'next'
      ? currentSpread?.right
      : flip?.direction === 'prev'
      ? currentSpread?.left
      : null;
  const spreadLeafBack: React.ReactNode =
    flip?.direction === 'next'
      ? nextSpread?.left
      : flip?.direction === 'prev'
      ? prevSpread?.right
      : null;

  // ---- Single-mode base + leaf faces ----
  // Base is the DESTINATION page during a flip, else the current page.
  const singleBase: React.ReactNode =
    flip?.direction === 'next'
      ? nextPage?.content
      : flip?.direction === 'prev'
      ? prevPage?.content
      : currentPage?.content;
  // Leaf front face is what the user starts seeing (the page currently on top
  // before the flip lands on the destination).
  const singleLeafFront: React.ReactNode =
    flip?.direction === 'next'
      ? currentPage?.content
      : flip?.direction === 'prev'
      ? prevPage?.content
      : null;
  const singleLeafBack: React.ReactNode =
    flip?.direction === 'next'
      ? nextPage?.content
      : flip?.direction === 'prev'
      ? currentPage?.content
      : null;

  const flipTransition = isSingle ? FLIP_TRANSITION_SINGLE : FLIP_TRANSITION_SPREAD;

  const containerClass = inline
    ? 'relative w-full h-full flex flex-col overflow-hidden'
    : 'fixed inset-0 z-50 flex flex-col bg-[#f4ede0] motion-safe:animate-fade-in overflow-hidden';

  // Compute total dot count based on mode.
  const dotCount = total;

  // Pixel size of the book element.
  const bookW = size.W;
  const bookH = size.H;
  const perspective = Math.min(2000, Math.max(1200, bookW * 3));

  const passportBody = (
    <div
      className={containerClass}
      style={{ backgroundColor: '#f4ede0' }}
      role={inline ? undefined : 'dialog'}
      aria-modal={inline ? undefined : true}
      aria-label="Lederpass"
    >
      {/* Slim top bar */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 pb-2 relative"
        style={{
          paddingTop: inline
            ? '12px'
            : 'max(env(safe-area-inset-top, 0px), 12px)',
        }}
      >
        {/* mini seal */}
        <div
          className="relative w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: 'radial-gradient(circle at 30% 30%, #a01a1e, #6a0a10 70%)',
            boxShadow: 'inset 0 0 0 1.5px rgba(240,205,120,0.65), 0 2px 4px rgba(0,0,0,0.25)',
          }}
        >
          <img src={oksnoenLogo} alt="" className="w-6 h-6 object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] uppercase tracking-[0.28em] text-[#7a5a20] font-semibold truncate">
            Lederpass{periodLabel ? ` · ${periodLabel}` : ''}
          </div>
          <div className="text-base sm:text-lg font-serif font-bold text-[#3a2410] leading-tight truncate">
            {leader?.name ?? 'Ditt pass'}
          </div>
        </div>
        {!inline && (
          <button
            type="button"
            onClick={() => {
              hapticImpact('light');
              onClose?.();
            }}
            aria-label="Lukk passet"
            className="rounded-full bg-white/90 backdrop-blur px-3 py-1.5 text-xs font-medium text-[#3a2410] shadow-sm inline-flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-red-700"
          >
            <X className="w-3.5 h-3.5" /> Lukk
          </button>
        )}
      </div>

      {/* Book area — fills the middle, book is sized to fit */}
      <div
        ref={bookAreaRef}
        className="flex-1 min-h-0 flex items-center justify-center px-3"
      >
        {bookW > 0 && bookH > 0 && (
          <div
            className="relative"
            style={{
              width: bookW,
              height: bookH,
              // Restrained tilt so the closed book reads as physical at rest.
              transform: flip ? 'none' : 'perspective(1600px) rotateX(4deg) rotateY(-3deg)',
              transformOrigin: 'center 65%',
              transition: 'transform 320ms cubic-bezier(0.32,0.72,0.28,1)',
            }}
          >
            {/* Depth: ivory page edges peeking below/right, and back cover below */}
            <div
              aria-hidden
              className="absolute inset-y-3 -right-[3px] w-[3px] rounded-r-sm"
              style={{ backgroundColor: '#e8dcc0', boxShadow: 'inset 0 0 0 1px rgba(60,30,10,0.25)' }}
            />
            <div
              aria-hidden
              className="absolute inset-y-3 -left-[3px] w-[3px] rounded-l-sm"
              style={{ backgroundColor: '#e8dcc0', boxShadow: 'inset 0 0 0 1px rgba(60,30,10,0.25)' }}
            />

            {/* Red cloth cover */}
            <div
              className="relative w-full h-full rounded-[12px] p-2.5 shadow-[0_22px_44px_-16px_rgba(0,0,0,0.6),0_8px_18px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(0,0,0,0.5)]"
              style={{
                backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.10), rgba(0,0,0,0.35)), url(${RED_CLOTH_URL})`,
                backgroundSize: 'cover',
                backgroundColor: '#7a0a0e',
              }}
            >
              {/* Gold inner border */}
              <div
                className="w-full h-full rounded-[8px] p-1"
                style={{ boxShadow: 'inset 0 0 0 1px rgba(240,205,120,0.55)' }}
              >
                {/* 3D scene */}
                <div
                  className="relative w-full h-full rounded-[6px] overflow-hidden"
                  style={{ perspective: `${perspective}px` }}
                >
                  <div
                    ref={bookRef}
                    role="group"
                    aria-label={currentEyebrow}
                    data-lederpass-book
                    className="relative w-full h-full select-none"
                    style={{
                      transformStyle: 'preserve-3d',
                      touchAction: 'none',
                    }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUpOrCancel}
                    onPointerCancel={onPointerUpOrCancel}
                  >
                    {isSingle ? (
                      <>
                        {/* Single-page base (destination during flip) */}
                        <div className="absolute inset-0 overflow-hidden">
                          <BookPageFace
                            content={singleBase}
                            side="right"
                            variant={
                              (flip?.direction === 'next'
                                ? nextPage?.variant
                                : flip?.direction === 'prev'
                                ? prevPage?.variant
                                : currentPage?.variant) ?? 'ivory'
                            }
                          />
                        </div>
                        {/* Spine shadow on left edge */}
                        <div
                          aria-hidden
                          className="absolute inset-y-0 left-0 w-3 pointer-events-none z-10"
                          style={{
                            background:
                              'linear-gradient(to right, rgba(60,30,10,0.45), rgba(60,30,10,0.10) 60%, rgba(60,30,10,0) 100%)',
                          }}
                        />
                        {/* Corner peel affordance — bottom-right */}
                        {!flip && canNext && (
                          <div
                            aria-hidden
                            className="absolute bottom-0 right-0 pointer-events-none z-[15]"
                            style={{
                              width: 44,
                              height: 44,
                              background:
                                'linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.18) 50%, rgba(0,0,0,0.05) 100%)',
                            }}
                          />
                        )}
                        {/* Flipping leaf (full page, pivots on LEFT edge) */}
                        {flip && singleLeafFront != null && singleLeafBack != null && (
                          <div
                            aria-hidden
                            className="absolute inset-0 z-20 pointer-events-none"
                            style={{
                              transformOrigin: 'left center',
                              transformStyle: 'preserve-3d',
                              transform: `rotateY(${singleLeafAngle}deg) translateZ(0)`,
                              transition: flip.animating ? flipTransition : 'none',
                              willChange: 'transform',
                            }}
                            onTransitionEnd={onLeafTransitionEnd}
                          >
                            {/* Front face */}
                            <div
                              className="absolute inset-0"
                              style={{
                                backfaceVisibility: 'hidden',
                                WebkitBackfaceVisibility: 'hidden' as any,
                              }}
                            >
                              <BookPageFace
                                content={singleLeafFront}
                                side="right"
                                variant={
                                  (flip.direction === 'next'
                                    ? currentPage?.variant
                                    : prevPage?.variant) ?? 'ivory'
                                }
                              />
                              {/* Curl highlight along free (right) edge */}
                              <div
                                className="absolute inset-y-0 right-0 w-16 pointer-events-none"
                                style={{
                                  background:
                                    'linear-gradient(to left, rgba(0,0,0,0.18), rgba(0,0,0,0))',
                                  opacity: 1 - Math.abs(flipProgress - 0.5) * 2,
                                }}
                              />
                              <div
                                className="absolute inset-0 pointer-events-none"
                                style={{ backgroundColor: `rgba(0,0,0,${frontShadow})` }}
                              />
                            </div>
                            {/* Back face (pre-rotated 180°) */}
                            <div
                              className="absolute inset-0"
                              style={{
                                backfaceVisibility: 'hidden',
                                WebkitBackfaceVisibility: 'hidden' as any,
                                transform: 'rotateY(180deg)',
                              }}
                            >
                              <BookPageFace
                                content={singleLeafBack}
                                side="left"
                                variant={
                                  (flip.direction === 'next'
                                    ? nextPage?.variant
                                    : currentPage?.variant) ?? 'ivory'
                                }
                              />
                              <div
                                className="absolute inset-y-0 left-0 w-16 pointer-events-none"
                                style={{
                                  background:
                                    'linear-gradient(to right, rgba(0,0,0,0.18), rgba(0,0,0,0))',
                                  opacity: 1 - Math.abs(flipProgress - 0.5) * 2,
                                }}
                              />
                              <div
                                className="absolute inset-0 pointer-events-none"
                                style={{ backgroundColor: `rgba(0,0,0,${backShadow})` }}
                              />
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {/* Spread mode — two halves + center-pivoting leaf */}
                        <div className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
                          <BookPageFace content={spreadLeftBase} side="left" />
                        </div>
                        <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden">
                          <BookPageFace content={spreadRightBase} side="right" />
                        </div>
                        <div
                          aria-hidden
                          className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[3px] pointer-events-none z-10"
                          style={{
                            background:
                              'linear-gradient(to right, rgba(60,30,10,0.35), rgba(60,30,10,0.55), rgba(60,30,10,0.35))',
                          }}
                        />
                        {flip && spreadLeafFront != null && spreadLeafBack != null && (
                          <div
                            aria-hidden
                            className="absolute inset-y-0 w-1/2 z-20 pointer-events-none"
                            style={{
                              ...spreadLeafSideStyle,
                              transformOrigin: spreadLeafOrigin,
                              transformStyle: 'preserve-3d',
                              transform: `rotateY(${spreadLeafAngle}deg) translateZ(0)`,
                              transition: flip.animating ? flipTransition : 'none',
                              willChange: 'transform',
                            }}
                            onTransitionEnd={onLeafTransitionEnd}
                          >
                            <div
                              className="absolute inset-0"
                              style={{
                                backfaceVisibility: 'hidden',
                                WebkitBackfaceVisibility: 'hidden' as any,
                              }}
                            >
                              <BookPageFace
                                content={spreadLeafFront}
                                side={flip.direction === 'next' ? 'right' : 'left'}
                              />
                              <div
                                className="absolute inset-0 pointer-events-none"
                                style={{ backgroundColor: `rgba(0,0,0,${frontShadow})` }}
                              />
                            </div>
                            <div
                              className="absolute inset-0"
                              style={{
                                backfaceVisibility: 'hidden',
                                WebkitBackfaceVisibility: 'hidden' as any,
                                transform: 'rotateY(180deg)',
                              }}
                            >
                              <BookPageFace
                                content={spreadLeafBack}
                                side={flip.direction === 'next' ? 'left' : 'right'}
                              />
                              <div
                                className="absolute inset-0 pointer-events-none"
                                style={{ backgroundColor: `rgba(0,0,0,${backShadow})` }}
                              />
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Slim bottom controls — dots only, plus corner-drag hint */}
      <div
        className="shrink-0 flex flex-col items-center gap-1.5 pt-2 px-3"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
      >
        <div className="text-[10px] uppercase tracking-[0.28em] text-[#7a5a20] font-semibold">
          {currentEyebrow}
        </div>
        <div
          role="tablist"
          aria-label="Sidevalg"
          className="flex items-center justify-center gap-1.5 max-w-[80vw] overflow-hidden"
        >
          {Array.from({ length: dotCount }).map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === index}
              aria-label={`Gå til side ${i + 1}`}
              onClick={() => goToSpread(i)}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === index ? 'w-5 bg-[#7a0a0e]' : 'w-1.5 bg-[#3a2410]/25',
              )}
            />
          ))}
        </div>
        <div className="text-[10px] text-[#3a2410]/55">Dra hjørnet for å bla</div>
      </div>
    </div>
  );

  // Silence unused var warning when HEADER_URL isn't referenced anymore in the
  // slim layout — keep the import so the asset stays bundled for any future use.
  void HEADER_URL;

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