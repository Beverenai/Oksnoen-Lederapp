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
    const body = await req.json();
    const { 
      leader_id, 
      participant_id, 
      include_health_info, 
      include_activities,
      cabin_ids,
      // Mutation operations
      action,
      update_data
    } = body;

    if (!leader_id || typeof leader_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'leader_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate that leader_id exists and is active
    const { data: leader, error: leaderError } = await supabase
      .from('leaders')
      .select('id, is_active')
      .eq('id', leader_id)
      .maybeSingle();

    if (leaderError) {
      console.error('Error validating leader:', leaderError);
      return new Response(
        JSON.stringify({ error: 'Failed to validate access' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!leader) {
      console.log('Invalid leader_id provided:', leader_id.slice(0, 8));
      return new Response(
        JSON.stringify({ error: 'Invalid leader_id' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (leader.is_active === false) {
      return new Response(
        JSON.stringify({ error: 'Leader is not active' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Participants access by leader: ${leader_id.slice(0, 8)}... action: ${action || 'read'}`);

    // Handle update action
    if (action === 'update' && participant_id && update_data) {
      const { error: updateError } = await supabase
        .from('participants')
        .update(update_data)
        .eq('id', participant_id);

      if (updateError) {
        console.error('Error updating participant:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update participant' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle activity operations
    if (action === 'add_activity' && participant_id && body.activity) {
      const { error: activityError } = await supabase
        .from('participant_activities')
        .insert({
          participant_id,
          activity: body.activity,
          registered_by: leader_id,
        });

      if (activityError) {
        console.error('Error adding activity:', activityError);
        return new Response(
          JSON.stringify({ error: 'Failed to add activity' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'remove_activity' && participant_id && body.activity) {
      const { error: activityError } = await supabase
        .from('participant_activities')
        .delete()
        .eq('participant_id', participant_id)
        .eq('activity', body.activity);

      if (activityError) {
        console.error('Error removing activity:', activityError);
        return new Response(
          JSON.stringify({ error: 'Failed to remove activity' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If fetching a specific participant
    if (participant_id) {
      const { data: participant, error } = await supabase
        .from('participants')
        .select('*, cabin:cabins(id, name)')
        .eq('id', participant_id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching participant:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch participant' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let result: any = { participant };

      // Optionally include health info
      if (include_health_info && participant) {
        const { data: healthInfo } = await supabase
          .from('participant_health_info')
          .select('*')
          .eq('participant_id', participant_id)
          .maybeSingle();
        result.healthInfo = healthInfo;
      }

      // Optionally include activities
      if (include_activities && participant) {
        const { data: activities } = await supabase
          .from('participant_activities')
          .select('*')
          .eq('participant_id', participant_id);
        result.activities = activities || [];
      }

      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch participants - optionally filter by cabin IDs
    let query = supabase
      .from('participants')
      .select('*, cabins(*), participant_activities(*)');

    if (cabin_ids && Array.isArray(cabin_ids) && cabin_ids.length > 0) {
      query = query.in('cabin_id', cabin_ids);
    }

    const { data: participants, error } = await query.order('name');

    if (error) {
      console.error('Error fetching participants:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch participants' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Optionally include all activities as a map
    let activitiesMap: Record<string, any[]> = {};
    if (include_activities && !cabin_ids) {
      const { data: allActivities } = await supabase
        .from('participant_activities')
        .select('*');
      
      if (allActivities) {
        allActivities.forEach(activity => {
          if (!activitiesMap[activity.participant_id]) {
            activitiesMap[activity.participant_id] = [];
          }
          activitiesMap[activity.participant_id].push(activity);
        });
      }
    }

    // Optionally include health info for all
    let healthInfoMap: Record<string, any> = {};
    if (include_health_info) {
      const { data: allHealthInfo } = await supabase
        .from('participant_health_info')
        .select('*');
      
      if (allHealthInfo) {
        allHealthInfo.forEach(info => {
          healthInfoMap[info.participant_id] = info;
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        participants,
        activitiesMap: include_activities ? activitiesMap : undefined,
        healthInfoMap: include_health_info ? healthInfoMap : undefined
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
