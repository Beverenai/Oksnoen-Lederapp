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

// Teams that should NOT have cabin responsibility
const TEAMS_WITHOUT_CABIN_RESPONSIBILITY = ['kjøkken'];

// Roles that should NOT have cabin responsibility  
const ROLES_WITHOUT_CABIN_RESPONSIBILITY = ['admin', 'nurse'];

// Check if a leader should have cabin assignment based on team and role
const shouldHaveCabinAssignment = (
  team: string | undefined,
  leaderId: string,
  rolesMap: Map<string, string[]>
): boolean => {
  // Check team
  if (team && TEAMS_WITHOUT_CABIN_RESPONSIBILITY.includes(team.toLowerCase())) {
    return false;
  }
  
  // Check roles
  const roles = rolesMap.get(leaderId) || [];
  if (roles.some(role => ROLES_WITHOUT_CABIN_RESPONSIBILITY.includes(role))) {
    return false;
  }
  
  return true;
};

// Alias mapping for common cabin name variations
// Nøkkelen er normalisert alias (lowercase), verdien er array av mulige hyttenavn å søke etter
const CABIN_ALIASES: Record<string, string[]> = {
  // Bedewinds varianter
  'bedewins': ['bedewins'],
  'bedewind': ['bedewins'],
  
  // Hytter med bak/front varianter - mapper til begge så matching kan velge første
  'balder': ['balder bak', 'balder front'],
  'hulder': ['hulder bak', 'hulder front'],
  'marcusbu': ['marcusbu bak', 'marcusbu front'],
  'marcus bu': ['marcusbu bak', 'marcusbu front'],
  'beritbu': ['beritbu bak', 'beritbu front'],
  'berit bu': ['beritbu bak', 'beritbu front'],
  
  // Bestefars varianter
  'bestefars': ['bestefars kro'],
  'bestefar': ['bestefars kro'],
  
  // Seilern/Seileren varianter - mapper til hovedhytten Seileren
  'seilern': ['seileren'],
  'seiler': ['seileren'],
  'seileren': ['seileren'],
  
  // Skyss varianter
  'skyss ii+iii': ['skyss ii + iii'],
  'skyss 2+3': ['skyss ii + iii'],
  'skyss ii + iii': ['skyss ii + iii'],
  
  // Kjøkken varianter
  'kokk': ['kjøkkenhytte'],
  'the kokk': ['kjøkkenhytte'],
  'assisterende kokke': ['kjøkkenhytte'],
  'kjøkken': ['kjøkkenhytte'],
};

// Parse cabin field: "Bedewinds & Marcusbu bak" eller "Hytte1, Hytte2" -> ["Bedewinds", "Marcusbu bak"]
// Støtter: & (og), , (komma), og (ord), + (pluss - men ikke i "II+III")
const parseCabinNames = (cabinStr: string | undefined): string[] => {
  if (!cabinStr) return [];
  
  // Beskytt "II+III" og lignende ved å midlertidig erstatte
  const protectedStr = cabinStr.replace(/(\w+)\+(\w+)/g, '$1__PLUS__$2');
  
  // Splitt på &, , og "og" (som ord)
  const parts = protectedStr
    .split(/\s*[&,]\s*|\s+og\s+/i)
    .map(c => c.trim())
    .filter(Boolean);
  
  // Gjenopprett + i hyttenavn
  return parts.map(p => p.replace(/__PLUS__/g, '+'));
};

// Find matching cabin IDs with fuzzy matching and aliases
// Returnerer ALLE matchende hytter for hovedhyttenavn (f.eks. "Balder" -> ["balder bak", "balder front"])
const findCabinIds = (cabinName: string, cabinsByName: Map<string, string>): string[] => {
  // Normaliser: lowercase, trim, fjern ekstra mellomrom
  const normalized = cabinName.toLowerCase().trim().replace(/\s+/g, ' ');
  
  console.log(`Finding cabin(s) for: "${cabinName}" -> normalized: "${normalized}"`);
  
  // 1. Exact match - returner som array
  if (cabinsByName.has(normalized)) {
    console.log(`  Exact match found: ${normalized}`);
    return [cabinsByName.get(normalized)!];
  }
  
  // 2. Check aliases - returnerer ALLE matchende hytter fra alias-listen
  const aliases = CABIN_ALIASES[normalized];
  if (aliases) {
    const matchedIds: string[] = [];
    for (const alias of aliases) {
      const aliasNormalized = alias.toLowerCase();
      if (cabinsByName.has(aliasNormalized)) {
        matchedIds.push(cabinsByName.get(aliasNormalized)!);
        console.log(`  Alias match found: ${normalized} -> ${aliasNormalized}`);
      }
    }
    if (matchedIds.length > 0) {
      console.log(`  Total alias matches for "${normalized}": ${matchedIds.length} cabins`);
      return matchedIds;
    }
  }
  
  // 3. Sjekk om noen aliaser matcher deler av input (f.eks. "Hulder bak" matcher alias "hulder")
  for (const [aliasKey, aliasValues] of Object.entries(CABIN_ALIASES)) {
    if (normalized.startsWith(aliasKey)) {
      // Input starter med alias-nøkkelen, prøv å finne en mer spesifikk match
      for (const aliasValue of aliasValues) {
        const aliasNormalized = aliasValue.toLowerCase();
        if (cabinsByName.has(aliasNormalized)) {
          console.log(`  Partial alias match: ${normalized} starts with ${aliasKey} -> ${aliasNormalized}`);
          return [cabinsByName.get(aliasNormalized)!];
        }
      }
    }
  }
  
  // 4. Partial match - find cabins that start with the given name
  for (const [name, id] of cabinsByName.entries()) {
    if (name.startsWith(normalized) || normalized.startsWith(name)) {
      console.log(`  Partial match found: ${name}`);
      return [id];
    }
  }
  
  // 5. Fuzzy match - check if cabin name contains the search term
  for (const [name, id] of cabinsByName.entries()) {
    if (name.includes(normalized) || normalized.includes(name)) {
      console.log(`  Fuzzy match found: ${name}`);
      return [id];
    }
  }
  
  console.log(`  No match found for: ${normalized}`);
  return [];
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

    const rawBody = await req.json().catch((e) => {
      console.error('sync-leaders-import: failed to parse JSON body', e);
      return null;
    });
    console.log('sync-leaders-import: received body keys =', rawBody ? Object.keys(rawBody) : 'null');
    const { leaders } = (rawBody ?? {}) as { leaders?: LeaderImport[] };

    if (!leaders || !Array.isArray(leaders)) {
      console.error('sync-leaders-import: payload missing "leaders" array. Got:', JSON.stringify(rawBody)?.slice(0, 500));
      return new Response(JSON.stringify({ error: 'Invalid leaders data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`sync-leaders-import: syncing ${leaders.length} leaders. First phone:`, leaders[0]?.phone);

    // Pre-fetch all cabins for matching
    const { data: allCabins } = await supabase.from('cabins').select('id, name');
    const cabinsByName = new Map(allCabins?.map(c => [c.name.toLowerCase(), c.id]) || []);

    // Pre-fetch all user roles for checking admin/nurse
    const { data: allRoles } = await supabase.from('user_roles').select('leader_id, role');
    const rolesMap = new Map<string, string[]>();
    (allRoles || []).forEach((r: { leader_id: string; role: string }) => {
      const existing = rolesMap.get(r.leader_id) || [];
      existing.push(r.role);
      rolesMap.set(r.leader_id, existing);
    });
    console.log(`Loaded ${rolesMap.size} leaders with special roles`);

    const results = { created: 0, updated: 0, skipped: 0, cabinLinks: 0, cabinSkipped: 0, errors: [] as string[] };

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
        .select('id, last_app_edit_at, last_synced_at')
        .eq('phone', phone)
        .maybeSingle();

      let leaderId: string;
      let leaderIsDirty = false;

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
        // Dirty = edited in app since last successful sync.
        // When dirty, sheet must NOT overwrite app values (app wins).
        const lastSync = existingLeader.last_synced_at ? new Date(existingLeader.last_synced_at).getTime() : 0;
        const lastEdit = existingLeader.last_app_edit_at ? new Date(existingLeader.last_app_edit_at).getTime() : 0;
        leaderIsDirty = lastEdit > lastSync;

        // Update leader info if provided - always reactivate on sync
        const updateData: Record<string, unknown> = {
          is_active: true,  // Reactivate leader when synced
          last_synced_at: new Date().toISOString(),
        };
        if (!leaderIsDirty) {
          if (leader.name) updateData.name = leader.name;
          if (leader.email) updateData.email = leader.email;
          if (leader.team) updateData.team = leader.team;
          if (leader.cabin || leader.cabin_info) updateData.cabin = leader.cabin || leader.cabin_info;
          if (leader.ministerpost) updateData.ministerpost = leader.ministerpost;
          if (leader.age) updateData.age = leader.age;
        } else {
          console.log(`Leader ${phone} is dirty (app-edited since last sync) — preserving app fields, only marking last_synced_at`);
        }

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

      // Check if leader should have cabin assignment (excludes Kjøkken team and admin/nurse roles)
      if (shouldHaveCabinAssignment(leader.team, leaderId, rolesMap)) {
        // Parse cabin names and create leader_cabins links
        const cabinNames = parseCabinNames(leader.cabin || leader.cabin_info);
        if (cabinNames.length > 0) {
          // Compute desired cabin id set first; only delete+insert if it differs
          // from what's already in the DB. Avoids ~30 redundant writes per call.
          const desiredIds = new Set<string>();
          for (const cabinName of cabinNames) {
            const cabinIds = findCabinIds(cabinName, cabinsByName);
            if (cabinIds.length > 0) {
              for (const cid of cabinIds) desiredIds.add(cid);
            } else {
              console.log(`Cabin not found for ${leader.name}: ${cabinName} (tried fuzzy matching)`);
            }
          }

          const { data: existingLinks } = await supabase
            .from('leader_cabins')
            .select('cabin_id')
            .eq('leader_id', leaderId);
          const existingIds = new Set((existingLinks || []).map(l => l.cabin_id));

          const sameSet =
            existingIds.size === desiredIds.size &&
            [...desiredIds].every(id => existingIds.has(id));

          if (!sameSet && desiredIds.size > 0) {
            await supabase.from('leader_cabins').delete().eq('leader_id', leaderId);
            const rows = [...desiredIds].map(cabin_id => ({ leader_id: leaderId, cabin_id }));
            const { error: linkError } = await supabase.from('leader_cabins').insert(rows);
            if (!linkError) {
              results.cabinLinks += rows.length;
              console.log(`Updated ${leader.name} cabin links: ${rows.length} cabin(s)`);
            }
          }
        }
      } else {
        // Leader should NOT have cabin assignment - remove any existing links
        await supabase.from('leader_cabins').delete().eq('leader_id', leaderId);
        results.cabinSkipped++;
        console.log(`Skipped cabin assignment for ${leader.name} (team: ${leader.team}, excluded)`);
      }

      // Leader content: respect dirty flag (app wins on conflict)
      const { data: existingContent } = await supabase
        .from('leader_content')
        .select('id, last_app_edit_at, last_synced_at')
        .eq('leader_id', leaderId)
        .maybeSingle();

      const contentLastSync = existingContent?.last_synced_at ? new Date(existingContent.last_synced_at).getTime() : 0;
      const contentLastEdit = existingContent?.last_app_edit_at ? new Date(existingContent.last_app_edit_at).getTime() : 0;
      const contentDirty = !!existingContent && contentLastEdit > contentLastSync;

      const nowIso = new Date().toISOString();
      if (!existingContent) {
        // Fresh row — write everything from sheet
        const { error: contentError } = await supabase
          .from('leader_content')
          .insert({
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
            last_synced_at: nowIso,
          });
        if (contentError) {
          console.error(`Error inserting content for ${phone}:`, contentError);
          results.errors.push(`Content error for ${phone}: ${contentError.message}`);
        }
      } else if (contentDirty) {
        // App-edited since last sync — only mark synced, don't overwrite
        console.log(`Content for ${phone} dirty — preserving app values`);
        await supabase
          .from('leader_content')
          .update({ last_synced_at: nowIso })
          .eq('leader_id', leaderId);
      } else {
        // Clean — overwrite from sheet
        const { error: contentError } = await supabase
          .from('leader_content')
          .update({
            current_activity: leader.current_activity || null,
            personal_notes: leader.personal_notes || null,
            personal_message: leader.personal_message || null,
            obs_message: leader.obs_message || null,
            extra_1: leader.extra_1 || null,
            extra_2: leader.extra_2 || null,
            extra_3: leader.extra_3 || null,
            extra_4: leader.extra_4 || null,
            extra_5: leader.extra_5 || null,
            last_synced_at: nowIso,
          })
          .eq('leader_id', leaderId);
        if (contentError) {
          console.error(`Error updating content for ${phone}:`, contentError);
          results.errors.push(`Content error for ${phone}: ${contentError.message}`);
        }
      }
    }

    console.log(`Sync complete: ${results.created} created, ${results.updated} updated, ${results.cabinLinks} cabin links, ${results.cabinSkipped} cabin skipped (exempt), ${results.skipped} skipped`);

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
