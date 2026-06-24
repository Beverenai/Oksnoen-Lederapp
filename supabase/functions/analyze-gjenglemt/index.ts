import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GARMENT_VALUES = [
  'genser','t-skjorte','bukse','shorts','sokk','undertoy','jakke','lue','hansker',
  'sko','badetoy','handkle','drikkeflaske','briller','smykke','elektronikk','annet'
];
const COLOR_VALUES = [
  'svart','hvit','gra','rod','rosa','oransje','gul','gronn','bla','lilla','brun','beige','flerfarget'
];

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function setStatus(itemId: string, patch: Record<string, unknown>) {
  await admin.from('gjenglemt_items').update(patch).eq('id', itemId);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY missing' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json().catch(() => ({}));
    const itemId = typeof body?.item_id === 'string' ? body.item_id : null;
    if (!itemId) {
      return new Response(JSON.stringify({ error: 'item_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: item, error: fetchErr } = await admin
      .from('gjenglemt_items')
      .select('id, image_url')
      .eq('id', itemId)
      .maybeSingle();
    if (fetchErr || !item) {
      return new Response(JSON.stringify({ error: 'item not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const path = item.image_url;
    const { data: signed, error: signErr } = await admin.storage
      .from('gjenglemt-images')
      .createSignedUrl(path, 60 * 10);
    if (signErr || !signed?.signedUrl) {
      await setStatus(itemId, { ai_status: 'failed' });
      return new Response(JSON.stringify({ error: 'cannot sign image' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const tool = {
      type: 'function',
      function: {
        name: 'classify_lost_item',
        description: 'Klassifiser et bilde av et gjenglemt plagg/gjenstand.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            garment_type: { type: 'string', enum: GARMENT_VALUES, description: 'Best matching garment/item type.' },
            color: { type: 'string', enum: COLOR_VALUES, description: 'Dominant color.' },
            description: { type: 'string', description: 'Kort beskrivelse på norsk, maks 120 tegn. Beskriv farge, materiale, mønster og kjennetegn. Aldri spekuler om eier.' },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: '3-8 søkeord på norsk (farger, materiale, mønster, merker hvis lesbart, plagg-synonymer).'
            }
          },
          required: ['garment_type', 'color', 'description', 'tags'],
        },
      },
    };

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Du klassifiserer bilder av gjenglemte gjenstander fra et leirsted. Svar alltid via verktøyet classify_lost_item. Velg det nærmeste alternativet selv om bildet er uskarpt.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Klassifiser denne gjenglemte gjenstanden.' },
              { type: 'image_url', image_url: { url: signed.signedUrl } },
            ],
          },
        ],
        tools: [tool],
        tool_choice: { type: 'function', function: { name: 'classify_lost_item' } },
      }),
    });

    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error('AI gateway error', aiResp.status, text);
      await setStatus(itemId, { ai_status: 'failed' });
      return new Response(JSON.stringify({ error: 'ai gateway error', detail: text }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    const argsRaw = toolCall?.function?.arguments;
    if (!argsRaw) {
      console.error('No tool call in response', JSON.stringify(aiJson));
      await setStatus(itemId, { ai_status: 'failed' });
      return new Response(JSON.stringify({ error: 'no tool call' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let parsed: { garment_type: string; color: string; description: string; tags: string[] };
    try { parsed = JSON.parse(argsRaw); }
    catch (e) {
      console.error('Parse error', e, argsRaw);
      await setStatus(itemId, { ai_status: 'failed' });
      return new Response(JSON.stringify({ error: 'parse error' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const garment = GARMENT_VALUES.includes(parsed.garment_type) ? parsed.garment_type : 'annet';
    const color = COLOR_VALUES.includes(parsed.color) ? parsed.color : 'flerfarget';
    const description = (parsed.description ?? '').toString().slice(0, 240);
    const tags = Array.isArray(parsed.tags) ? parsed.tags.map(t => String(t).toLowerCase().slice(0, 40)).filter(Boolean).slice(0, 12) : [];

    await setStatus(itemId, {
      garment_type: garment,
      color,
      ai_description: description,
      ai_tags: tags,
      ai_status: 'done',
    });

    return new Response(JSON.stringify({ ok: true, garment_type: garment, color, description, tags }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('analyze-gjenglemt error', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});