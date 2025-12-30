import { useState, useEffect } from 'react';
import { isCapacitor } from '@/lib/capacitor';
import oksnoenLogo from '@/assets/oksnoen-logo.png';

export function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    // Only show on native platforms
    if (!isCapacitor()) {
      setIsVisible(false);
      return;
    }

    // Get user's name from localStorage (cached during login/load)
    const storedName = localStorage.getItem('leaderName');
    if (storedName) {
      setFirstName(storedName.split(' ')[0]);
    }

    // Start fade out after animation completes
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 1600);

    // Remove component after fade out
    const removeTimer = setTimeout(() => {
      setIsVisible(false);
    }, 2100);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-green-600 ${
        isFadingOut ? 'animate-splash-fade-out' : ''
      }`}
    >
      <img
        src={oksnoenLogo}
        alt="Oksnøen"
        className="w-40 h-40 object-contain animate-splash-pop"
      />
      {firstName && (
        <p className="mt-6 text-white/90 text-xl font-medium animate-splash-text">
          Velkommen, {firstName}!
        </p>
      )}
    </div>
  );
}
