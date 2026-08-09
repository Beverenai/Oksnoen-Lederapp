import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

const STORAGE_KEY = 'season-view-enabled';

interface SeasonViewValue {
  /** True when the app shows data from all periods at once (read-only). */
  seasonView: boolean;
  /** Only admins/superadmins may use the season view. */
  canUseSeasonView: boolean;
  /** Convenience: writes must be blocked while the season view is on. */
  readOnly: boolean;
  setSeasonView: (value: boolean) => void;
}

const SeasonViewContext = createContext<SeasonViewValue>({
  seasonView: false,
  canUseSeasonView: false,
  readOnly: false,
  setSeasonView: () => {},
});

export function SeasonViewProvider({ children }: { children: ReactNode }) {
  const { isAdmin, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const canUseSeasonView = !!(isAdmin || isSuperAdmin);

  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const setSeasonView = useCallback(
    (value: boolean) => {
      setEnabled(value);
      try {
        if (value) localStorage.setItem(STORAGE_KEY, '1');
        else localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore private-mode storage errors */
      }
      // Period scope changed — drop cached period-scoped data.
      queryClient.invalidateQueries();
    },
    [queryClient]
  );

  // Admin status resolves asynchronously — refresh queries once it flips the scope on.
  const seasonView = enabled && canUseSeasonView;
  useEffect(() => {
    if (seasonView) queryClient.invalidateQueries();
  }, [seasonView, queryClient]);

  const value = useMemo(
    () => ({ seasonView, canUseSeasonView, readOnly: seasonView, setSeasonView }),
    [seasonView, canUseSeasonView, setSeasonView]
  );

  return <SeasonViewContext.Provider value={value}>{children}</SeasonViewContext.Provider>;
}

export function useSeasonView() {
  return useContext(SeasonViewContext);
}
