import { getStampArtwork } from './stampRegistry';

export interface StampEntry {
  /** Stable key, e.g. "2019-4+" */
  key: string;
  year: number;
  periodCode: string;
}

const STAMP_INKS: { ink: string; shadow: string }[] = [
  { ink: '#7a0a0e', shadow: 'rgba(122,10,14,0.30)' },
  { ink: '#1b3a5b', shadow: 'rgba(27,58,91,0.30)' },
  { ink: '#2f5d3a', shadow: 'rgba(47,93,58,0.30)' },
  { ink: '#6a3410', shadow: 'rgba(106,52,16,0.30)' },
  { ink: '#5a2a6a', shadow: 'rgba(90,42,106,0.30)' },
  { ink: '#1f5f66', shadow: 'rgba(31,95,102,0.30)' },
  { ink: '#8a5a10', shadow: 'rgba(138,90,16,0.30)' },
];

function hash(seed: string, salt: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * salt + seed.charCodeAt(i)) >>> 0;
  return h;
}

export function PeriodStamp({ entry, size = 72 }: { entry: StampEntry; size?: number }) {
  const artwork = getStampArtwork(entry.year, entry.periodCode);
  const ink = STAMP_INKS[hash(entry.key, 31) % STAMP_INKS.length];
  const tilt = (hash(entry.key, 17) % 15) - 7;
  const label = entry.periodCode;

  const topPathId = `stamp-top-${entry.key.replace(/[^a-zA-Z0-9]/g, '')}`;
  const bottomPathId = `stamp-bot-${entry.key.replace(/[^a-zA-Z0-9]/g, '')}`;

  if (artwork) {
    return (
      <img
        src={artwork}
        alt={`Stempel periode ${label} ${entry.year}`}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        className="object-contain select-none"
        style={{ width: size, height: size, transform: `rotate(${tilt}deg)` }}
      />
    );
  }

  return (
    <div
      className="relative flex items-center justify-center select-none"
      style={{
        width: size,
        height: size,
        transform: `rotate(${tilt}deg)`,
        filter: `drop-shadow(0 1px 0 ${ink.shadow})`,
      }}
      aria-label={`Stempel periode ${label} ${entry.year}`}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ color: ink.ink, opacity: 0.92 }}>
        <defs>
          <path id={topPathId} d="M 8 50 A 42 42 0 0 1 92 50" fill="none" />
          <path id={bottomPathId} d="M 92 50 A 42 42 0 0 1 8 50" fill="none" />
        </defs>

        <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <circle cx="50" cy="50" r="39" fill="none" stroke="currentColor" strokeWidth="0.9" />

        <text
          fill="currentColor"
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontWeight: 700,
            fontSize: 8,
            letterSpacing: 2.6,
          }}
        >
          <textPath href={`#${topPathId}`} startOffset="50%" textAnchor="middle">
            ØKSNØEN
          </textPath>
        </text>

        <text
          fill="currentColor"
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontWeight: 700,
            fontSize: 8,
            letterSpacing: 3,
          }}
        >
          <textPath href={`#${bottomPathId}`} startOffset="50%" textAnchor="middle">
            {`ANNO ${entry.year}`}
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

export function StampSeal({ label = 'OKSNØEN' }: { label?: string }) {
  return (
    <div
      className="relative w-24 h-24 rounded-full flex items-center justify-center shrink-0"
      style={{
        background: 'radial-gradient(circle at 30% 30%, #a01a1e, #6a0a10 70%)',
        boxShadow: 'inset 0 0 0 2px rgba(240,205,120,0.65), 0 2px 6px rgba(0,0,0,0.25)',
      }}
    >
      <img src={oksnoenLogo} alt="Oksnøen" className="w-14 h-14 object-contain" loading="lazy" decoding="async" />
      <span className="absolute -bottom-2 text-[9px] tracking-[0.25em] text-[#6a0a10] font-semibold bg-[#f0cd78] rounded-full px-2 py-0.5">
        {label}
      </span>
    </div>
  );
}

export default PeriodStamp;