import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { Image, decode } from 'https://deno.land/x/imagescript@1.2.17/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let batchSize = 25;
    let force = false;
    let offset = 0;
    try {
      const body = await req.json();
      if (body?.batch_size) batchSize = Math.min(Math.max(1, body.batch_size), 100);
      if (body?.force) force = true;
      if (typeof body?.offset === 'number') offset = Math.max(0, body.offset);
    } catch { /* defaults */ }

    let query = supabase
      .from('participants')
      .select('id, name, image_url, image_thumb_url')
      .order('name', { ascending: true })
      .not('image_url', 'is', null)
      .range(offset, offset + batchSize - 1);

    if (!force) query = query.is('image_thumb_url', null);

    const { data: rows, error } = await query;
    if (error) throw error;

    const results = { processed: 0, failed: 0, details: [] as any[] };

    for (const p of rows || []) {
      try {
        const res = await fetch(p.image_url!);
        if (!res.ok) throw new Error(`fetch ${res.status}`);
        const buf = new Uint8Array(await res.arrayBuffer());
        const img = await decode(buf);
        const src = img instanceof Image ? img : (img as any).image ?? img;
        // Resize to width 160, preserve aspect
        const w = 160;
        const h = Math.max(1, Math.round(((src as Image).height / (src as Image).width) * w));
        (src as Image).resize(w, h);
        const jpeg = await (src as Image).encodeJPEG(70);

        const path = `${p.id}_thumb.jpg`;
        const { error: upErr } = await supabase.storage
          .from('participant-images')
          .upload(path, jpeg, { upsert: true, contentType: 'image/jpeg' });
        if (upErr) throw upErr;

        const { data: { publicUrl } } = supabase.storage
          .from('participant-images')
          .getPublicUrl(path);

        const thumbUrl = `${publicUrl}?v=${Date.now()}`;
        const { error: updErr } = await supabase
          .from('participants')
          .update({ image_thumb_url: thumbUrl })
          .eq('id', p.id);
        if (updErr) throw updErr;

        results.processed++;
      } catch (e) {
        results.failed++;
        results.details.push({ id: p.id, name: p.name, error: e instanceof Error ? e.message : String(e) });
      }
    }

    const { count: remaining } = await supabase
      .from('participants')
      .select('id', { count: 'exact', head: true })
      .not('image_url', 'is', null)
      .is('image_thumb_url', null);

    return new Response(JSON.stringify({ success: true, ...results, remaining: remaining ?? 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});