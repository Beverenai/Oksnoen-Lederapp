import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Car,
  Anchor,
  Mountain,
  ArrowDown,
  Cable,
  Wrench,
  ShieldCheck,
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { hapticImpact } from '@/lib/capacitorHaptics';
import { useAuth } from '@/contexts/AuthContext';
import { useLeaderServicePeriods, PERIOD_CODES } from '@/hooks/useLeaderServicePeriods';
import { PassRail, type RailPage } from './PassRail';
import { PeriodStamp, type StampEntry } from './PeriodStamp';
import { ServiceHistoryEditor } from './ServiceHistoryEditor';
import oksnoenLogo from '@/assets/oksnoen-logo.png';
import redCloth from '@/assets/red-bookcloth.webp.asset.json';
import ivoryPaper from '@/assets/ivory-paper.webp.asset.json';

type Leader = Tables<'leaders'>;

interface LederPassProps {
  leader: Leader | null | undefined;
  /** When true, render the passport inline filling its container. */
  fill?: boolean;
  /** Optional active period label shown on the "godkjenninger" page. */
  periodLabel?: string | null;
}

const RED_CLOTH_URL = redCloth.url;
const IVORY_URL = ivoryPaper.url;

const STAMPS_PER_PAGE = 12;

function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map(n => n[0])
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

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];

  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Small 3D icon                                                             */
/* -------------------------------------------------------------------------- */

export function LederPassIcon({
  size = 56,
  onClick,
  ariaLabel = 'Åpne ditt lederpass',
  className,
}: {
  size?: number;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
}) {
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
      <span
        aria-hidden
        className="absolute -bottom-1 left-1 right-1 h-2 rounded-full bg-black/40 blur-md"
      />
      <span
        aria-hidden
        className="absolute inset-y-[6%] left-[3%] right-[3%] rounded-[3px] bg-[#f5ecd8] shadow-[inset_0_-1px_0_rgba(0,0,0,0.15)]"
      />
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
          className="font-semibold tracking-[0.15em] leading-none"
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
/*  Page furniture                                                            */
/* -------------------------------------------------------------------------- */

function SealMark({ label = 'OKSNØEN' }: { label?: string }) {
  return (
    <div
      className="relative w-24 h-24 rounded-full flex items-center justify-center shrink-0"
      style={{
        background: 'radial-gradient(circle at 30% 30%, #a01a1e, #6a0a10 70%)',
        boxShadow: 'inset 0 0 0 2px rgba(240,205,120,0.65), 0 2px 6px rgba(0,0,0,0.25)',
      }}
    >
      <img
        src={oksnoenLogo}
        alt="Oksnøen"
        className="w-14 h-14 object-contain"
        loading="lazy"
        decoding="async"
      />
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

/** A single passport leaf — cover cloth or ivory paper. */
function PageSurface({
  variant,
  children,
}: {
  variant: 'cover' | 'ivory';
  children: React.ReactNode;
}) {
  if (variant === 'cover') {
    return (
      <div
        className="absolute inset-0 overflow-hidden rounded-[8px]"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.10), rgba(0,0,0,0.32)), url(${RED_CLOTH_URL})`,
          backgroundSize: 'cover',
          backgroundColor: '#7a0a0e',
        }}
      >
        <div
          aria-hidden
          className="absolute inset-3 rounded-[6px] pointer-events-none"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(240,205,120,0.55)' }}
        />
        <div className="absolute inset-0 p-3">{children}</div>
      </div>
    );
  }
  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-[8px]"
      style={{
        backgroundImage: `url(${IVORY_URL})`,
        backgroundSize: 'cover',
        backgroundColor: '#f5ecd8',
      }}
    >
      <div className="absolute inset-0 p-3">{children}</div>
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-5 pointer-events-none"
        style={{
          background: 'linear-gradient(to right, rgba(60,30,10,0.20) 0%, rgba(0,0,0,0) 100%)',
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Fullscreen passport view                                                  */
/* -------------------------------------------------------------------------- */

interface FullViewProps {
  leader: Leader | null | undefined;
  onClose?: () => void;
  inline?: boolean;
  periodLabel?: string | null;
}

function LederPassFullView({ leader, onClose, inline = false, periodLabel }: FullViewProps) {
  const { leader: authLeader, isAdmin } = useAuth();
  const canEdit = !!leader?.id && (authLeader?.id === leader.id || isAdmin);

  const { data: servicePeriods = [] } = useLeaderServicePeriods(leader?.id);

  const stamps = useMemo<StampEntry[]>(() => {
    const order = (code: string) => {
      const i = (PERIOD_CODES as readonly string[]).indexOf(code);
      return i === -1 ? 99 : i;
    };
    const seen = new Set<string>();
    return [...servicePeriods]
      .filter(r => {
        const k = `${r.year}-${r.period_code}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => a.year - b.year || order(a.period_code) - order(b.period_code))
      .map(r => ({
        key: `${r.year}-${r.period_code}`,
        year: r.year,
        periodCode: String(r.period_code),
      }));
  }, [servicePeriods]);

  const name = leader?.name ?? 'Ukjent leder';
  const initials = getInitials(name);
  const role = leader?.ministerpost || 'Leder';
  const team = formatTeamDisplay(leader?.team ?? null);
  const age = leader?.age ? `${leader.age} år` : '—';

  const [index, setIndex] = useState(0);

  const pages = useMemo<(RailPage & { eyebrow: string })[]>(() => {
    const photo = leader?.profile_image_url;
    const Photo = (
      <div className="mx-auto w-24 h-28 rounded-sm overflow-hidden bg-[#e8dcc0] border border-[#3a2410]/25 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.5),0_1px_2px_rgba(0,0,0,0.15)] flex items-center justify-center">
        {photo ? (
          <img
            src={photo}
            alt={name}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="text-2xl font-serif font-bold text-[#3a2410]/70">{initials}</span>
        )}
      </div>
    );

    const stampPages = stamps.length
      ? chunk(stamps, STAMPS_PER_PAGE).map((group, pageIdx, all) => {
          const years = group.map(g => g.year);
          const minY = Math.min(...years);
          const maxY = Math.max(...years);
          const yearRange = minY === maxY ? `${minY}` : `${minY}–${maxY}`;
          // Offsets: hand-stamped feel, but same-year stamps nudge toward each other
          const jitter = (seed: string, salt: number, span: number) =>
            ((hash(seed, salt) % (span * 2 + 1)) - span);
          return {
          key: `stempler-${pageIdx}`,
          eyebrow:
            all.length > 1 ? `Periodestempler ${pageIdx + 1}/${all.length}` : 'Periodestempler',
          variant: 'ivory' as const,
          content: (
            <div className="relative flex flex-col h-full gap-1">
              <img
                src={oksnoenLogo}
                alt=""
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 w-[78%] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.06]"
              />
              <div className="text-[10px] tracking-[0.3em] uppercase text-[#7a5a20] text-center">
                Periodestempler
              </div>
              <div className="text-[8px] tracking-[0.22em] uppercase text-[#3a2410]/45 text-center">
                {group.length} stempelminner · {yearRange}
              </div>
              <div
                className="relative flex-1 grid grid-cols-3 grid-rows-4 gap-x-0.5 gap-y-0 justify-items-center items-center px-0.5"
                aria-label="Periodestempler"
              >
                {group.map((entry, i) => {
                  const prevSame = i > 0 && group[i - 1].year === entry.year;
                  const nextSame = i < group.length - 1 && group[i + 1].year === entry.year;
                  const pull = (prevSame ? -3 : 0) + (nextSame ? 3 : 0);
                  return (
                    <PeriodStamp
                      key={entry.key}
                      entry={entry}
                      size={82}
                      offsetX={jitter(entry.key, 29, 4) + pull}
                      offsetY={jitter(entry.key, 41, 4) - (prevSame || nextSame ? 1 : 0)}
                      delayMs={i * 55}
                    />
                  );
                })}
              </div>
            </div>
          ),
          };
        })
      : [
          {
            key: 'stempler-tom',
            eyebrow: 'Periodestempler',
            variant: 'ivory' as const,
            content: (
              <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
                <div className="text-[10px] tracking-[0.3em] uppercase text-[#7a5a20]">
                  Periodestempler
                </div>
                <p className="text-[11px] italic text-[#3a2410]/60 leading-relaxed">
                  Ingen periodestempler registrert ennå.
                </p>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      hapticImpact('light');
                      setIndex(serviceIndex);
                    }}
                    className="px-4 py-2 rounded-full text-[11px] font-semibold tracking-[0.12em] uppercase border border-[#7a0a0e]/50 bg-[#f0cd78]/40 text-[#7a0a0e] active:scale-95 transition-transform"
                  >
                    Velg år og perioder
                  </button>
                )}
              </div>
            ),
          },
        ];

    // Fixed pages before stamps: cover, legitimasjon, opplysninger, godkjenninger, lederloftet
    const serviceIndex = 5 + stampPages.length;

    return [
      {
        key: 'cover',
        eyebrow: 'Forside',
        variant: 'cover' as const,
        content: (
          <div className="flex flex-col items-center justify-between h-full py-8 text-center">
            <div className="text-[10px] tracking-[0.35em] font-semibold" style={{ color: '#f0cd78' }}>
              LEDERPASS
            </div>
            <div className="flex flex-col items-center gap-4">
              <div
                className="relative w-24 h-24 rounded-full flex items-center justify-center"
                style={{
                  background: 'radial-gradient(circle at 30% 30%, #b7212a, #6a0a10 70%)',
                  boxShadow: 'inset 0 0 0 2px rgba(240,205,120,0.65), 0 4px 10px rgba(0,0,0,0.35)',
                }}
              >
                <img src={oksnoenLogo} alt="" className="w-14 h-14 object-contain" />
              </div>
              <div className="text-xl font-serif font-bold tracking-wide" style={{ color: '#f0cd78' }}>
                OKSNØEN
              </div>
              <div className="text-[10px] tracking-[0.3em]" style={{ color: '#f0cd78', opacity: 0.75 }}>
                LEIRSKOLE &amp; SOMMERLEIR
              </div>
            </div>
            <div className="text-[9px] tracking-[0.3em] font-semibold" style={{ color: '#f0cd78' }}>
              LEDER · ANNO 1962
            </div>
          </div>
        ),
      },
      {
        key: 'legitimasjon',
        eyebrow: 'Legitimasjon',
        variant: 'ivory' as const,
        content: (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-3 text-center">
            <div className="text-[10px] tracking-[0.3em] uppercase text-[#7a5a20]">Leder</div>
            <SealMark />
            {Photo}
            <LabeledField label="Navn" value={name} />
            <LabeledField label="Stilling" value={role} />
          </div>
        ),
      },
      {
        key: 'opplysninger',
        eyebrow: 'Lederopplysninger',
        variant: 'ivory' as const,
        content: (
          <div className="flex flex-col justify-center h-full gap-4 px-4">
            <LabeledField label="Fullt navn" value={name} />
            <LabeledField label="Alder" value={age} />
            <LabeledField label="Rolle" value={role} />
            <LabeledField label="Lag" value={team || '—'} />
            <LabeledField label="Telefon" value={leader?.phone || '—'} />
          </div>
        ),
      },
      {
        key: 'godkjenninger',
        eyebrow: 'Godkjenninger',
        variant: 'ivory' as const,
        content: (
          <div className="flex flex-col justify-center h-full gap-2 px-4">
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
      },
      {
        key: 'lederloftet',
        eyebrow: 'Lederløftet',
        variant: 'ivory' as const,
        content: (
          <div className="flex flex-col justify-center h-full gap-4 px-4 text-center">
            <div className="text-[10px] tracking-[0.3em] uppercase text-[#7a5a20]">Lederløftet</div>
            <p className="text-[12px] leading-relaxed text-[#3a2410] font-serif italic">
              «Jeg lover å ta vare på deltakerne, lederene og øya. Å gå foran med
              varme, oppmerksomhet og godt humør — og å bære Øksnøen-ånden videre.»
            </p>
            <div className="text-[10px] uppercase tracking-[0.25em] text-[#3a2410]/60">— {name}</div>
            <div
              className="relative w-24 h-24 mx-auto rounded-full border-[3px] flex items-center justify-center"
              style={{ borderColor: '#7a0a0e', color: '#7a0a0e', transform: 'rotate(-8deg)' }}
            >
              <div className="text-center">
                <ShieldCheck className="w-6 h-6 mx-auto" />
                <div className="text-[10px] tracking-[0.25em] font-bold mt-1">GODKJENT</div>
                <div className="text-[8px] italic mt-0.5">{periodLabel || 'Øksnøen'}</div>
              </div>
            </div>
          </div>
        ),
      },
      ...stampPages,
      {
        key: 'tjenestear',
        eyebrow: 'Tjenesteår',
        variant: 'ivory' as const,
        content: (
          <div className="flex flex-col h-full gap-2">
            <div className="flex-1 min-h-0 overflow-hidden">
              <ServiceHistoryEditor leaderId={leader?.id} readOnly={!canEdit} />
            </div>
            <div className="text-center text-[9px] italic text-[#3a2410]/55">
              {stamps.length} {stamps.length === 1 ? 'stempel' : 'stempler'}
            </div>
          </div>
        ),
      },
    ];
  }, [leader, name, initials, role, team, age, stamps, canEdit, periodLabel]);

  useEffect(() => {
    setIndex(i => Math.min(i, pages.length - 1));
  }, [pages.length]);

  const handleIndexChange = useCallback((next: number) => {
    setIndex(next);
    hapticImpact('light');
  }, []);

  // Measure available area and pick a portrait passport size (2:3).
  const areaRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ W: 300, H: 450 });
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const availW = Math.max(200, rect.width - 16);
      const availH = Math.max(240, rect.height - 16);
      const ratio = 2 / 3;
      let H = availH;
      let W = H * ratio;
      if (W > availW) {
        W = availW;
        H = W / ratio;
      }
      setBox({ W: Math.floor(W), H: Math.floor(H) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (inline) return;
    hapticImpact('medium');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
      else if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1));
      else if (e.key === 'ArrowRight') setIndex(i => Math.min(pages.length - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inline, onClose, pages.length]);

  const railPages = useMemo<RailPage[]>(
    () =>
      pages.map(p => ({
        key: p.key,
        content: (
          <div className="absolute inset-0 p-1">
            <div className="relative w-full h-full rounded-[8px] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.55)]">
              <PageSurface variant={(p as any).variant}>{p.content}</PageSurface>
            </div>
          </div>
        ),
      })),
    [pages],
  );

  const body = (
    <div
      className={cn(
        'flex flex-col',
        inline ? 'w-full h-full' : 'fixed inset-0 z-[100] bg-[#1b1008] backdrop-blur-sm',
      )}
    >
      {!inline && (
        <div
          className="shrink-0 flex items-center justify-end px-3"
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Lukk lederpass"
            className="h-9 w-9 rounded-full bg-black/30 text-[#f0cd78] flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div ref={areaRef} className="flex-1 min-h-0 flex items-center justify-center">
        <div style={{ width: box.W, height: box.H }}>
          <PassRail
            pages={railPages}
            index={index}
            onIndexChange={handleIndexChange}
            className="w-full h-full rounded-[10px]"
          />
        </div>
      </div>

      <div
        className="shrink-0 flex flex-col items-center gap-1.5 pt-2 px-3"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
      >
        <div
          className={cn(
            'text-[10px] uppercase tracking-[0.28em] font-semibold',
            inline ? 'text-[#7a5a20]' : 'text-[#f0cd78]',
          )}
        >
          {pages[index]?.eyebrow ?? ''}
        </div>
        <div
          role="tablist"
          aria-label="Sidevalg"
          className={cn(
            'flex items-center justify-center max-w-[80vw] overflow-hidden',
            pages.length > 10 ? 'gap-1' : 'gap-1.5',
          )}
        >
          {pages.map((p, i) => (
            <button
              key={p.key}
              role="tab"
              aria-selected={i === index}
              aria-label={`Gå til side ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                'h-1.5 rounded-full transition-all shrink-0',
                i === index
                  ? pages.length > 10
                    ? 'w-3 bg-[#7a0a0e]'
                    : 'w-5 bg-[#7a0a0e]'
                  : pages.length > 10
                    ? inline
                      ? 'w-1 bg-[#3a2410]/25'
                      : 'w-1 bg-[#f0cd78]/35'
                  : inline
                    ? 'w-1.5 bg-[#3a2410]/25'
                    : 'w-1.5 bg-[#f0cd78]/35',
              )}
            />
          ))}
        </div>
        <div className={cn('text-[10px]', inline ? 'text-[#3a2410]/55' : 'text-[#f0cd78]/60')}>
          Sveip for å bla
        </div>
      </div>
    </div>
  );

  return body;
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