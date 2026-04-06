import { useRef, useCallback, useState, useEffect } from 'react';
import { hapticImpact, hapticSuccess } from '@/lib/capacitorHaptics';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPull?: number;
}

interface UsePullToRefreshReturn {
  pullRef: React.RefObject<HTMLDivElement>;
  isPulling: boolean;
  pullProgress: number;
  isRefreshing: boolean;
}

function getScrollParent(el: HTMLElement): HTMLElement {
  return el.closest('main') as HTMLElement || el;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 120,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const pullRef = useRef<HTMLDivElement>(null);
  const [isPulling, setIsPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);
  const hasTriggeredHaptic = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const element = pullRef.current;
    if (!element || isRefreshing) return;
    
    const scrollParent = getScrollParent(element);
    if (scrollParent.scrollTop > 0) return;
    
    startY.current = e.touches[0].clientY;
    hasTriggeredHaptic.current = false;
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const element = pullRef.current;
    if (!element || isRefreshing) return;
    if (startY.current === 0) return;
    
    const scrollParent = getScrollParent(element);
    if (scrollParent.scrollTop > 0) {
      startY.current = 0;
      setIsPulling(false);
      setPullProgress(0);
      return;
    }

    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;

    if (diff > 0) {
      e.preventDefault();
      setIsPulling(true);
      
      const resistance = 0.5;
      const pull = Math.min(diff * resistance, maxPull);
      const progress = (pull / threshold) * 100;
      setPullProgress(Math.min(progress, 150));

      if (progress >= 100 && !hasTriggeredHaptic.current) {
        hasTriggeredHaptic.current = true;
        hapticImpact('medium');
      }
    }
  }, [isRefreshing, threshold, maxPull]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling || isRefreshing) return;

    if (pullProgress >= 100) {
      setIsRefreshing(true);
      setPullProgress(100);
      
      const timeout = setTimeout(() => setIsRefreshing(false), 8000);
      try {
        await onRefresh();
        hapticSuccess();
      } catch (error) {
        console.error('Pull-to-refresh failed:', error);
      } finally {
        clearTimeout(timeout);
        setIsRefreshing(false);
      }
    }

    setIsPulling(false);
    setPullProgress(0);
    startY.current = 0;
  }, [isPulling, isRefreshing, pullProgress, onRefresh]);

  useEffect(() => {
    const element = pullRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    pullRef,
    isPulling,
    pullProgress,
    isRefreshing,
  };
}
