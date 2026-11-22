import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isCapacitor } from '@/lib/capacitor';

/**
 * iPhone-appen: åpner riktig side når appen startes fra en widget eller lenke
 * (oksnoen://skann, https://app.oksnoen.com/…), og frisker opp data når appen kommer fram igjen.
 */
export function useNativeAppEvents() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isCapacitor()) return;
    let cancelled = false;
    const handles: { remove: () => Promise<void> }[] = [];

    const open = (raw: string) => {
      try {
        const url = new URL(raw);
        // oksnoen://skann  → /skann.  https://app.oksnoen.com/b/123 → /b/123
        const path = url.protocol === 'oksnoen:' ? `/${url.host}${url.pathname}` : url.pathname;
        const clean = path.replace(/\/+$/, '') || '/';
        if (clean.startsWith('/')) navigate(clean + url.search);
      } catch {
        // ukjent lenke: bli der vi er
      }
    };

    (async () => {
      try {
        const { App } = await import('@capacitor/app');
        const launch = await App.getLaunchUrl();
        if (!cancelled && launch?.url) open(launch.url);
        handles.push(await App.addListener('appUrlOpen', (e) => open(e.url)));
        handles.push(
          await App.addListener('resume', () => {
            // Samme signal som når en nettleserfane får fokus: lister og tallmerker hentes på nytt.
            window.dispatchEvent(new Event('focus'));
            document.dispatchEvent(new Event('visibilitychange'));
          }),
        );
      } catch (e) {
        console.log('[App] @capacitor/app ikke tilgjengelig', e);
      }
    })();

    return () => {
      cancelled = true;
      handles.forEach((h) => h.remove().catch(() => undefined));
    };
  }, [navigate]);
}
