import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();

    if (!phone || typeof phone !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone number - remove spaces and country code prefix
    let normalizedPhone = phone.replace(/\s/g, '');
    
    // Remove +47 or 0047 prefix if present
    if (normalizedPhone.startsWith('+47')) {
      normalizedPhone = normalizedPhone.slice(3);
    } else if (normalizedPhone.startsWith('0047')) {
      normalizedPhone = normalizedPhone.slice(4);
    }

    // Validate phone format (8 digits for Norwegian numbers)
    if (!/^\d{8}$/.test(normalizedPhone)) {
      return new Response(
        JSON.stringify({ error: 'Ugyldig telefonnummer. Bruk 8 siffer.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role to query leaders table (hides phone lookup from client)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Login attempt for phone: ${normalizedPhone.slice(0, 4)}****`);

    // Look up leader by phone number
    const { data: leader, error } = await supabase
      .from('leaders')
      .select('id, name, is_active, profile_image_url, age, team, cabin, ministerpost, email, has_car, has_drivers_license, has_boat_license, can_climbing, can_rappelling, can_zipline, can_rope_setup, cabin_info')
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
        JSON.stringify({ error: 'Fant ingen leder med dette telefonnummeret.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if leader is active
    if (leader.is_active === false) {
      console.log('Leader is not active');
      return new Response(
        JSON.stringify({ error: 'Du jobber ikke denne perioden. Hvis dette er feil, kontakt admin.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch roles for this leader
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('leader_id', leader.id);

    const roles = rolesData?.map(r => r.role) || [];

    console.log(`Login successful for leader: ${leader.id}`);

    // Return leader data and roles (without phone number)
    return new Response(
      JSON.stringify({
        success: true,
        leader: leader,
        roles: roles
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
