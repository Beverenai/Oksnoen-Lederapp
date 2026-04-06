import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Leader = Tables<'leaders'>;
type AppRole = 'superadmin' | 'admin' | 'leader' | 'nurse';

interface AuthContextType {
  leader: Leader | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isNurse: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  isProfileComplete: boolean;
  authError: string | null;
  deactivatedMessage: string | null;
  login: (phone: string) => Promise<{ success: boolean; error?: string; message?: string }>;
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
  const [leader, setLeader] = useState<Leader | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isNurse, setIsNurse] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [deactivatedMessage, setDeactivatedMessage] = useState<string | null>(null);
  const loginInProgressRef = useRef(false);
  const initInProgressRef = useRef(false);
  const isInitializedRef = useRef(false);

  const isProfileComplete = checkProfileComplete(leader);

  const loadRolesViaRpc = async (): Promise<AppRole[]> => {
    try {
      const { data, error } = await supabase.rpc('get_my_roles');
      if (error) {
        console.warn('[Auth] get_my_roles RPC error:', error.message);
        return [];
      }
      return (data as { role: AppRole }[])?.map(r => r.role) || [];
    } catch (err) {
      console.warn('[Auth] get_my_roles exception:', err);
      return [];
    }
  };

  const applyRoles = (roles: AppRole[]) => {
    const sa = roles.includes('superadmin');
    setIsSuperAdmin(sa);
    setIsAdmin(sa || roles.includes('admin'));
    setIsNurse(roles.includes('nurse'));
    return sa;
  };

  const performLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('leaderName');
    setLeader(null);
    setIsSuperAdmin(false);
    setIsAdmin(false);
    setIsNurse(false);
  };

  const loadLeaderFromSession = async (authUserId: string): Promise<boolean> => {
    try {
      console.log('[Auth] loadLeaderFromSession:', authUserId);
      const { data: leaderData, error: leaderError } = await supabase
        .from('leaders')
        .select('*')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (leaderError) {
        console.error('[Auth] Leader query error:', leaderError.message);
        return false;
      }

      if (!leaderData) {
        console.warn('[Auth] No leader found for auth user:', authUserId);
        return false;
      }

      console.log('[Auth] Leader found:', leaderData.name);

      const roles = await loadRolesViaRpc();
      console.log('[Auth] Roles:', roles);
      const isSA = applyRoles(roles);

      // Session protection: if inactive and not superadmin, auto-logout
      if (leaderData.is_active === false && !isSA) {
        console.warn('[Auth] Inactive leader detected — signing out');
        setDeactivatedMessage('Kontoen din ble deaktivert. Kontakt leirledelsen.');
        await performLogout();
        return false;
      }

      setDeactivatedMessage(null);
      setLeader(leaderData);
      localStorage.setItem('leaderName', leaderData.name);
      return true;
    } catch (error) {
      console.error('[Auth] loadLeaderFromSession exception:', error);
      return false;
    }
  };

  const initAuth = useCallback(async () => {
    if (initInProgressRef.current) return;
    initInProgressRef.current = true;
    console.log('[Auth] initAuth started');
    setAuthError(null);

    const timeoutId = setTimeout(() => {
      console.warn('[Auth] initAuth timeout — forcing isLoading=false');
      setIsLoading(false);
      isInitializedRef.current = true;
      setAuthError('Innlasting tok for lang tid. Prøv å laste siden på nytt.');
    }, 10000);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[Auth] getSession: hasSession=', !!session);

      if (session) {
        const found = await loadLeaderFromSession(session.user.id);
        if (!found && !deactivatedMessage) {
          console.warn('[Auth] Stale session — signing out');
          await supabase.auth.signOut();
          localStorage.removeItem('leaderName');
        }
      } else {
        localStorage.removeItem('leaderName');
      }
    } catch (error) {
      console.error('[Auth] initAuth error:', error);
      setAuthError('Kunne ikke koble til serveren. Prøv igjen.');
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
      isInitializedRef.current = true;
      initInProgressRef.current = false;
      console.log('[Auth] initAuth complete');
    }
  }, []);

  useEffect(() => {
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] onAuthStateChange:', event);
      if (event === 'SIGNED_OUT') {
        setLeader(null);
        setIsSuperAdmin(false);
        setIsAdmin(false);
        setIsNurse(false);
        localStorage.removeItem('leaderName');
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Session refreshed, leader data is still valid
      } else if (event === 'SIGNED_IN' && session) {
        if (loginInProgressRef.current || initInProgressRef.current) return;
        await loadLeaderFromSession(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [initAuth]);

  const refreshLeader = useCallback(async () => {
    if (!leader?.id) return;
    
    const { data: leaderData, error } = await supabase
      .from('leaders')
      .select('*')
      .eq('id', leader.id)
      .maybeSingle();

    if (!error && leaderData) {
      setLeader(leaderData);
    }
  }, [leader?.id]);

  const retryAuth = useCallback(() => {
    setIsLoading(true);
    setAuthError(null);
    setDeactivatedMessage(null);
    initAuth();
  }, [initAuth]);

  const login = async (phone: string): Promise<{ success: boolean; error?: string; message?: string }> => {
    loginInProgressRef.current = true;
    setDeactivatedMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke('phone-login', {
        body: { phone }
      });

      if (error) {
        console.error('[Auth] Login function error:', error);
        return { success: false, error: 'Noe gikk galt. Prøv igjen.' };
      }

      if (!data.success) {
        return { success: false, error: data.error || 'Innlogging feilet.', message: data.message };
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

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const found = await loadLeaderFromSession(session.user.id);
        if (!found) {
          await new Promise(r => setTimeout(r, 500));
          const retryFound = await loadLeaderFromSession(session.user.id);
          if (!retryFound) {
            console.error('[Auth] Could not load leader after login');
            return { success: false, error: 'Kunne ikke laste profilen din. Prøv igjen.' };
          }
        }
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
    await performLogout();
  };

  return (
    <AuthContext.Provider value={{
      leader, isSuperAdmin, isAdmin, isNurse,
      isLoading,
      isInitialized: isInitializedRef.current,
      isProfileComplete, authError, deactivatedMessage,
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
