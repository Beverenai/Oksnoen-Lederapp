import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Derive a deterministic password from the service role key + leader ID
async function derivePassword(leaderId: string): Promise<string> {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(serviceKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(leaderId));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();

    if (!phone || typeof phone !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Skriv inn telefonnummeret ditt.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone number
    let normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.startsWith('0047')) {
      normalizedPhone = normalizedPhone.slice(4);
    }
    if (normalizedPhone.startsWith('47') && normalizedPhone.length === 10) {
      normalizedPhone = normalizedPhone.slice(2);
    }

    if (!/^\d{8}$/.test(normalizedPhone)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Ugyldig telefonnummer. Bruk 8 siffer (evt. +47 først).' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Login attempt for phone: ${normalizedPhone.slice(0, 4)}****`);

    // Look up leader by phone number
    const { data: leader, error } = await supabase
      .from('leaders')
      .select('*')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Noe gikk galt. Prøv igjen.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!leader) {
      console.log('No leader found for phone');
      return new Response(
        JSON.stringify({ success: false, error: 'UNKNOWN_PHONE', message: 'Fant ingen bruker med dette telefonnummeret.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Superadmin (August) can ALWAYS log in, even if accidentally deactivated
    const isSuperadminPhone = normalizedPhone === '90076299';

    if (leader.is_active === false && !isSuperadminPhone) {
      console.log('Leader is not active');
      return new Response(
        JSON.stringify({ success: false, error: 'INACTIVE_LEADER', message: 'Du jobber ikke denne perioden.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate deterministic email and password for this leader
    const email = `${leader.id}@leader.internal`;
    const password = await derivePassword(leader.id);

    let authUserId = leader.auth_user_id;

    // If no auth user exists yet, create one
    if (!authUserId) {
      console.log(`Creating auth user for leader: ${leader.id}`);
      const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createError) {
        // User might already exist (e.g. from a previous partial attempt)
        console.error('Error creating auth user:', createError);
        
        // Try to find existing auth user by email
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        const existingUser = users?.find(u => u.email === email);
        
        if (existingUser) {
          authUserId = existingUser.id;
          console.log(`Found existing auth user: ${authUserId}`);
        } else {
          return new Response(
            JSON.stringify({ success: false, error: 'Kunne ikke opprette bruker. Prøv igjen.' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        authUserId = authUser.user.id;
      }

      // Store auth_user_id on the leader
      await supabase
        .from('leaders')
        .update({ auth_user_id: authUserId })
        .eq('id', leader.id);

      console.log(`Auth user linked: ${authUserId}`);
    }

    // Sign in to get session tokens
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      console.error('Sign in error:', signInError);
      
      // If password mismatch (e.g. service key changed), update the password
      if (signInError.message?.includes('Invalid login credentials')) {
        console.log('Updating password for auth user...');
        await supabase.auth.admin.updateUserById(authUserId!, { password });
        
        // Try signing in again
        const { data: retryData, error: retryError } = await anonClient.auth.signInWithPassword({
          email,
          password,
        });
        
        if (retryError) {
          console.error('Retry sign in error:', retryError);
          return new Response(
            JSON.stringify({ success: false, error: 'Innlogging feilet. Prøv igjen.' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Use retry data
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('leader_id', leader.id);
        
        const roles = rolesData?.map(r => r.role) || [];
        
        // Remove auth_user_id from leader response
        const { auth_user_id: _, ...leaderData } = leader;
        
        return new Response(
          JSON.stringify({
            success: true,
            leader: leaderData,
            roles,
            session: {
              access_token: retryData.session!.access_token,
              refresh_token: retryData.session!.refresh_token,
            },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'Innlogging feilet. Prøv igjen.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch roles
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('leader_id', leader.id);

    const roles = rolesData?.map(r => r.role) || [];

    console.log(`Login successful for leader: ${leader.id}`);

    // Remove auth_user_id from leader response
    const { auth_user_id: _, ...leaderData } = leader;

    return new Response(
      JSON.stringify({
        success: true,
        leader: leaderData,
        roles,
        session: {
          access_token: signInData.session!.access_token,
          refresh_token: signInData.session!.refresh_token,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
