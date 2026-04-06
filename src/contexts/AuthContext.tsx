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
  login: (phone: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshLeader: () => Promise<void>;
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
  const loginInProgressRef = useRef(false);

  const isProfileComplete = checkProfileComplete(leader);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await loadLeaderFromSession(session.user.id);
        } else {
          localStorage.removeItem('leaderId');
          localStorage.removeItem('leaderName');
        }
      } catch (error) {
        console.error('Error checking auth session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setLeader(null);
        setIsAdmin(false);
        setIsNurse(false);
        localStorage.removeItem('leaderName');
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Session refreshed, leader data is still valid
      } else if (event === 'SIGNED_IN' && session) {
        // Skip if login() is actively handling this — it already sets leader/roles
        if (loginInProgressRef.current) return;
        await loadLeaderFromSession(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadLeaderFromSession = async (authUserId: string) => {
    try {
      const { data: leaderData, error: leaderError } = await supabase
        .from('leaders')
        .select('*')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (leaderError || !leaderData) {
        console.error('Could not find leader for auth user:', authUserId, leaderError);
        // Do NOT sign out here — avoid destructive race condition
        return;
      }

      setLeader(leaderData);
      localStorage.setItem('leaderName', leaderData.name);

      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('leader_id', leaderData.id);

      const roles = rolesData?.map(r => r.role) || [];
      setIsAdmin(roles.includes('admin'));
      setIsNurse(roles.includes('nurse'));
    } catch (error) {
      console.error('Error loading leader from session:', error);
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
    }
  }, [leader?.id]);

  const login = async (phone: string): Promise<{ success: boolean; error?: string }> => {
    loginInProgressRef.current = true;
    try {
      const { data, error } = await supabase.functions.invoke('phone-login', {
        body: { phone }
      });

      if (error) {
        console.error('Login function error:', error);
        return { success: false, error: 'Noe gikk galt. Prøv igjen.' };
      }

      if (!data.success) {
        return { success: false, error: data.error || 'Innlogging feilet.' };
      }

      // Defensive check: ensure edge function returned session tokens
      if (!data.session?.access_token || !data.session?.refresh_token) {
        console.error('Edge function returned no session tokens');
        return { success: false, error: 'Innlogging feilet. Prøv igjen.' };
      }

      // Set the Supabase auth session with the tokens from the edge function
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      if (sessionError) {
        console.error('Session error:', sessionError);
        return { success: false, error: 'Kunne ikke opprette sesjon. Prøv igjen.' };
      }

      // Store leader data and roles
      localStorage.setItem('leaderName', data.leader.name);
      setLeader(data.leader);

      const roles = data.roles || [];
      setIsAdmin(roles.includes('admin'));
      setIsNurse(roles.includes('nurse'));
      
      return { success: true };
    } catch (err) {
      console.error('Login error:', err);
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
    <AuthContext.Provider value={{ leader, isAdmin, isNurse, isLoading, isProfileComplete, login, logout, refreshLeader }}>
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
