import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import type { Session } from '@supabase/supabase-js';

type Leader = Tables<'leaders'>;
type AppRole = 'superadmin' | 'admin' | 'leader' | 'nurse' | 'kitchen' | 'leirskole';

interface AuthContextType {
  leader: Leader | null;
  viewAsLeader: Leader | null;
  effectiveLeader: Leader | null;
  setViewAsLeader: (leader: Leader | null) => void;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isNurse: boolean;
  isKitchen: boolean;
  /** Leirskole-leder — ser kun leirskole-delen av appen. */
  isLeirskole: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  isProfileComplete: boolean;
  authError: string | null;
  deactivatedMessage: string | null;
  /** Leader is not active this period — only off-season features available. */
  isLimitedAccess: boolean;
  login: (phone: string, pin?: string) => Promise<{ success: boolean; error?: string; message?: string; name?: string }>;
  logout: () => void;
  refreshLeader: () => Promise<void>;
  retryAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function checkProfileComplete(leader: Leader | null): boolean {
  if (!leader) return false;
  return !!(leader.profile_image_url && leader.age);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [leader, setLeader] = useState<Leader | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isNurse, setIsNurse] = useState(false);
  const [isKitchen, setIsKitchen] = useState(false);
  const [isLeirskole, setIsLeirskole] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLimitedAccess, setIsLimitedAccess] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [deactivatedMessage, setDeactivatedMessage] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [viewAsLeader, setViewAsLeader] = useState<Leader | null>(null);
  const loginInProgressRef = useRef(false);
  const resolveInProgressRef = useRef(false);
  const lastResolvedUserId = useRef<string | null>(null);

  const isProfileComplete = checkProfileComplete(leader);
  const effectiveLeader = viewAsLeader ?? leader;

  // Step 1: Set up auth listener — NO async work here, just sync state updates
  useEffect(() => {
    console.log('[Auth] Setting up auth listener');

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log('[Auth] onAuthStateChange:', event, 'hasSession:', !!newSession);

        if (event === 'SIGNED_OUT') {
          setSession(null);
          setLeader(null);
          setIsSuperAdmin(false);
          setIsAdmin(false);
          setIsNurse(false);
          setViewAsLeader(null);
          setDeactivatedMessage(null);
          lastResolvedUserId.current = null;
          localStorage.removeItem('leaderName');
          if (!isInitialized) {
            setIsLoading(false);
            setIsInitialized(true);
          }
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('[Auth] Token refreshed — session updated');
          setSession(newSession);
        } else {
          // INITIAL_SESSION, SIGNED_IN
          setSession(newSession);
        }
      }
    );

    // Kick off initial session restore
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      console.log('[Auth] getSession: hasSession=', !!initialSession);
      setSession(initialSession);
      if (!initialSession) {
        // No session — mark ready immediately
        setIsLoading(false);
        setIsInitialized(true);
        localStorage.removeItem('leaderName');
      }
    }).catch((err) => {
      console.error('[Auth] getSession error:', err);
      setAuthError('Kunne ikke koble til serveren. Prøv igjen.');
      setIsLoading(false);
      setIsInitialized(true);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Step 2: When session.user.id changes, resolve leader + roles in a separate effect
  useEffect(() => {
    const userId = session?.user?.id;

    if (!userId) {
      // No user — if we had a leader, clear it
      if (leader) {
        setLeader(null);
        setIsSuperAdmin(false);
        setIsAdmin(false);
        setIsNurse(false);
        setViewAsLeader(null);
        lastResolvedUserId.current = null;
      }
      return;
    }

    // Skip if already resolved for this user (avoid re-resolving on token refresh)
    if (lastResolvedUserId.current === userId && leader) {
      console.log('[Auth] Already resolved for user:', userId);
      return;
    }

    // Skip if login is manually handling resolution
    if (loginInProgressRef.current) {
      console.log('[Auth] Login in progress — skipping auto-resolve');
      return;
    }

    resolveLeaderAndRoles(userId);
  }, [session?.user?.id]);

  const resolveLeaderAndRoles = async (authUserId: string, retryCount = 0) => {
    if (resolveInProgressRef.current) return;
    resolveInProgressRef.current = true;

    console.log('[Auth] Resolving leader for auth user:', authUserId);

    const timeoutId = setTimeout(() => {
      console.warn('[Auth] Resolve timeout — forcing ready state');
      setAuthError('Innlasting tok for lang tid. Prøv å laste siden på nytt.');
      setIsLoading(false);
      setIsInitialized(true);
      resolveInProgressRef.current = false;
    }, 10000);

    try {
      // 1. Load leader
      const { data: leaderData, error: leaderError } = await supabase
        .from('leaders')
        .select('*')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (leaderError) {
        console.error('[Auth] Leader query error:', leaderError.message);
        if (retryCount < 2) {
          console.log('[Auth] Retrying leader resolve... attempt', retryCount + 1);
          clearTimeout(timeoutId);
          resolveInProgressRef.current = false;
          await new Promise(r => setTimeout(r, 1000));
          return resolveLeaderAndRoles(authUserId, retryCount + 1);
        }
        setAuthError('Kunne ikke laste profilen din. Prøv igjen.');
        return;
      }

      if (!leaderData) {
        console.warn('[Auth] No leader found for auth user:', authUserId);
        if (retryCount < 2) {
          console.log('[Auth] Retrying leader resolve... attempt', retryCount + 1);
          clearTimeout(timeoutId);
          resolveInProgressRef.current = false;
          await new Promise(r => setTimeout(r, 1000));
          return resolveLeaderAndRoles(authUserId, retryCount + 1);
        }
        console.warn('[Auth] Stale session — signing out');
        await supabase.auth.signOut();
        return;
      }

      console.log('[Auth] Leader found:', leaderData.name);

      // Slettede ledere mister tilgang (data beholdes i databasen)
      if ((leaderData as any).deleted_at) {
        console.warn('[Auth] Leader is deleted — signing out');
        setAuthError('Kontoen din er ikke aktiv i appen lenger.');
        await supabase.auth.signOut();
        return;
      }

      // 2. Load roles
      let roles: AppRole[] = [];
      try {
        const { data: roleData, error: roleError } = await supabase.rpc('get_my_roles');
        if (roleError) {
          console.warn('[Auth] get_my_roles RPC error:', roleError.message);
        } else {
          roles = (roleData as { role: AppRole }[])?.map(r => r.role) || [];
        }
      } catch (err) {
        console.warn('[Auth] get_my_roles exception:', err);
      }

      console.log('[Auth] Roles:', roles);

      const isSA = roles.includes('superadmin');
      const isAdm = isSA || roles.includes('admin');
      const isNrs = roles.includes('nurse');
      const isKtc = roles.includes('kitchen');
      const isLsk = roles.includes('leirskole');

      // 3. Inactive leaders keep access, but only to the off-season features.
      //    Gjelder også admin/superadmin — de skal se off-season-appen når de er inaktive.
      setIsLimitedAccess(leaderData.is_active === false);

      // 4. Apply state
      setDeactivatedMessage(null);
      setAuthError(null);
      setLeader(leaderData);
      setIsSuperAdmin(isSA);
      setIsAdmin(isAdm);
      setIsNurse(isNrs);
      setIsKitchen(isKtc);
      setIsLeirskole(isLsk);
      lastResolvedUserId.current = authUserId;
      localStorage.setItem('leaderName', leaderData.name);
      console.log('[Auth] ✓ Auth ready — leader:', leaderData.name, 'roles:', roles);
    } catch (error) {
      console.error('[Auth] resolveLeaderAndRoles error:', error);
      setAuthError('Kunne ikke koble til serveren. Prøv igjen.');
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
      setIsInitialized(true);
      resolveInProgressRef.current = false;
    }
  };

  const refreshLeader = useCallback(async () => {
    if (!leader?.id) return;

    const { data: leaderData, error } = await supabase
      .from('leaders')
      .select('*')
      .eq('id', leader.id)
      .maybeSingle();

    if (!error && leaderData) {
      setLeader(leaderData);
      setIsLimitedAccess(leaderData.is_active === false);
    }
  }, [leader?.id, isSuperAdmin]);

  const retryAuth = useCallback(() => {
    setIsLoading(true);
    setAuthError(null);
    setDeactivatedMessage(null);
    lastResolvedUserId.current = null;
    resolveInProgressRef.current = false;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (!s) {
        setIsLoading(false);
        setIsInitialized(true);
      }
    });
  }, []);

  const login = async (phone: string, pin?: string): Promise<{ success: boolean; error?: string; message?: string; name?: string }> => {
    loginInProgressRef.current = true;
    setDeactivatedMessage(null);
    setAuthError(null);
    try {
      const { data, error } = await supabase.functions.invoke('phone-login', {
        body: { phone, pin }
      });

      if (error) {
        console.error('[Auth] Login function error:', error);
        return { success: false, error: 'Noe gikk galt. Prøv igjen.' };
      }

      if (!data.success) {
        return { success: false, error: data.error || 'Innlogging feilet.', message: data.message, name: data.name };
      }

      if (!data.session?.access_token || !data.session?.refresh_token) {
        console.error('[Auth] Edge function returned no session tokens');
        return { success: false, error: 'Innlogging feilet. Prøv igjen.' };
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      if (sessionError) {
        console.error('[Auth] Session error:', sessionError);
        return { success: false, error: 'Kunne ikke opprette sesjon. Prøv igjen.' };
      }

      // Now resolve leader manually since we blocked the auto-resolve
      const { data: { session: newSession } } = await supabase.auth.getSession();
      if (!newSession) {
        return { success: false, error: 'Kunne ikke opprette sesjon. Prøv igjen.' };
      }

      // Resolve leader + roles directly
      await resolveLeaderAndRoles(newSession.user.id);

      if (!leader) {
        // Give a tiny bit more time for state to settle
        await new Promise(r => setTimeout(r, 300));
      }

      return { success: true };
    } catch (err) {
      console.error('[Auth] Login error:', err);
      return { success: false, error: 'Noe gikk galt. Prøv igjen.' };
    } finally {
      loginInProgressRef.current = false;
    }
  };

  const logout = async () => {
    setDeactivatedMessage(null);
    setViewAsLeader(null);
    await supabase.auth.signOut();
    localStorage.removeItem('leaderName');
    setLeader(null);
    setIsSuperAdmin(false);
    setIsAdmin(false);
    setIsNurse(false);
    setIsKitchen(false);
    setIsLeirskole(false);
    setIsLimitedAccess(false);
  };

  return (
    <AuthContext.Provider value={{
      leader, viewAsLeader, effectiveLeader, setViewAsLeader,
      isSuperAdmin, isAdmin, isNurse, isKitchen, isLeirskole,
      isLoading,
      isInitialized,
      isProfileComplete, authError, deactivatedMessage, isLimitedAccess,
      login, logout, refreshLeader, retryAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
