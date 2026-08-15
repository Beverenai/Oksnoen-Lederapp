import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { DrinkType } from '@/lib/drinkSounds';
import { drinkOf } from '@/lib/drinkSounds';

export type SipRow = {
  id: string;
  amount: number;
  message: string | null;
  drink_type: DrinkType;
  created_at: string;
  opened_at: string | null;
  drunk_at: string | null;
  from_leader_id: string;
  to_leader_id: string;
  fromName: string;
  toName: string;
  fromImage: string | null;
  toImage: string | null;
};

export type SipLeader = {
  id: string;
  name: string;
  profile_image_url: string | null;
  is_active: boolean | null;
};

/** Hvor mange av de 10 slurkene du har igjen å gi. */
export function useSipsLeft() {
  const { leader } = useAuth();
  return useQuery({
    queryKey: ['sips-left', leader?.id],
    enabled: !!leader?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_sips_left');
      if (error) throw error;
      return Number(data) || 0;
    },
    staleTime: 10_000,
  });
}

/** Ledere du kan gi slurker til. */
export function useSipLeaders() {
  const { leader } = useAuth();
  return useQuery<SipLeader[]>({
    queryKey: ['sip-leaders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leaders')
        .select('id, name, profile_image_url, is_active, is_external')
        .order('name');
      if (error) throw error;
      return (data ?? [])
        .filter((l) => !l.is_external && l.id !== leader?.id)
        .map((l) => ({
          id: l.id,
          name: l.name,
          profile_image_url: l.profile_image_url,
          is_active: l.is_active,
        }));
    },
    staleTime: 60_000,
  });
}

/** Alle slurker som involverer meg (RLS filtrerer). */
export function useMySips() {
  const { leader } = useAuth();
  const myId = leader?.id;

  return useQuery<{ received: SipRow[]; given: SipRow[] }>({
    queryKey: ['my-sips', myId],
    enabled: !!myId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leader_sips')
        .select('id, amount, message, drink_type, created_at, opened_at, drunk_at, from_leader_id, to_leader_id')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const ids = Array.from(new Set(rows.flatMap((r) => [r.from_leader_id, r.to_leader_id])));
      const names = new Map<string, { name: string; image: string | null }>();
      if (ids.length) {
        const { data: leaders } = await supabase
          .from('leaders')
          .select('id, name, profile_image_url')
          .in('id', ids);
        (leaders ?? []).forEach((l) =>
          names.set(l.id, { name: l.name, image: l.profile_image_url ?? null }),
        );
      }
      const mapped: SipRow[] = rows.map((r) => ({
        ...r,
        drink_type: drinkOf((r as { drink_type?: string }).drink_type),
        fromName: names.get(r.from_leader_id)?.name ?? 'Ukjent',
        toName: names.get(r.to_leader_id)?.name ?? 'Ukjent',
        fromImage: names.get(r.from_leader_id)?.image ?? null,
        toImage: names.get(r.to_leader_id)?.image ?? null,
      }));
      return {
        received: mapped.filter((r) => r.to_leader_id === myId),
        given: mapped.filter((r) => r.from_leader_id === myId),
      };
    },
    staleTime: 5_000,
  });
}

/** Antall uåpnede slurker – brukes som badge på flisene. */
export function useUnopenedSipCount() {
  const { data } = useMySips();
  return (data?.received ?? []).filter((r) => !r.opened_at).length;
}

export function useGiveSips() {
  const queryClient = useQueryClient();
  const { leader } = useAuth();

  return useMutation({
    mutationFn: async ({
      targetId,
      amount,
      message,
    }: {
      targetId: string;
      amount: number;
      message?: string;
    }) => {
      const { data, error } = await supabase.rpc('give_sips', {
        _to: targetId,
        _amount: amount,
        _message: message ?? null,
      });
      if (error) throw error;
      const sipId = data as unknown as string;
      // Varsling til mottakeren – aldri kritisk om den feiler.
      supabase.functions.invoke('push-sips', { body: { sip_id: sipId } }).catch(() => {});
      return sipId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sips-left', leader?.id] });
      queryClient.invalidateQueries({ queryKey: ['my-sips', leader?.id] });
    },
  });
}

export function useOpenSip() {
  const queryClient = useQueryClient();
  const { leader } = useAuth();

  return useMutation({
    mutationFn: async (sipId: string) => {
      const { error } = await supabase
        .from('leader_sips')
        .update({ opened_at: new Date().toISOString() })
        .eq('id', sipId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-sips', leader?.id] });
    },
  });
}

/** Bekreft at du har drukket slurkene du har fått. */
export function useDrinkSips() {
  const queryClient = useQueryClient();
  const { leader } = useAuth();

  return useMutation({
    mutationFn: async (sipIds: string[]) => {
      if (!sipIds.length) return;
      const { error } = await supabase
        .from('leader_sips')
        .update({ drunk_at: new Date().toISOString() })
        .in('id', sipIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-sips', leader?.id] });
    },
  });
}

/** Min valgte drikke – alt jeg gir vises og høres som denne. */
export function useMyDrink() {
  const { leader } = useAuth();
  const queryClient = useQueryClient();
  const myId = leader?.id;

  const query = useQuery<{ drink: DrinkType; isSet: boolean }>({
    queryKey: ['my-drink', myId],
    enabled: !!myId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_drink');
      if (error) throw error;
      const raw = (data as string | null) ?? null;
      return { drink: drinkOf(raw), isSet: !!raw };
    },
    staleTime: 60_000,
  });

  const setDrink = useMutation({
    mutationFn: async (drink: DrinkType) => {
      const { data, error } = await supabase.rpc('set_my_drink', { _drink: drink });
      if (error) throw error;
      return drinkOf(data as string | null);
    },
    onMutate: (drink) => {
      // Vis valget umiddelbart
      const prev = queryClient.getQueryData(['my-drink', myId]);
      queryClient.setQueryData(['my-drink', myId], { drink, isSet: true });
      return { prev };
    },
    onError: (_err, _drink, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['my-drink', myId], ctx.prev);
    },
    onSuccess: (drink) => {
      queryClient.setQueryData(['my-drink', myId], { drink, isSet: true });
    },
  });

  return {
    drink: query.data?.drink ?? 'beer',
    /** false første gang – da spør vi lederen om hva de drikker */
    isSet: query.data?.isSet ?? false,
    isLoading: query.isLoading,
    setDrink,
  };
}
