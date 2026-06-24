import { useEffect, useState } from 'react';
import { getSignedImageUrl, extractStoragePath } from '@/hooks/useGjenglemt';
import { cn } from '@/lib/utils';

interface Props {
  imageUrl: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}

export function SignedImage({ imageUrl, alt, className, onClick }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const path = extractStoragePath(imageUrl);
    if (!path) { setErrored(true); return; }
    getSignedImageUrl(path).then(url => {
      if (cancelled) return;
      if (url) setSrc(url); else setErrored(true);
    }).catch(() => !cancelled && setErrored(true));
    return () => { cancelled = true; };
  }, [imageUrl]);

  if (errored) {
    return <div className={cn('flex items-center justify-center bg-muted text-muted-foreground text-xs', className)}>Bilde mangler</div>;
  }
  if (!src) {
    return <div className={cn('bg-muted animate-pulse', className)} />;
  }
  return <img src={src} alt={alt} loading="lazy" className={className} onClick={onClick} />;
}