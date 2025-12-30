import { useState, useEffect } from 'react';
import { isCapacitor } from '@/lib/capacitor';
import oksnoenLogo from '@/assets/oksnoen-logo.png';

export function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Only show on native platforms
    if (!isCapacitor()) {
      setIsVisible(false);
      return;
    }

    // Start fade out after animation completes
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 1400);

    // Remove component after fade out
    const removeTimer = setTimeout(() => {
      setIsVisible(false);
    }, 1900);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-green-600 ${
        isFadingOut ? 'animate-splash-fade-out' : ''
      }`}
    >
      <img
        src={oksnoenLogo}
        alt="Oksnøen"
        className="w-40 h-40 object-contain animate-splash-pop"
      />
    </div>
  );
}
