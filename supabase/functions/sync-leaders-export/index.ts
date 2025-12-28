import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch all leaders with their content
    const { data: leaders, error: leadersError } = await supabase
      .from('leaders')
      .select('*')
      .order('name');

    if (leadersError) throw leadersError;

    const { data: contents } = await supabase
      .from('leader_content')
      .select('*');

    const contentMap = new Map(contents?.map(c => [c.leader_id, c]) || []);

    const exportData = leaders?.map(leader => {
      const content = contentMap.get(leader.id);
      return {
        name: leader.name,
        phone: leader.phone,
        email: leader.email,
        ministerpost: leader.ministerpost,
        age: leader.age,
        team: leader.team,
        cabin: leader.cabin,
        cabin_info: leader.cabin_info,
        has_drivers_license: leader.has_drivers_license,
        has_boat_license: leader.has_boat_license,
        can_rappelling: leader.can_rappelling,
        can_climbing: leader.can_climbing,
        can_zipline: leader.can_zipline,
        can_rope_setup: leader.can_rope_setup,
        profile_image_url: leader.profile_image_url,
        personal_message: content?.personal_message || null,
        current_activity: content?.current_activity || null,
        extra_activity: content?.extra_activity || null,
        obs_message: content?.obs_message || null,
        personal_notes: content?.personal_notes || null,
      };
    }) || [];

    console.log(`Exporting ${exportData.length} leaders`);

    return new Response(JSON.stringify({ leaders: exportData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Export error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});