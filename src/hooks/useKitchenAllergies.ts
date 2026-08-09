import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { countByCategory, detectAllergies, type NoteRow } from '@/lib/allergyDetect';

export function useKitchenAllergies() {
  return useQuery({
    queryKey: ['kitchen-allergies'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_kitchen_allergy_notes');
      if (error) throw error;
      const hits = detectAllergies((data || []) as NoteRow[]);
      return { hits, counts: countByCategory(hits) };
    },
  });
}
