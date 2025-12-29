import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
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

  const isProfileComplete = checkProfileComplete(leader);

  useEffect(() => {
    const storedLeaderId = localStorage.getItem('leaderId');
    if (storedLeaderId) {
      loadLeader(storedLeaderId);
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadLeader = async (leaderId: string) => {
    try {
      const { data: leaderData, error } = await supabase
        .from('leaders')
        .select('*')
        .eq('id', leaderId)
        .maybeSingle();

      if (error || !leaderData) {
        localStorage.removeItem('leaderId');
        setIsLoading(false);
        return;
      }

      setLeader(leaderData);

      // Check roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('leader_id', leaderId);

      const roles = rolesData?.map(r => r.role) || [];
      setIsAdmin(roles.includes('admin'));
      setIsNurse(roles.includes('nurse'));
    } catch (error) {
      console.error('Error loading leader:', error);
    } finally {
      setIsLoading(false);
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
    try {
      // Use edge function for login - hides phone lookup from client
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

      // Store leader ID and set state
      localStorage.setItem('leaderId', data.leader.id);
      setLeader(data.leader);

      // Set roles from edge function response
      const roles = data.roles || [];
      setIsAdmin(roles.includes('admin'));
      setIsNurse(roles.includes('nurse'));
      
      return { success: true };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: 'Noe gikk galt. Prøv igjen.' };
    }
  };

  const logout = () => {
    localStorage.removeItem('leaderId');
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
