import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { uniqueRealtimeChannelName } from '@/lib/realtimeChannel';

export const POV_BUCKET = 'pov-photos';

export type PovRoll = {
  id: string;
  title: string;
  status: 'open' | 'developed' | 'closed';
  shots_per_leader: number;
  reveal_at: string | null;
  developed_at: string | null;
  photo_count: number;
  my_shots_left: number;
};

export type PovPhoto = {
  id: string;
  roll_id: string;
  leader_id: string;
  storage_path: string;
  taken_at: string;
  hidden: boolean;
  photographer: string;
  signedUrl: string | null;
  reactions: number;
  reactedByMe: boolean;
};

/** Current (non-closed) roll for the signed in leader. */
export function usePovCurrentRoll() {
  return useQuery({
    queryKey: ['pov', 'current-roll'],
    queryFn: async (): Promise<PovRoll | null> => {
      const { data, error } = await supabase.rpc('pov_current_roll');
      if (error) throw error;
      const row = (data as PovRoll[] | null)?.[0];
      return row ?? null;
    },
    staleTime: 15_000,
  });
}

/** All rolls (admin/archive view). */
export function usePovRolls() {
  return useQuery({
    queryKey: ['pov', 'rolls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pov_rolls')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 15_000,
  });
}

/** Photos for a roll — only returns rows once the roll is developed (RLS). */
export function usePovPhotos(rollId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!rollId) return;
    const channel = supabase
      .channel(uniqueRealtimeChannelName(`pov-photos-${rollId}`))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pov_photos', filter: `roll_id=eq.${rollId}` },
        () => queryClient.invalidateQueries({ queryKey: ['pov', 'photos', rollId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [rollId, queryClient]);

  return useQuery({
    queryKey: ['pov', 'photos', rollId],
    enabled: !!rollId,
    staleTime: 30_000,
    queryFn: async (): Promise<PovPhoto[]> => {
      const [{ data: rows, error }, { data: me }] = await Promise.all([
        supabase
          .from('pov_photos')
          .select('id, roll_id, leader_id, storage_path, taken_at, hidden, leaders(name)')
          .eq('roll_id', rollId!)
          .order('taken_at', { ascending: true }),
        supabase.rpc('current_leader_id'),
      ]);
      if (error) throw error;
      const list = rows ?? [];
      if (list.length === 0) return [];

      const ids = list.map((r) => r.id);
      const { data: reactions } = await supabase
        .from('pov_photo_reactions')
        .select('photo_id, leader_id')
        .in('photo_id', ids);

      const signed = await Promise.all(
        list.map(async (r) => {
          const { data } = await supabase.storage
            .from(POV_BUCKET)
            .createSignedUrl(r.storage_path, 60 * 60 * 6);
          return data?.signedUrl ?? null;
        }),
      );

      const myId = (me as string | null) ?? null;
      return list.map((r, i) => {
        const mine = (reactions ?? []).filter((x) => x.photo_id === r.id);
        return {
          id: r.id,
          roll_id: r.roll_id,
          leader_id: r.leader_id,
          storage_path: r.storage_path,
          taken_at: r.taken_at,
          hidden: r.hidden,
          photographer: (r as any).leaders?.name ?? 'Ukjent',
          signedUrl: signed[i],
          reactions: mine.length,
          reactedByMe: !!myId && mine.some((x) => x.leader_id === myId),
        };
      });
    },
  });
}

/** Upload a captured blob and register the shot. */
export function usePovTakePhoto(rollId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (blob: Blob) => {
      if (!rollId) throw new Error('Ingen film');
      const { data: leaderId } = await supabase.rpc('current_leader_id');
      if (!leaderId) throw new Error('Ingen leder');
      const path = `${rollId}/${leaderId}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from(POV_BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (upErr) throw upErr;
      const { error } = await supabase.rpc('pov_take_photo', {
        _roll_id: rollId,
        _storage_path: path,
      });
      if (error) {
        await supabase.storage.from(POV_BUCKET).remove([path]).catch(() => {});
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pov', 'current-roll'] });
    },
  });
}

export function usePovToggleReaction(rollId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ photoId, on }: { photoId: string; on: boolean }) => {
      const { data: leaderId } = await supabase.rpc('current_leader_id');
      if (!leaderId) throw new Error('Ingen leder');
      if (on) {
        const { error } = await supabase
          .from('pov_photo_reactions')
          .insert({ photo_id: photoId, leader_id: leaderId as string });
        if (error && !error.message.includes('duplicate')) throw error;
      } else {
        const { error } = await supabase
          .from('pov_photo_reactions')
          .delete()
          .eq('photo_id', photoId)
          .eq('leader_id', leaderId as string);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pov', 'photos', rollId] });
    },
  });
}

// ---------- Admin ----------

export function usePovAdminActions() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['pov'] });
  };

  const createRoll = useMutation({
    mutationFn: async (input: { title: string; shots: number; revealAt: string | null }) => {
      const { data: leaderId } = await supabase.rpc('current_leader_id');
      const { error } = await supabase.from('pov_rolls').insert({
        title: input.title,
        shots_per_leader: input.shots,
        reveal_at: input.revealAt,
        created_by: (leaderId as string) ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const developRoll = useMutation({
    mutationFn: async (rollId: string) => {
      const { error } = await supabase.rpc('pov_develop_roll', { _roll_id: rollId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const setStatus = useMutation({
    mutationFn: async ({ rollId, status }: { rollId: string; status: 'open' | 'closed' }) => {
      const { error } = await supabase.from('pov_rolls').update({ status }).eq('id', rollId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const togglePhotoHidden = useMutation({
    mutationFn: async ({ photoId, hidden }: { photoId: string; hidden: boolean }) => {
      const { error } = await supabase.from('pov_photos').update({ hidden }).eq('id', photoId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deletePhoto = useMutation({
    mutationFn: async (photo: { id: string; storage_path: string }) => {
      const { error } = await supabase.from('pov_photos').delete().eq('id', photo.id);
      if (error) throw error;
      await supabase.storage.from(POV_BUCKET).remove([photo.storage_path]).catch(() => {});
    },
    onSuccess: invalidate,
  });

  return { createRoll, developRoll, setStatus, togglePhotoHidden, deletePhoto };
}
