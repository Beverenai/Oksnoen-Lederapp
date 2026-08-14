import type { LucideIcon } from 'lucide-react';
import type { SVGProps } from 'react';

/** Tinder-flammen som ikon-komponent (samme API som lucide-ikonene). */
function TinderFlame({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M13.2 1.3c.2-.3.7-.4.9-.1a13 13 0 0 1 3.6 4.4c.4-.5.7-1.1.9-1.7.2-.4.7-.5 1-.2 3 2.9 4.6 6.4 4.6 9.8 0 5.6-4.7 10.2-11 10.2S2.8 19.1 2.8 13.5c0-4.9 3-8.4 6-10.4a12 12 0 0 0 .5 4.5c.3-2.5 1.6-4.7 3.9-6.3Zm-1.3 20.2c3.5 0 6.3-2.6 6.3-5.9 0-3-2-5-4-6.9-.2-.2-.6-.1-.6.2-.1 1.2-.5 2.3-1.2 3.2-.7-1.4-1.7-2.6-2.9-3.6-.2-.2-.6 0-.6.3 0 1.6-.5 3-1.4 4.3-.7 1-1.2 2-1.2 3.2 0 3 2.5 5.2 5.6 5.2Z" />
    </svg>
  );
}

export const TinderIcon = TinderFlame as unknown as LucideIcon;
