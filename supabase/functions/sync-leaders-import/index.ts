import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeaderContentImport {
  phone: string;
  current_activity?: string;
  personal_notes?: string;
  personal_message?: string;
  obs_message?: string;
  extra_1?: string;
  extra_2?: string;
  extra_3?: string;
  extra_4?: string;
  extra_5?: string;
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

    const { leaders } = await req.json() as { leaders: LeaderContentImport[] };

    if (!leaders || !Array.isArray(leaders)) {
      return new Response(JSON.stringify({ error: 'Invalid leaders data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Syncing content for ${leaders.length} leaders`);

    const results = { updated: 0, skipped: 0, errors: [] as string[] };

    for (const leader of leaders) {
      const phone = leader.phone?.replace(/\s/g, '');
      if (!phone) {
        results.errors.push('Skipped: missing phone');
        results.skipped++;
        continue;
      }

      // Find leader by phone number
      const { data: existingLeader } = await supabase
        .from('leaders')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();

      if (!existingLeader) {
        console.log(`Leader not found for phone: ${phone}`);
        results.errors.push(`Leader not found: ${phone}`);
        results.skipped++;
        continue;
      }

      // Upsert leader content
      const contentData = {
        leader_id: existingLeader.id,
        current_activity: leader.current_activity || null,
        personal_notes: leader.personal_notes || null,
        personal_message: leader.personal_message || null,
        obs_message: leader.obs_message || null,
        extra_1: leader.extra_1 || null,
        extra_2: leader.extra_2 || null,
        extra_3: leader.extra_3 || null,
        extra_4: leader.extra_4 || null,
        extra_5: leader.extra_5 || null,
      };

      const { error } = await supabase
        .from('leader_content')
        .upsert(contentData, { onConflict: 'leader_id' });

      if (error) {
        console.error(`Error updating content for ${phone}:`, error);
        results.errors.push(`Error for ${phone}: ${error.message}`);
      } else {
        results.updated++;
      }
    }

    console.log(`Sync complete: ${results.updated} updated, ${results.skipped} skipped`);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Sync error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
