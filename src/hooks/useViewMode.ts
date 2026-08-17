import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppMode } from '@/hooks/useAppMode';

export type ViewMode = 'auto' | 'full' | 'offseason' | 'leirskole';
export type AccessMode = 'full' | 'offseason' | 'leirskole';

const STORAGE_KEY = 'oks_view_mode';
const EVENT = 'oks-view-mode-change';

function readStored(): ViewMode {
  const v = (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY)) || 'auto';
  return v === 'full' || v === 'offseason' || v === 'leirskole' ? v : 'auto';
}

/** Manuell overstyring av hvilken app-versjon som vises (kun admin/superadmin). */
export function useViewMode() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const canSwitch = isAdmin || isSuperAdmin;
  const [viewMode, setViewModeState] = useState<ViewMode>(readStored);

  useEffect(() => {
    const sync = () => setViewModeState(readStored());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setViewMode = useCallback((mode: ViewMode) => {
    if (mode === 'auto') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, mode);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { viewMode: canSwitch ? viewMode : ('auto' as ViewMode), setViewMode, canSwitch };
}

/**
 * Endelig tilgangsmodus: kombinerer automatikken (aktiv/inaktiv leder,
 * app_mode) med en eventuell manuell overstyring.
 */
export function useAccessMode() {
  const { isSuperAdmin, isLimitedAccess, isLeirskole } = useAuth();
  const { mode: appMode } = useAppMode();
  const { viewMode, setViewMode, canSwitch } = useViewMode();

  const autoLimited = isLimitedAccess || (appMode === 'inactive' && !isSuperAdmin);

  let limited = autoLimited;
  let leirskoleView = isLeirskole;
  let mode: AccessMode = isLeirskole && autoLimited ? 'leirskole' : autoLimited ? 'offseason' : 'full';

  if (canSwitch) {
    if (viewMode === 'full') {
      limited = false;
      leirskoleView = false;
      mode = 'full';
    } else if (viewMode === 'offseason') {
      limited = true;
      leirskoleView = false;
      mode = 'offseason';
    }
    else if (viewMode === 'leirskole') {
      limited = true;
      leirskoleView = true;
      mode = 'leirskole';
    }
  }

  return { limited, leirskoleView, mode, viewMode, setViewMode, canSwitch, autoLimited };
}
