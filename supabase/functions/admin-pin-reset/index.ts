import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: Record<string, unknown>, status = 200) => new Response(
    JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return json({ error: 'Ikke innlogget' }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: 'Ugyldig sesjon' }, 401);

    const { data: caller } = await admin
      .from('leaders')
      .select('id')
      .eq('auth_user_id', userData.user.id)
      .maybeSingle();
    if (!caller) return json({ error: 'Ingen leder' }, 403);

    const { data: callerRoles } = await admin
      .from('user_roles')
      .select('role')
      .eq('leader_id', caller.id);
    const isAdmin = (callerRoles ?? []).some(
      (r: { role: string }) => r.role === 'superadmin' || r.role === 'admin'
    );
    if (!isAdmin) return json({ error: 'Bare admin kan nullstille PIN' }, 403);

    const body = await req.json().catch(() => ({}));
    const leaderId = body?.leader_id;
    if (typeof leaderId !== 'string' || !/^[0-9a-f-]{36}$/i.test(leaderId)) {
      return json({ error: 'Ugyldig leder-id' }, 400);
    }

    const { error: delErr } = await admin.from('admin_pins').delete().eq('leader_id', leaderId);
    if (delErr) return json({ error: 'Kunne ikke nullstille PIN' }, 500);

    return json({ success: true });
  } catch (err) {
    console.error('admin-pin-reset error:', err);
    return json({ error: 'Noe gikk galt' }, 500);
  }
});