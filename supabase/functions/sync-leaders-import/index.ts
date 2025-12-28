import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeaderImport {
  phone: string;
  name?: string;
  email?: string;
  team?: string;
  cabin?: string;
  cabin_info?: string;
  ministerpost?: string;
  age?: number;
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

    const { leaders } = await req.json() as { leaders: LeaderImport[] };

    if (!leaders || !Array.isArray(leaders)) {
      return new Response(JSON.stringify({ error: 'Invalid leaders data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Syncing ${leaders.length} leaders`);

    const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

    for (const leader of leaders) {
      const phone = leader.phone?.replace(/\s/g, '');
      if (!phone) {
        results.errors.push('Skipped: missing phone');
        results.skipped++;
        continue;
      }

      // Check if leader exists
      const { data: existingLeader } = await supabase
        .from('leaders')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();

      let leaderId: string;

      if (!existingLeader) {
        // Create new leader - name is required
        if (!leader.name) {
          console.log(`Skipped ${phone}: missing name for new leader`);
          results.errors.push(`Skipped ${phone}: missing name`);
          results.skipped++;
          continue;
        }

        const { data: newLeader, error: createError } = await supabase
          .from('leaders')
          .insert({
            phone,
            name: leader.name,
            email: leader.email || null,
            team: leader.team || null,
            cabin: leader.cabin || null,
            cabin_info: leader.cabin_info || null,
            ministerpost: leader.ministerpost || null,
            age: leader.age || null,
          })
          .select('id')
          .single();

        if (createError || !newLeader) {
          console.error(`Error creating leader ${phone}:`, createError);
          results.errors.push(`Error creating ${phone}: ${createError?.message}`);
          continue;
        }

        leaderId = newLeader.id;
        results.created++;
        console.log(`Created leader: ${leader.name} (${phone})`);
      } else {
        leaderId = existingLeader.id;

        // Update leader info if provided - always reactivate on sync
        const updateData: Record<string, unknown> = {
          is_active: true,  // Reactivate leader when synced
        };
        if (leader.name) updateData.name = leader.name;
        if (leader.email) updateData.email = leader.email;
        if (leader.team) updateData.team = leader.team;
        if (leader.cabin) updateData.cabin = leader.cabin;
        if (leader.cabin_info) updateData.cabin_info = leader.cabin_info;
        if (leader.ministerpost) updateData.ministerpost = leader.ministerpost;
        if (leader.age) updateData.age = leader.age;

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from('leaders')
            .update(updateData)
            .eq('id', leaderId);

          if (updateError) {
            console.error(`Error updating leader ${phone}:`, updateError);
          }
        }
        results.updated++;
      }

      // Upsert leader content
      const contentData = {
        leader_id: leaderId,
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

      const { error: contentError } = await supabase
        .from('leader_content')
        .upsert(contentData, { onConflict: 'leader_id' });

      if (contentError) {
        console.error(`Error updating content for ${phone}:`, contentError);
        results.errors.push(`Content error for ${phone}: ${contentError.message}`);
      }
    }

    console.log(`Sync complete: ${results.created} created, ${results.updated} updated, ${results.skipped} skipped`);

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
