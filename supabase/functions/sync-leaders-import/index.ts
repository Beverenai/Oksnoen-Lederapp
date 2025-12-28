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

// Alias mapping for common cabin name variations
const CABIN_ALIASES: Record<string, string[]> = {
  'bedewinds': ['bedewins'],
  'bedewins': ['bedewinds'],
  'marcus bu': ['marcusbu bak', 'marcusbu front'],
  'marcusbu': ['marcusbu bak', 'marcusbu front'],
  'berit bu': ['beritbu bak', 'beritbu front'],
  'beritbu': ['beritbu bak', 'beritbu front'],
  'balder': ['balder bak', 'balder front'],
  'kokk': ['kjøkkenhytte'],
  'the kokk': ['kjøkkenhytte'],
  'assisterende kokke': ['kjøkkenhytte'],
};

// Parse cabin field: "Bedewinds & Marcusbu bak" -> ["Bedewinds", "Marcusbu bak"]
const parseCabinNames = (cabinStr: string | undefined): string[] => {
  if (!cabinStr) return [];
  return cabinStr
    .split(/\s*[&,]\s*|\s+og\s+/i)
    .map(c => c.trim())
    .filter(Boolean);
};

// Find matching cabin ID with fuzzy matching and aliases
const findCabinId = (cabinName: string, cabinsByName: Map<string, string>): string | null => {
  const normalized = cabinName.toLowerCase().trim();
  
  // 1. Exact match
  if (cabinsByName.has(normalized)) {
    return cabinsByName.get(normalized)!;
  }
  
  // 2. Check aliases
  const aliases = CABIN_ALIASES[normalized];
  if (aliases) {
    for (const alias of aliases) {
      if (cabinsByName.has(alias)) {
        return cabinsByName.get(alias)!;
      }
    }
  }
  
  // 3. Partial match - find cabins that start with the given name
  for (const [name, id] of cabinsByName.entries()) {
    if (name.startsWith(normalized) || normalized.startsWith(name)) {
      return id;
    }
  }
  
  // 4. Fuzzy match - check if cabin name contains the search term
  for (const [name, id] of cabinsByName.entries()) {
    if (name.includes(normalized) || normalized.includes(name)) {
      return id;
    }
  }
  
  return null;
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

    const { leaders } = await req.json() as { leaders: LeaderImport[] };

    if (!leaders || !Array.isArray(leaders)) {
      return new Response(JSON.stringify({ error: 'Invalid leaders data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Syncing ${leaders.length} leaders`);

    // Pre-fetch all cabins for matching
    const { data: allCabins } = await supabase.from('cabins').select('id, name');
    const cabinsByName = new Map(allCabins?.map(c => [c.name.toLowerCase(), c.id]) || []);

    const results = { created: 0, updated: 0, skipped: 0, cabinLinks: 0, errors: [] as string[] };

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
            cabin: leader.cabin || leader.cabin_info || null,
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
        if (leader.cabin || leader.cabin_info) updateData.cabin = leader.cabin || leader.cabin_info;
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

      // Parse cabin names and create leader_cabins links
      const cabinNames = parseCabinNames(leader.cabin || leader.cabin_info);
      if (cabinNames.length > 0) {
        // Delete existing leader_cabins for this leader
        await supabase.from('leader_cabins').delete().eq('leader_id', leaderId);

        // Insert new leader_cabins links using improved matching
        for (const cabinName of cabinNames) {
          const cabinId = findCabinId(cabinName, cabinsByName);
          if (cabinId) {
            const { error: linkError } = await supabase.from('leader_cabins').insert({
              leader_id: leaderId,
              cabin_id: cabinId,
            });
            if (!linkError) {
              results.cabinLinks++;
              console.log(`Linked ${leader.name} to cabin: ${cabinName} -> ${cabinId}`);
            }
          } else {
            console.log(`Cabin not found for ${leader.name}: ${cabinName} (tried fuzzy matching)`);
          }
        }
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

    console.log(`Sync complete: ${results.created} created, ${results.updated} updated, ${results.cabinLinks} cabin links, ${results.skipped} skipped`);

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
