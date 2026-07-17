import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ADMIN_PASSWORD = Deno.env.get('GJENGLEMT_ADMIN_PASSWORD') ?? '';

const BUCKET = 'gjenglemt-images';

function extractStoragePath(url: string): string | null {
  if (!url) return null;
  const marker = `/object/public/${BUCKET}/`;
  const signMarker = `/object/sign/${BUCKET}/`;
  let idx = url.indexOf(marker);
  if (idx !== -1) return url.substring(idx + marker.length).split('?')[0];
  idx = url.indexOf(signMarker);
  if (idx !== -1) return url.substring(idx + signMarker.length).split('?')[0];
  // Fallback: assume already a path
  if (!url.startsWith('http')) return url;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const password = String(body?.password ?? '');
    if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: 'Ugyldig passord' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const action = String(body?.action ?? 'list');

    if (action === 'list') {
      const { data: periods, error: pErr } = await supabase
        .from('periods')
        .select('id, name, slug, start_date, end_date, is_active')
        .order('start_date', { ascending: false, nullsFirst: false });
      if (pErr) throw pErr;

      const { data: items, error: iErr } = await supabase
        .from('gjenglemt_items')
        .select('*')
        .order('created_at', { ascending: false });
      if (iErr) throw iErr;

      // Batch sign image URLs
      const paths = (items ?? [])
        .map((it: any) => extractStoragePath(it.image_url))
        .filter((p: string | null): p is string => !!p);
      const uniquePaths = Array.from(new Set(paths));
      const signedMap: Record<string, string> = {};
      // createSignedUrls in batches of 100
      for (let i = 0; i < uniquePaths.length; i += 100) {
        const slice = uniquePaths.slice(i, i + 100);
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrls(slice, 60 * 60 * 6);
        (signed ?? []).forEach((s: any) => {
          if (s.path && s.signedUrl) signedMap[s.path] = s.signedUrl;
        });
      }

      const enriched = (items ?? []).map((it: any) => {
        const path = extractStoragePath(it.image_url);
        return { ...it, signed_url: path ? signedMap[path] ?? null : null };
      });

      return new Response(JSON.stringify({ periods: periods ?? [], items: enriched }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update') {
      const id = String(body?.id ?? '');
      const patch = body?.patch ?? {};
      if (!id) throw new Error('Mangler id');
      const allowed = ['status', 'owner_name', 'notes', 'comment', 'bag_label', 'garment_type', 'color'];
      const clean: Record<string, unknown> = {};
      for (const k of allowed) if (k in patch) clean[k] = patch[k];
      const { data, error } = await supabase
        .from('gjenglemt_items')
        .update(clean)
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return new Response(JSON.stringify({ item: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete') {
      const id = String(body?.id ?? '');
      if (!id) throw new Error('Mangler id');
      // Best-effort delete storage object
      const { data: item } = await supabase
        .from('gjenglemt_items')
        .select('image_url')
        .eq('id', id)
        .maybeSingle();
      const path = item?.image_url ? extractStoragePath(item.image_url) : null;
      const { error } = await supabase.from('gjenglemt_items').delete().eq('id', id);
      if (error) throw error;
      if (path) {
        await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Ukjent action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('gjenglemt-admin error', e);
    return new Response(JSON.stringify({ error: e?.message ?? 'Serverfeil' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});