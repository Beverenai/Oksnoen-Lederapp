import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface GjenglemtPeriod {
  id: string;
  name: string;
  slug: string;
  start_date: string | null;
  end_date: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface GjenglemtItem {
  id: string;
  period_id: string;
  image_url: string;
  garment_type: string | null;
  color: string | null;
  owner_name: string | null;
  comment: string | null;
  notes: string | null;
  status: 'uavhentet' | 'hentet';
  created_by: string | null;
  ai_status: 'pending' | 'done' | 'failed';
  ai_description: string | null;
  ai_tags: string[];
  created_at: string;
  updated_at: string;
}

export interface GjenglemtPublicItem {
  id: string;
  period_id: string;
  image_url: string;
  garment_type: string | null;
  color: string | null;
  status: string;
  notes: string | null;
  ai_status: string;
  ai_description: string | null;
  ai_tags: string[];
  created_at: string;
}

// ---------- ADMIN/LEADER HOOKS ----------

export function useGjenglemtPeriods() {
  return useQuery({
    queryKey: ['gjenglemt-periods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gjenglemt_periods')
        .select('*')
        .order('start_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as GjenglemtPeriod[];
    },
    staleTime: 60_000,
  });
}

export function useGjenglemtItems(periodId: string | null) {
  return useQuery({
    queryKey: ['gjenglemt-items', periodId],
    queryFn: async () => {
      if (!periodId) return [];
      const { data, error } = await supabase
        .from('gjenglemt_items')
        .select('*')
        .eq('period_id', periodId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as GjenglemtItem[];
    },
    enabled: !!periodId,
    staleTime: 30_000,
  });
}

export function useCreatePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; slug: string; start_date?: string | null; end_date?: string | null; is_public?: boolean }) => {
      const { data, error } = await supabase
        .from('gjenglemt_periods')
        .insert({
          name: input.name,
          slug: input.slug,
          start_date: input.start_date ?? null,
          end_date: input.end_date ?? null,
          is_public: input.is_public ?? true,
        })
        .select()
        .single();
      if (error) throw error;
      return data as GjenglemtPeriod;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gjenglemt-periods'] }),
  });
}

export function useUpdatePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<GjenglemtPeriod> & { id: string }) => {
      const { error } = await supabase.from('gjenglemt_periods').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gjenglemt-periods'] }),
  });
}

export function useDeletePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('gjenglemt_periods').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gjenglemt-periods'] });
      qc.invalidateQueries({ queryKey: ['gjenglemt-items'] });
    },
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  const { effectiveLeader } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      period_id: string;
      image_url: string;
      notes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('gjenglemt_items')
        .insert({
          period_id: input.period_id,
          image_url: input.image_url,
          notes: input.notes ?? null,
          created_by: effectiveLeader?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      // Fire-and-forget AI analysis
      supabase.functions.invoke('analyze-gjenglemt', {
        body: { item_id: (data as any).id },
      }).then(() => qc.invalidateQueries({ queryKey: ['gjenglemt-items', input.period_id] }))
        .catch((e) => console.warn('analyze-gjenglemt failed', e));
      return data as GjenglemtItem;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['gjenglemt-items', vars.period_id] }),
  });
}

export function useReanalyzeItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      // Optimistically mark pending
      await supabase.from('gjenglemt_items').update({ ai_status: 'pending' }).eq('id', itemId);
      const { error } = await supabase.functions.invoke('analyze-gjenglemt', { body: { item_id: itemId } });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['gjenglemt-items'] }),
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<GjenglemtItem> & { id: string }) => {
      const { error } = await supabase.from('gjenglemt_items').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gjenglemt-items'] }),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: GjenglemtItem) => {
      const { error } = await supabase.from('gjenglemt_items').delete().eq('id', item.id);
      if (error) throw error;
      // Best-effort image cleanup
      const path = extractStoragePath(item.image_url);
      if (path) {
        await supabase.storage.from('gjenglemt-images').remove([path]).catch(() => {});
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gjenglemt-items'] }),
  });
}

export function useGjenglemtRealtime(periodId: string | null) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!periodId) return;
    const channel = supabase
      .channel(`gjenglemt-items-${periodId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gjenglemt_items', filter: `period_id=eq.${periodId}` }, () => {
        qc.invalidateQueries({ queryKey: ['gjenglemt-items', periodId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [periodId, qc]);
}

// ---------- PUBLIC HOOKS ----------

export function usePublicPeriod(slug: string | undefined) {
  return useQuery({
    queryKey: ['gjenglemt-public-period', slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from('gjenglemt_periods')
        .select('id,name,slug,start_date,end_date,is_public')
        .eq('slug', slug)
        .eq('is_public', true)
        .maybeSingle();
      if (error) throw error;
      return data as Pick<GjenglemtPeriod, 'id' | 'name' | 'slug' | 'start_date' | 'end_date' | 'is_public'> | null;
    },
    enabled: !!slug,
    staleTime: 60_000,
  });
}

export function usePublicItems(periodId: string | undefined) {
  return useQuery({
    queryKey: ['gjenglemt-public-items', periodId],
    queryFn: async () => {
      if (!periodId) return [];
      const { data, error } = await supabase
        .from('gjenglemt_public')
        .select('*')
        .eq('period_id', periodId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as GjenglemtPublicItem[];
    },
    enabled: !!periodId,
    staleTime: 30_000,
  });
}

// ---------- IMAGE HELPERS ----------

const BUCKET = 'gjenglemt-images';

export function extractStoragePath(imageUrl: string): string | null {
  if (!imageUrl) return null;
  // Stored format is the storage path directly (no scheme).
  if (!imageUrl.includes('://')) return imageUrl;
  // Fallback: try to extract path from a signed URL.
  const m = imageUrl.match(/\/object\/(?:sign|public|authenticated)\/[^/]+\/(.+?)(?:\?|$)/);
  return m ? m[1] : null;
}

export async function getSignedImageUrl(path: string, expiresIn = 60 * 60 * 24 * 7): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

export async function uploadGjenglemtImage(periodSlug: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${periodSlug}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  return path; // store path; sign on read
}