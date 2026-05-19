import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_sheets/v4';

const HEADER_ALIASES: Record<string, string> = {
  'navn': 'name', 'name': 'name',
  'tlf': 'phone', 'telefon': 'phone', 'phone': 'phone', 'mobil': 'phone',
  'aktivitet': 'current_activity', 'activity': 'current_activity',
  'ansvar': 'extra_activity',
  'notater': 'personal_notes', 'notes': 'personal_notes',
  'notater til deg': 'personal_notes', 'notater/til deg': 'personal_notes',
  'til deg': 'personal_message', 'til lederen': 'personal_message', 'personal_message': 'personal_message',
  'obs': 'obs_message', 'obs!': 'obs_message', 'viktig': 'obs_message',
  'ekstra #1': 'extra_1', 'ekstra 1': 'extra_1', 'ekstra1': 'extra_1',
  'ekstra #2': 'extra_2', 'ekstra 2': 'extra_2', 'ekstra2': 'extra_2',
  'ekstra #3': 'extra_3', 'ekstra 3': 'extra_3', 'ekstra3': 'extra_3',
  'ekstra #4': 'extra_4', 'ekstra 4': 'extra_4', 'ekstra4': 'extra_4',
  'ekstra #5': 'extra_5', 'ekstra 5': 'extra_5', 'ekstra5': 'extra_5',
  'hytte': 'cabin', 'cabin': 'cabin',
  'hytte ansvar': 'cabin', 'hytte/ansvar': 'cabin',
  'ministerpost': 'ministerpost',
  'team': 'team',
};

const CONTENT_KEYS = [
  'current_activity', 'extra_activity', 'personal_notes', 'personal_message',
  'obs_message', 'extra_1', 'extra_2', 'extra_3', 'extra_4', 'extra_5',
] as const;
const LEADER_KEYS = ['phone', 'cabin', 'ministerpost', 'team'] as const;

const norm = (s: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
const normPhone = (s: string | null | undefined) => (s || '').replace(/\D/g, '').slice(-8);

function extractSpreadsheetId(input: string): string {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : input.trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const GOOGLE_SHEETS_API_KEY = Deno.env.get('GOOGLE_SHEETS_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');
    if (!GOOGLE_SHEETS_API_KEY) throw new Error('GOOGLE_SHEETS_API_KEY is not configured (connect Google Sheets)');

    // Auth check — must be admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: isAdminData, error: roleErr } = await userClient.rpc('is_admin');
    if (roleErr || !isAdminData) {
      return new Response(JSON.stringify({ error: 'Forbidden — admin only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const spreadsheetIdInput: string = body.spreadsheetId || body.spreadsheetUrl || '';
    const rangeInput: string = (body.range || '').trim();
    const dryRun: boolean = !!body.dryRun;
    if (!spreadsheetIdInput) {
      return new Response(JSON.stringify({ error: 'spreadsheetId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const spreadsheetId = extractSpreadsheetId(spreadsheetIdInput);

    // Resolve range: if user didn't supply one, or supplied bare A1 notation without a sheet name,
    // fetch spreadsheet metadata and prefix with the first sheet's title.
    let range = rangeInput || 'A1:Z1000';
    if (!range.includes('!')) {
      const metaRes = await fetch(`${GATEWAY_URL}/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, {
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': GOOGLE_SHEETS_API_KEY,
        },
      });
      const metaText = await metaRes.text();
      if (!metaRes.ok) {
        return new Response(JSON.stringify({ error: `Kunne ikke hente arkinfo [${metaRes.status}]: ${metaText}` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const meta = JSON.parse(metaText);
      const firstTitle: string | undefined = meta?.sheets?.[0]?.properties?.title;
      if (!firstTitle) {
        return new Response(JSON.stringify({ error: 'Fant ingen faner i Google Sheet.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const sheetPrefix = /[^A-Za-z0-9_]/.test(firstTitle) ? `'${firstTitle.replace(/'/g, "''")}'` : firstTitle;
      range = `${sheetPrefix}!${range}`;
    }

    // Fetch sheet via gateway
    const sheetUrl = `${GATEWAY_URL}/spreadsheets/${spreadsheetId}/values/${range}`;
    const sheetRes = await fetch(sheetUrl, {
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': GOOGLE_SHEETS_API_KEY,
      },
    });
    const sheetText = await sheetRes.text();
    if (!sheetRes.ok) {
      return new Response(JSON.stringify({ error: `Google Sheets fetch failed [${sheetRes.status}]: ${sheetText}` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const sheetData = JSON.parse(sheetText);
    const values: string[][] = sheetData.values || [];
    if (values.length < 2) {
      return new Response(JSON.stringify({ error: 'Trenger en headerrad og minst én datarad.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const header = values[0];
    const headerMap: Record<number, string> = {};
    const unknownHeaders: string[] = [];
    let nameCol = -1, phoneCol = -1;
    header.forEach((h, idx) => {
      const key = HEADER_ALIASES[norm(h)];
      if (key) {
        headerMap[idx] = key;
        if (key === 'name') nameCol = idx;
        if (key === 'phone') phoneCol = idx;
      } else if ((h || '').trim()) {
        unknownHeaders.push(h);
      }
    });
    if (nameCol === -1 && phoneCol === -1) {
      return new Response(JSON.stringify({ error: 'Fant ingen "Navn"- eller "Tlf"-kolonne.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: leaders, error: leadersErr } = await admin.from('leaders').select('id, name, phone');
    if (leadersErr) throw leadersErr;
    const byName = new Map<string, { id: string; name: string }>();
    const byPhone = new Map<string, { id: string; name: string }>();
    for (const l of leaders || []) {
      byName.set(norm(l.name), l);
      const p = normPhone(l.phone);
      if (p) byPhone.set(p, l);
    }

    type ParsedRow = {
      rawName: string;
      matchedLeader?: { id: string; name: string };
      values: Record<string, string>;
    };
    const rows: ParsedRow[] = values.slice(1).map((r) => {
      const rawName = nameCol >= 0 ? (r[nameCol] || '').trim() : '';
      const rawPhone = phoneCol >= 0 ? (r[phoneCol] || '').trim() : '';
      const vals: Record<string, string> = {};
      for (const [idxStr, key] of Object.entries(headerMap)) {
        if (key === 'name') continue;
        const v = (r[Number(idxStr)] || '').trim();
        if (v) vals[key] = v;
      }
      let matchedLeader: { id: string; name: string } | undefined;
      const phoneKey = normPhone(rawPhone);
      if (phoneKey) matchedLeader = byPhone.get(phoneKey);
      if (!matchedLeader && rawName) matchedLeader = byName.get(norm(rawName));
      return { rawName: rawName || rawPhone, matchedLeader, values: vals };
    }).filter((r) => r.rawName);

    const matched = rows.filter(r => r.matchedLeader && Object.keys(r.values).length > 0);
    const unmatched = rows.filter(r => !r.matchedLeader).map(r => r.rawName);

    if (dryRun) {
      return new Response(JSON.stringify({
        preview: true,
        matchedCount: matched.length,
        unmatched,
        unknownHeaders,
        sample: matched.slice(0, 10).map(m => ({ name: m.matchedLeader!.name, fields: m.values })),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const nowIso = new Date().toISOString();
    let saved = 0, failed = 0;
    const ids = matched.map(r => r.matchedLeader!.id);
    const { data: existing } = await admin.from('leader_content').select('leader_id').in('leader_id', ids);
    const existingSet = new Set((existing || []).map((e: any) => e.leader_id));

    for (const row of matched) {
      const leaderId = row.matchedLeader!.id;
      const contentPayload: Record<string, string> = {};
      const leaderPayload: Record<string, string> = {};
      for (const k of CONTENT_KEYS) {
        if (row.values[k] !== undefined) contentPayload[k] = row.values[k];
      }
      for (const k of LEADER_KEYS) {
        if (row.values[k] !== undefined) leaderPayload[k] = row.values[k];
      }
      let rowFailed = false;
      if (Object.keys(contentPayload).length > 0) {
        const payload = { ...contentPayload, last_synced_at: nowIso };
        if (existingSet.has(leaderId)) {
          const { error } = await admin.from('leader_content').update(payload).eq('leader_id', leaderId);
          if (error) { rowFailed = true; console.error('content update', leaderId, error); }
        } else {
          const { error } = await admin.from('leader_content').insert({ leader_id: leaderId, ...payload });
          if (error) { rowFailed = true; console.error('content insert', leaderId, error); }
        }
      }
      if (Object.keys(leaderPayload).length > 0) {
        const { error } = await admin.from('leaders').update(leaderPayload).eq('id', leaderId);
        if (error) { rowFailed = true; console.error('leader update', leaderId, error); }
      }
      if (rowFailed) failed++; else saved++;
    }

    // Persist last sync metadata
    const configValue = JSON.stringify({ spreadsheetId, range, lastSyncAt: nowIso });
    await admin.from('app_config').upsert(
      { key: 'google_sheet_sync', value: configValue, updated_at: nowIso },
      { onConflict: 'key' }
    );

    return new Response(JSON.stringify({
      ok: true,
      matchedCount: matched.length,
      saved,
      failed,
      unmatched,
      unknownHeaders,
      lastSyncAt: nowIso,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('sync-leaders-from-sheet error', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});