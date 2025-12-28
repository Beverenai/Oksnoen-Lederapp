import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeaderImport {
  name: string;
  phone: string;
  email?: string;
  ministerpost?: string;
  age?: number;
  team?: string;
  cabin?: string;
  cabin_info?: string;
  has_drivers_license?: boolean;
  has_boat_license?: boolean;
  can_rappelling?: boolean;
  can_climbing?: boolean;
  can_zipline?: boolean;
  can_rope_setup?: boolean;
  profile_image_url?: string;
  personal_message?: string;
  current_activity?: string;
  extra_activity?: string;
  obs_message?: string;
  personal_notes?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { leaders } = await req.json() as { leaders: LeaderImport[] };

    if (!leaders || !Array.isArray(leaders)) {
      return new Response(JSON.stringify({ error: 'Invalid leaders data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Importing ${leaders.length} leaders`);

    const results = { updated: 0, created: 0, errors: [] as string[] };

    for (const leader of leaders) {
      const phone = leader.phone?.replace(/\s/g, '');
      if (!phone || !leader.name) {
        results.errors.push(`Skipped: missing name or phone`);
        continue;
      }

      // Check if leader exists by phone
      const { data: existing } = await supabase
        .from('leaders')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();

      const leaderData = {
        name: leader.name,
        phone,
        email: leader.email || null,
        ministerpost: leader.ministerpost || null,
        age: leader.age || null,
        team: leader.team || null,
        cabin: leader.cabin || null,
        cabin_info: leader.cabin_info || null,
        has_drivers_license: leader.has_drivers_license ?? false,
        has_boat_license: leader.has_boat_license ?? false,
        can_rappelling: leader.can_rappelling ?? false,
        can_climbing: leader.can_climbing ?? false,
        can_zipline: leader.can_zipline ?? false,
        can_rope_setup: leader.can_rope_setup ?? false,
        profile_image_url: leader.profile_image_url || null,
      };

      if (existing) {
        await supabase.from('leaders').update(leaderData).eq('id', existing.id);
        
        // Update leader_content if provided
        if (leader.personal_message || leader.current_activity || leader.extra_activity || leader.obs_message || leader.personal_notes) {
          await supabase.from('leader_content').upsert({
            leader_id: existing.id,
            personal_message: leader.personal_message || null,
            current_activity: leader.current_activity || null,
            extra_activity: leader.extra_activity || null,
            obs_message: leader.obs_message || null,
            personal_notes: leader.personal_notes || null,
          });
        }
        results.updated++;
      } else {
        const { data: newLeader } = await supabase.from('leaders').insert(leaderData).select().single();
        if (newLeader && (leader.personal_message || leader.current_activity)) {
          await supabase.from('leader_content').insert({
            leader_id: newLeader.id,
            personal_message: leader.personal_message || null,
            current_activity: leader.current_activity || null,
            extra_activity: leader.extra_activity || null,
            obs_message: leader.obs_message || null,
            personal_notes: leader.personal_notes || null,
          });
        }
        results.created++;
      }
    }

    console.log(`Import complete: ${results.created} created, ${results.updated} updated`);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Import error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});