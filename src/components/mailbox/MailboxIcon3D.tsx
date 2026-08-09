import { cn } from '@/lib/utils';

/**
 * Realistisk rød postkasse (norsk stil) tegnet i SVG med lys, skygge og glans.
 * Brukes som hurtigknapp-ikon på hjem.
 */
export function MailboxIcon3D({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      role="img"
      aria-label="Postkasse"
    >
      <defs>
        <linearGradient id="mbx-front" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8e0f12" />
          <stop offset="18%" stopColor="#d6272c" />
          <stop offset="45%" stopColor="#f0575a" />
          <stop offset="72%" stopColor="#cf1f25" />
          <stop offset="100%" stopColor="#7d0c10" />
        </linearGradient>
        <linearGradient id="mbx-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff8f8f" />
          <stop offset="60%" stopColor="#e0343a" />
          <stop offset="100%" stopColor="#a51419" />
        </linearGradient>
        <linearGradient id="mbx-post" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#4a4f57" />
          <stop offset="40%" stopColor="#8b929c" />
          <stop offset="100%" stopColor="#3a3e45" />
        </linearGradient>
        <linearGradient id="mbx-slot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1b0709" />
          <stop offset="100%" stopColor="#4a1216" />
        </linearGradient>
      </defs>

      {/* bakkeskygge */}
      <ellipse cx="24" cy="44.2" rx="12" ry="2.6" fill="#000" opacity="0.2" />

      {/* stolpe */}
      <rect x="21" y="30" width="6" height="13.6" rx="1.6" fill="url(#mbx-post)" />
      <rect x="24.9" y="30" width="1.6" height="13.6" rx="0.8" fill="#000" opacity="0.2" />

      {/* kropp med buet topp */}
      <path
        d="M9.5 18.5C9.5 11.9 15.9 6.6 24 6.6s14.5 5.3 14.5 11.9V29c0 1.7-1.3 3-3 3H12.5c-1.7 0-3-1.3-3-3z"
        fill="url(#mbx-front)"
      />
      {/* topphvelv-lys */}
      <path
        d="M9.5 18.5C9.5 11.9 15.9 6.6 24 6.6s14.5 5.3 14.5 11.9v2.2H9.5z"
        fill="url(#mbx-top)"
      />
      {/* dør-innramming */}
      <rect x="12.6" y="21.6" width="22.8" height="8.2" rx="2.2" fill="#000" opacity="0.12" />

      {/* postluke */}
      <rect x="15" y="14.6" width="18" height="4" rx="2" fill="url(#mbx-slot)" />
      <rect x="15" y="14.6" width="18" height="1.1" rx="0.55" fill="#fff" opacity="0.18" />

      {/* posthorn-plakett */}
      <circle cx="24" cy="25.6" r="3" fill="#f6e6a8" opacity="0.9" />
      <path
        d="M22.7 26.6c-.5-1.3.3-2.6 1.7-2.6.9 0 1.5.6 1.5 1.3 0 .8-.7 1.2-1.4 1.1"
        fill="none"
        stroke="#8a1418"
        strokeWidth="0.8"
        strokeLinecap="round"
      />

      {/* glans langs venstre kant */}
      <path
        d="M13.6 15.6c.6-4 3.6-6.9 7.4-7.7"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.6"
        opacity="0.35"
        strokeLinecap="round"
      />
      {/* svak refleks nederst */}
      <path d="M11.6 30.2h24.8" stroke="#ffffff" strokeWidth="0.8" opacity="0.16" />
    </svg>
  );
}
