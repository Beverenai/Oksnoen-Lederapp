import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Leader = Tables<'leaders'>;
type AppRole = 'admin' | 'leader' | 'nurse';

interface AuthContextType {
  leader: Leader | null;
  isAdmin: boolean;
  isNurse: boolean;
  isLoading: boolean;
  isProfileComplete: boolean;
  authError: string | null;
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [isNurse, setIsNurse] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const loginInProgressRef = useRef(false);
  const initInProgressRef = useRef(false);

  const isProfileComplete = checkProfileComplete(leader);

  const loadRolesViaRpc = async () => {
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
      setLeader(leaderData);
      localStorage.setItem('leaderName', leaderData.name);

      const roles = await loadRolesViaRpc();
      console.log('[Auth] Roles:', roles);
      setIsAdmin(roles.includes('admin'));
      setIsNurse(roles.includes('nurse'));
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
      setAuthError('Innlasting tok for lang tid. Prøv å laste siden på nytt.');
    }, 10000);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[Auth] getSession: hasSession=', !!session);

      if (session) {
        const found = await loadLeaderFromSession(session.user.id);
        if (!found) {
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
        setIsAdmin(false);
        setIsNurse(false);
        localStorage.removeItem('leaderName');
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Session refreshed, leader data is still valid
      } else if (event === 'SIGNED_IN' && session) {
        // Skip if login or init is already handling this
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
    initAuth();
  }, [initAuth]);

  const login = async (phone: string): Promise<{ success: boolean; error?: string; message?: string }> => {
    loginInProgressRef.current = true;
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

      // Load full leader + roles from DB now that session is active
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const found = await loadLeaderFromSession(session.user.id);
        if (!found) {
          // Retry once after a short delay (session propagation race)
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
    await supabase.auth.signOut();
    localStorage.removeItem('leaderName');
    setLeader(null);
    setIsAdmin(false);
    setIsNurse(false);
  };

  return (
    <AuthContext.Provider value={{ leader, isAdmin, isNurse, isLoading, isProfileComplete, authError, login, logout, refreshLeader, retryAuth }}>
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
