import { cn } from '@/lib/utils';

/**
 * Liten isometrisk 3D-postkasse i SVG — brukes som hurtigknapp-ikon.
 */
export function MailboxIcon3D({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      className={cn('shrink-0 drop-shadow-sm', className)}
      role="img"
      aria-label="Postkasse"
    >
      <defs>
        <linearGradient id="mb-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5b7cc4" />
          <stop offset="100%" stopColor="#2c4478" />
        </linearGradient>
        <linearGradient id="mb-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8fabe0" />
          <stop offset="100%" stopColor="#4a6bb0" />
        </linearGradient>
        <linearGradient id="mb-flag" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ff6a5e" />
          <stop offset="100%" stopColor="#d92d20" />
        </linearGradient>
      </defs>

      {/* bakkeskygge */}
      <ellipse cx="20" cy="35.4" rx="11" ry="2.6" fill="#000" opacity="0.18" />
      {/* stolpe */}
      <rect x="18.2" y="24" width="3.6" height="10.5" rx="1.2" fill="#7a5a3c" />
      <rect x="20.4" y="24" width="1.4" height="10.5" rx="0.7" fill="#000" opacity="0.18" />
      {/* flagg */}
      <rect x="30.2" y="8" width="1.5" height="10" rx="0.7" fill="#9aa4b2" />
      <path d="M31.6 8.4h5.2l-1.8 2.4 1.8 2.4h-5.2z" fill="url(#mb-flag)" />
      {/* kropp */}
      <path d="M7 15.5c0-4 2.9-6.8 7-6.8h12.2c-4.1 0-7 2.8-7 6.8V25c0 .8-.6 1.4-1.4 1.4H8.4C7.6 26.4 7 25.8 7 25z" fill="url(#mb-body)" />
      {/* topp/hvelv */}
      <path d="M26.2 8.7c4.1 0 7 2.8 7 6.8V25c0 .8-.6 1.4-1.4 1.4h-13c.8 0 1.4-.6 1.4-1.4v-9.5c0-4-2.9-6.8-7-6.8z" fill="url(#mb-top)" />
      {/* luke */}
      <rect x="22" y="15.6" width="8.6" height="2.4" rx="1.2" fill="#16223a" opacity="0.75" />
      {/* konvolutt som stikker ut */}
      <path d="M11.6 11.6h8.2v5.4h-8.2z" fill="#fdfcf7" />
      <path d="M11.6 11.6l4.1 3 4.1-3" fill="none" stroke="#c4c9d2" strokeWidth="1" />
      {/* glans */}
      <path d="M9.2 13.6c.9-2 2.6-3.2 4.8-3.4" fill="none" stroke="#ffffff" strokeWidth="1.2" opacity="0.4" strokeLinecap="round" />
    </svg>
  );
}
