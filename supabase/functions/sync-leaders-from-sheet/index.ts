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
  'aktivitet': 'current_activity', 'aktiviteter': 'current_activity', 'activity': 'current_activity',
  'nåværende aktivitet': 'current_activity', 'naverende aktivitet': 'current_activity',
  'denne økten skal du': 'current_activity', 'denne okten skal du': 'current_activity',
  'ansvar': 'extra_activity', 'ekstra ansvar': 'extra_activity', 'oppgave': 'extra_activity',
  'notater': 'personal_notes', 'notat': 'personal_notes', 'notes': 'personal_notes', 'beskjed': 'personal_notes',
  'notater til deg': 'personal_notes', 'notater/til deg': 'personal_notes',
  'til deg': 'personal_message', 'til lederen': 'personal_message', 'personlig melding': 'personal_message', 'personal_message': 'personal_message',
  'obs': 'obs_message', 'obs!': 'obs_message', 'viktig': 'obs_message', 'viktig info': 'obs_message',
  'ekstra #1': 'extra_1', 'ekstra 1': 'extra_1', 'ekstra1': 'extra_1', 'overnatting': 'extra_1',
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

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function matchCabinIds(text: string | null | undefined, cabins: { id: string; name: string }[]): string[] {
  if (!text) return [];
  let working = String(text);

  // Normalize common sheet shorthand → actual cabin names
  working = working
    .replace(/\bskyss\s*2\s*\+?\s*3\b/gi, 'Skyss II + III')
    .replace(/\bfiskebu\b(?!a)/gi, 'Fiskebua');

  // Protect multi-word / multi-cabin names (longest first) with placeholders
  const placeholders = new Map<string, string>();
  const multi = cabins
    .filter((c) => /\s|[+&]/.test(c.name))
    .sort((a, b) => b.name.length - a.name.length);
  multi.forEach((c, i) => {
    const ph = `\u0000CAB${i}\u0000`;
    const re = new RegExp(escapeRegex(c.name).replace(/\s+/g, '\\s*'), 'gi');
    if (re.test(working)) {
      working = working.replace(re, ` ${ph} `);
      placeholders.set(ph, c.id);
    }
  });

  // Split on whitespace, +, &, comma, slash, and the word "og"
  const parts = working
    .split(/[\s+&,/]+|\bog\b/gi)
    .map((s) => s.trim())
    .filter(Boolean);
  const ids: string[] = [];
  for (const part of parts) {
    if (placeholders.has(part)) { ids.push(placeholders.get(part)!); continue; }
    const lower = norm(part);
    if (!lower || lower.length < 3) continue;

    // Exact match
    const exact = cabins.filter((c) => norm(c.name) === lower);
    if (exact.length > 0) { exact.forEach((c) => ids.push(c.id)); continue; }

    // First-word match: "Balder" → Balder bak + Balder front, "Beritbu" → bak + front
    const firstWord = cabins.filter((c) => {
      const n = norm(c.name);
      return n === lower || n.startsWith(lower + ' ');
    });
    if (firstWord.length > 0) { firstWord.forEach((c) => ids.push(c.id)); continue; }

    // Fallback: token is contained in cabin name (e.g. "bestefars" → "Bestefars kro")
    const sub = cabins.filter((c) => {
      const n = norm(c.name);
      return n.includes(lower);
    });
    if (sub.length > 0) sub.forEach((c) => ids.push(c.id));
  }
  return Array.from(new Set(ids));
}

function extractSpreadsheetId(input: string): string {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : input.trim();
}

const sheetPrefix = (title: string) => {
  const t = title.trim();
  return /[^A-Za-z0-9_]/.test(t) ? `'${t.replace(/'/g, "''")}'` : t;
};
const normalizeSheetRange = (range: string) => {
  const trimmed = range.trim();
  const bangIndex = trimmed.indexOf('!');
  if (bangIndex === -1) return trimmed;

  const rawTitle = trimmed.slice(0, bangIndex).trim();
  const cells = trimmed.slice(bangIndex + 1).trim() || 'A1:ZZ1000';
  const unquotedTitle = rawTitle.startsWith("'") && rawTitle.endsWith("'")
    ? rawTitle.slice(1, -1).replace(/''/g, "'")
    : rawTitle;

  return `${sheetPrefix(unquotedTitle)}!${cells}`;
};
const isAutoDefaultRange = (range: string) => /^'?Sheet1'?!A1:Z{1,2}1000$/i.test(range.trim());

async function fetchSheetValues(spreadsheetId: string, range: string, headers: HeadersInit) {
  const res = await fetch(`${GATEWAY_URL}/spreadsheets/${spreadsheetId}/values/${range}`, { headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`Google Sheets fetch failed [${res.status}]: ${text}`);
  const data = JSON.parse(text);
  return { range, values: (data.values || []) as string[][] };
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
    const rangeInput: string = normalizeSheetRange(body.range || '');
    const dryRun: boolean = !!body.dryRun;
    if (!spreadsheetIdInput) {
      return new Response(JSON.stringify({ error: 'spreadsheetId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const spreadsheetId = extractSpreadsheetId(spreadsheetIdInput);

    const gatewayHeaders = {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': GOOGLE_SHEETS_API_KEY,
    };

    // Resolve range: if user didn't supply one, or supplied bare A1 notation without a sheet name,
    // fetch spreadsheet metadata and prefix with the first sheet's title.
    let range = rangeInput || 'A1:ZZ1000';
    let sheetTitles: string[] = [];
    const needsMetadata = !range.includes('!') || isAutoDefaultRange(range);
    if (needsMetadata) {
      const metaRes = await fetch(`${GATEWAY_URL}/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, { headers: gatewayHeaders });
      const metaText = await metaRes.text();
      if (!metaRes.ok) return new Response(JSON.stringify({ error: `Kunne ikke hente arkinfo [${metaRes.status}]: ${metaText}` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const meta = JSON.parse(metaText);
      sheetTitles = (meta?.sheets || []).map((s: any) => s?.properties?.title).filter(Boolean);
      const firstTitle = sheetTitles[0];
      if (!firstTitle) {
        return new Response(JSON.stringify({ error: 'Fant ingen faner i Google Sheet.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!range.includes('!')) range = `${sheetPrefix(firstTitle)}!${range}`;
    }

    // Fetch sheet via gateway. If the saved setup still points at the old default Sheet1,
    // try all tabs and use the one with the most matched leaders.
    const rangesToTry = isAutoDefaultRange(range) && sheetTitles.length > 1
      ? sheetTitles.map((title) => `${sheetPrefix(title)}!A1:ZZ1000`)
      : [range];
    const scoreSheet = (values: string[][]) => {
      const firstRow = values[0] || [];
      const mappedHeaders = firstRow.map((h) => HEADER_ALIASES[norm(h)]).filter(Boolean);
      const hasPhone = mappedHeaders.includes('phone');
      return (hasPhone ? 100000 : 0) + mappedHeaders.length * 1000 + values.length;
    };
    let best = await fetchSheetValues(spreadsheetId, rangesToTry[0], gatewayHeaders);
    for (const candidate of rangesToTry.slice(1)) {
      const next = await fetchSheetValues(spreadsheetId, candidate, gatewayHeaders);
      if (scoreSheet(next.values) > scoreSheet(best.values)) best = next;
    }
    range = best.range;
    const values = best.values;
    if (values.length < 2) {
      return new Response(JSON.stringify({ error: 'Trenger en headerrad og minst én datarad.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const header = values[0];
    const headerMap: Record<number, string> = {};
    const unknownHeaders: string[] = [];
    const presentKeys = new Set<string>();
    let nameCol = -1, phoneCol = -1;
    header.forEach((h, idx) => {
      const key = HEADER_ALIASES[norm(h)];
      if (key) {
        headerMap[idx] = key;
        presentKeys.add(key);
        if (key === 'name') nameCol = idx;
        if (key === 'phone') phoneCol = idx;
      } else if ((h || '').trim()) {
        unknownHeaders.push(h);
      }
    });
    if (phoneCol === -1) {
      return new Response(JSON.stringify({ error: 'Fant ingen "Tlf"-kolonne. Telefon kreves for matching.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: leaders, error: leadersErr } = await admin.from('leaders').select('id, name, phone');
    if (leadersErr) throw leadersErr;
    const { data: allCabinsData } = await admin.from('cabins').select('id, name');
    const cabinList = allCabinsData || [];
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
      values: Record<string, string | null>;
    };
    const rows: ParsedRow[] = values.slice(1).map((r) => {
      const rawName = nameCol >= 0 ? (r[nameCol] || '').trim() : '';
      const rawPhone = (r[phoneCol] || '').trim();
      const vals: Record<string, string | null> = {};
      for (const [idxStr, key] of Object.entries(headerMap)) {
        if (key === 'name' || key === 'phone') continue;
        const v = (r[Number(idxStr)] || '').trim();
        vals[key] = v === '' ? null : v;
      }
      let matchedLeader: { id: string; name: string } | undefined;
      const phoneKey = normPhone(rawPhone);
      if (phoneKey) matchedLeader = byPhone.get(phoneKey);
      return { rawName: rawName || rawPhone, matchedLeader, values: vals };
    }).filter((r) => r.rawName);

    const matched = rows.filter(r => r.matchedLeader);
    const unmatched = rows.filter(r => !r.matchedLeader).map(r => r.rawName);

    if (dryRun) {
      return new Response(JSON.stringify({
        preview: true,
        matchedCount: matched.length,
        range,
        unmatched,
        unknownHeaders,
        headers: header,
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
      const contentPayload: Record<string, string | null> = {};
      const leaderPayload: Record<string, string | null> = {};
      // Include every column present in the sheet header — empty cells become null (clears field)
      for (const k of CONTENT_KEYS) {
        if (presentKeys.has(k)) contentPayload[k] = row.values[k] ?? null;
      }
      for (const k of LEADER_KEYS) {
        // phone is match key + NOT NULL, never touch it
        if (k === 'phone') continue;
        if (presentKeys.has(k)) leaderPayload[k] = row.values[k] ?? null;
      }
      let rowFailed = false;
      if (Object.keys(contentPayload).length > 0) {
        const hasAnyValue = Object.values(contentPayload).some(v => v !== null);
        const payload = { ...contentPayload, last_synced_at: nowIso };
        if (existingSet.has(leaderId)) {
          const { error } = await admin.from('leader_content').update(payload).eq('leader_id', leaderId);
          if (error) { rowFailed = true; console.error('content update', leaderId, error); }
        } else if (hasAnyValue) {
          const { error } = await admin.from('leader_content').insert({ leader_id: leaderId, ...payload });
          if (error) { rowFailed = true; console.error('content insert', leaderId, error); }
        }
      }
      if (Object.keys(leaderPayload).length > 0) {
        const { error } = await admin.from('leaders').update(leaderPayload).eq('id', leaderId);
        if (error) { rowFailed = true; console.error('leader update', leaderId, error); }
      }
      // Sync leader_cabins from the cabin text (split on + / &, with multi-cabin names protected)
      if (presentKeys.has('cabin')) {
        const cabinText = row.values['cabin'];
        const cabinIds = matchCabinIds(cabinText, cabinList);
        const { error: delErr } = await admin.from('leader_cabins').delete().eq('leader_id', leaderId);
        if (delErr) { rowFailed = true; console.error('leader_cabins delete', leaderId, delErr); }
        if (cabinIds.length > 0) {
          const { error: insErr } = await admin
            .from('leader_cabins')
            .insert(cabinIds.map((cabin_id) => ({ leader_id: leaderId, cabin_id })));
          if (insErr) { rowFailed = true; console.error('leader_cabins insert', leaderId, insErr); }
        }
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
      range,
      headers: header,
      lastSyncAt: nowIso,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('sync-leaders-from-sheet error', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});