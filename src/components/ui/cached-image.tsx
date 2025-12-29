import { useState } from 'react';
import { cn } from '@/lib/utils';

interface CachedImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
  loading?: 'lazy' | 'eager';
}

export function CachedImage({ 
  src, 
  alt, 
  className, 
  fallback,
  loading = 'lazy' 
}: CachedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return <>{fallback}</> || null;
  }

  return (
    <div className="relative w-full h-full">
      {!isLoaded && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      <img
        src={src}
        alt={alt}
        className={cn(
          'transition-opacity duration-200',
          className,
          isLoaded ? 'opacity-100' : 'opacity-0'
        )}
        loading={loading}
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
      />
    </div>
  );
}
