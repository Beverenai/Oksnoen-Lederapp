import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROMPT =
  'Vis denne personen som en eldre versjon av seg selv, ca. 40 år eldre. ' +
  'Behold samme ansikt, identitet, kjønn, positur, klær, lys og bakgrunn. ' +
  'Legg til realistiske aldringstrekk: rynker, grått/tynnere hår, eldre hudtekstur. ' +
  'Fotorealistisk portrett, samme utsnitt. Ikke endre noe annet.';

function toBase64(bytes: Uint8Array) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY mangler');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let batchSize = 5;
    let force = false;
    let offset = 0;
    let periodId: string | null = null;
    let target: 'participants' | 'leaders' = 'participants';
    try {
      const body = await req.json();
      if (body?.batch_size) batchSize = Math.min(Math.max(1, body.batch_size), 10);
      if (body?.force) force = true;
      if (typeof body?.offset === 'number') offset = Math.max(0, body.offset);
      if (typeof body?.period_id === 'string' && body.period_id) periodId = body.period_id;
      if (body?.target === 'leaders') target = 'leaders';
    } catch { /* defaults */ }

    const isLeaders = target === 'leaders';
    const table = isLeaders ? 'leaders' : 'participants';
    const srcCol = isLeaders ? 'profile_image_url' : 'image_url';
    const agedCol = isLeaders ? 'profile_image_aged_url' : 'image_aged_url';
    const bucket = 'participant-images';

    if (!isLeaders && !periodId) throw new Error('Mangler periode');

    let query = supabase
      .from(table)
      .select(`id, name, ${srcCol}, ${agedCol}`)
      .order('name', { ascending: true })
      .not(srcCol, 'is', null)
      .range(offset, offset + batchSize - 1);

    if (!isLeaders) query = query.eq('period_id', periodId!);
    if (!force) query = query.is(agedCol, null);

    const { data: rows, error } = await query;
    if (error) throw error;

    const results = { processed: 0, failed: 0, details: [] as any[] };

    for (const p of (rows || []) as any[]) {
      try {
        const srcRes = await fetch(p[srcCol]);
        if (!srcRes.ok) throw new Error(`fetch bilde ${srcRes.status}`);
        const srcMime = srcRes.headers.get('content-type') || 'image/jpeg';
        const srcBytes = new Uint8Array(await srcRes.arrayBuffer());
        if (srcBytes.length === 0) throw new Error('tomt kildebilde');
        const dataUrl = `data:${srcMime};base64,${toBase64(srcBytes)}`;

        const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/images/generations', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-pro-image',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: PROMPT },
                  { type: 'image_url', image_url: { url: dataUrl } },
                ],
              },
            ],
            modalities: ['image', 'text'],
          }),
        });

        if (!aiRes.ok) {
          const txt = await aiRes.text();
          throw new Error(`AI ${aiRes.status}: ${txt.slice(0, 300)}`);
        }

        const json = await aiRes.json();
        const b64 = json?.data?.[0]?.b64_json;
        if (!b64) throw new Error('Ingen bilde i AI-svaret');

        const bytes = fromBase64(b64);
        const path = isLeaders ? `leader-profiles/${p.id}_aged.png` : `${p.id}_aged.png`;
        const { error: upErr } = await supabase.storage
          .from(bucket)
          .upload(path, bytes, { upsert: true, contentType: 'image/png' });
        if (upErr) throw upErr;

        const { data: { publicUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(path);

        const { error: updErr } = await supabase
          .from(table)
          .update({ [agedCol]: `${publicUrl}?v=${Date.now()}` })
          .eq('id', p.id);
        if (updErr) throw updErr;

        results.processed++;
      } catch (e) {
        results.failed++;
        results.details.push({ id: p.id, name: p.name, error: e instanceof Error ? e.message : String(e) });
      }
    }

    let remainingQuery = supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .not(srcCol, 'is', null)
      .is(agedCol, null);
    if (!isLeaders) remainingQuery = remainingQuery.eq('period_id', periodId!);
    const { count: remaining } = await remainingQuery;

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
