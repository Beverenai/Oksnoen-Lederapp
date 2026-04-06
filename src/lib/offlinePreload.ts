/**
 * Offline preload utilities
 * Pre-fetches all participant images and data for offline use
 */

import { supabase } from '@/integrations/supabase/client';
import type { QueryClient } from '@tanstack/react-query';

export interface PreloadProgress {
  phase: 'data' | 'images';
  current: number;
  total: number;
  label: string;
}

type ProgressCallback = (progress: PreloadProgress) => void;

/**
 * Pre-fetch all data into React Query cache
 */
async function preloadData(queryClient: QueryClient, onProgress: ProgressCallback): Promise<string[]> {
  onProgress({ phase: 'data', current: 0, total: 5, label: 'Laster deltakere...' });

  const [participantsRes, activitiesRes, cabinsRes, leaderCabinsRes, activitiesMapRes] = await Promise.all([
    supabase.from('participants').select('*, cabins(*)').order('name'),
    supabase.from('activities').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('cabins').select('*').order('sort_order'),
    supabase.from('leader_cabins').select('cabin_id, leaders(id, name)'),
    supabase.from('participant_activities').select('participant_id, activity'),
  ]);

  // Cache participants
  const participants = participantsRes.data || [];
  queryClient.setQueryData(['participants-with-cabins'], participants);
  queryClient.setQueryData(['participants', 'all'], participants);
  onProgress({ phase: 'data', current: 1, total: 5, label: 'Laster aktiviteter...' });

  // Cache activities
  queryClient.setQueryData(['activities'], activitiesRes.data || []);
  onProgress({ phase: 'data', current: 2, total: 5, label: 'Laster hytter...' });

  // Cache cabins
  queryClient.setQueryData(['cabins'], cabinsRes.data || []);
  onProgress({ phase: 'data', current: 3, total: 5, label: 'Laster leder-hytter...' });

  // Cache leader cabins map
  const lcMap = new Map<string, { id: string; name: string }[]>();
  (leaderCabinsRes.data || []).forEach((lc: any) => {
    if (lc.cabin_id && lc.leaders) {
      const existing = lcMap.get(lc.cabin_id) || [];
      existing.push({ id: lc.leaders.id, name: lc.leaders.name });
      lcMap.set(lc.cabin_id, existing);
    }
  });
  queryClient.setQueryData(['leader-cabins-map'], lcMap);
  onProgress({ phase: 'data', current: 4, total: 5, label: 'Laster aktivitetskart...' });

  // Cache activities map
  const aMap = new Map<string, string[]>();
  (activitiesMapRes.data || []).forEach((a: any) => {
    const existing = aMap.get(a.participant_id) || [];
    existing.push(a.activity);
    aMap.set(a.participant_id, existing);
  });
  queryClient.setQueryData(['participant-activities-map'], aMap);
  onProgress({ phase: 'data', current: 5, total: 5, label: 'Data lastet!' });

  // Collect image URLs
  return participants
    .map((p: any) => p.image_url)
    .filter((url: string | null): url is string => !!url);
}

/**
 * Pre-cache images via Cache API directly (works even without SW)
 */
async function preloadImages(imageUrls: string[], onProgress: ProgressCallback): Promise<number> {
  if (imageUrls.length === 0) return 0;

  const CACHE_NAME = 'participant-images-cache';
  const cache = await caches.open(CACHE_NAME);
  let cached = 0;
  const BATCH_SIZE = 5;

  for (let i = 0; i < imageUrls.length; i += BATCH_SIZE) {
    const batch = imageUrls.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (url) => {
        // Check if already cached
        const existing = await cache.match(url);
        if (existing) return;
        
        const response = await fetch(url, { mode: 'cors' });
        if (response.ok) {
          await cache.put(url, response);
        }
      })
    );
    cached += results.filter(r => r.status === 'fulfilled').length;
    onProgress({
      phase: 'images',
      current: Math.min(i + BATCH_SIZE, imageUrls.length),
      total: imageUrls.length,
      label: `Laster bilder... ${Math.min(i + BATCH_SIZE, imageUrls.length)}/${imageUrls.length}`,
    });
  }

  return cached;
}

/**
 * Full offline preload: data + images
 */
export async function preloadForOffline(
  queryClient: QueryClient,
  onProgress: ProgressCallback
): Promise<{ participants: number; images: number }> {
  // Phase 1: Data
  const imageUrls = await preloadData(queryClient, onProgress);

  // Phase 2: Images
  await preloadImages(imageUrls, onProgress);

  return { participants: imageUrls.length, images: imageUrls.length };
}
