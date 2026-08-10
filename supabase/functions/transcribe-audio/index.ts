import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY mangler' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size < 1024) {
      return new Response(JSON.stringify({ error: 'Lydopptaket er tomt – prøv igjen' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (file.size > 20 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'Opptaket er for stort' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const upstream = new FormData();
    upstream.append('model', 'openai/gpt-4o-transcribe');
    upstream.append('file', file, 'recording.wav');
    upstream.append('language', 'no');

    const res = await fetch('https://ai.gateway.lovable.dev/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Transcription failed [${res.status}]: ${body}`);
      return new Response(JSON.stringify({ error: 'Transkribering feilet', status: res.status, details: body }), {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    return new Response(JSON.stringify({ text: data?.text ?? '' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('transcribe-audio error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});