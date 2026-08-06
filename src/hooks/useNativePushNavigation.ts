import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { addNativePushListeners, isNativePushAvailable } from '@/lib/capacitorPush';

/**
 * Navigerer til url-en i varselets payload når brukeren trykker
 * på et push-varsel i native app (iOS/Android).
 */
export function useNativePushNavigation() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativePushAvailable()) return;

    addNativePushListeners(
      () => {},
      (action: any) => {
        const data = action?.notification?.data || {};
        const url: string | undefined = data.url || data?.aps?.url;
        if (url && typeof url === 'string' && url.startsWith('/')) {
          navigate(url);
        }
      }
    );
  }, [navigate]);
}
