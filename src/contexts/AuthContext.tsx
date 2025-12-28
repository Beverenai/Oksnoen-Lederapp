import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Leader = Tables<'leaders'>;
type AppRole = 'admin' | 'leader';

interface AuthContextType {
  leader: Leader | null;
  isAdmin: boolean;
  isLoading: boolean;
  login: (phone: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [leader, setLeader] = useState<Leader | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

      // Check if admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('leader_id', leaderId)
        .eq('role', 'admin')
        .maybeSingle();

      setIsAdmin(!!roleData);
    } catch (error) {
      console.error('Error loading leader:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (phone: string): Promise<{ success: boolean; error?: string }> => {
    const normalizedPhone = phone.replace(/\s/g, '');
    
    const { data, error } = await supabase
      .from('leaders')
      .select('*')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (error) {
      return { success: false, error: 'Noe gikk galt. Prøv igjen.' };
    }

    if (!data) {
      return { success: false, error: 'Fant ingen leder med dette telefonnummeret.' };
    }

    localStorage.setItem('leaderId', data.id);
    setLeader(data);

    // Check if admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('leader_id', data.id)
      .eq('role', 'admin')
      .maybeSingle();

    setIsAdmin(!!roleData);
    return { success: true };
  };

  const logout = () => {
    localStorage.removeItem('leaderId');
    setLeader(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ leader, isAdmin, isLoading, login, logout }}>
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
