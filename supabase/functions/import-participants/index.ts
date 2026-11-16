import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ParticipantImport {
  fornavn: string;
  etternavn: string;
  dato: string | null;
  bilde: string | null;
  hytte: string | null;
  harAnkommet: boolean;
  tube: number;
  tretten: number;
  taubane: number;
  vannski: number;
  triatlon: number;
  klatring: number;
  skrikern: string | null;
  atte: number;
  ti: number;
  bruskasse: number;
  rappis: number;
  outboard: number;
  pilBue: number;
  styrkeproven: string | null;
  kommentarer: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Importen kjører med full databasetilgang, så bare admin får bruke den.
    const denied = await requireAdmin(req, supabase);
    if (denied) return denied;

    // Gjelder bare aktiv periode. Tidligere perioder er historikk og skal ikke røres.
    const { data: activePeriod } = await supabase
      .from('periods')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();
    if (!activePeriod) {
      return new Response(
        JSON.stringify({ error: 'Ingen aktiv periode. Velg periode før import.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const periodId: string = activePeriod.id;

    const { participants } = await req.json() as { participants: ParticipantImport[] };

    console.log(`Processing ${participants.length} participants for import`);

    // Fetch all cabins
    const { data: cabins, error: cabinsError } = await supabase
      .from('cabins')
      .select('id, name');

    if (cabinsError) {
      console.error('Error fetching cabins:', cabinsError);
      throw cabinsError;
    }

    // Create cabin name -> id mapping (case-insensitive)
    const cabinMap = new Map<string, string>();
    for (const cabin of cabins || []) {
      cabinMap.set(cabin.name.toLowerCase().trim(), cabin.id);
    }

    console.log('Cabin map created with', cabinMap.size, 'cabins');

    const results = {
      updated: 0,
      notFound: 0,
      activitiesAdded: 0,
      errors: [] as string[],
    };

    for (const p of participants) {
      const fullName = `${p.fornavn} ${p.etternavn}`.trim();
      
      // Find participant by name (case-insensitive)
      const { data: existingParticipants, error: findError } = await supabase
        .from('participants')
        .select('id, name')
        .eq('period_id', periodId)
        .ilike('name', fullName.replace(/[\\%_]/g, (c) => `\\${c}`));

      if (findError) {
        console.error(`Error finding participant ${fullName}:`, findError);
        results.errors.push(`Find error for ${fullName}: ${findError.message}`);
        continue;
      }

      if (!existingParticipants || existingParticipants.length === 0) {
        console.log(`Participant not found: ${fullName}`);
        results.notFound++;
        continue;
      }

      const participant = existingParticipants[0];
      console.log(`Updating participant: ${participant.name} (${participant.id})`);

      // Build update object
      const updateData: Record<string, unknown> = {};

      if (p.bilde) {
        updateData.image_url = p.bilde;
      }

      if (p.dato) {
        updateData.birth_date = p.dato;
      }

      updateData.has_arrived = p.harAnkommet;

      if (p.hytte) {
        const cabinId = cabinMap.get(p.hytte.toLowerCase().trim());
        if (cabinId) {
          updateData.cabin_id = cabinId;
        } else {
          console.log(`Cabin not found: ${p.hytte}`);
        }
      }

      if (p.kommentarer) {
        updateData.notes = p.kommentarer;
      }

      // Update participant
      const { error: updateError } = await supabase
        .from('participants')
        .update(updateData)
        .eq('id', participant.id);

      if (updateError) {
        console.error(`Error updating ${fullName}:`, updateError);
        results.errors.push(`Update error for ${fullName}: ${updateError.message}`);
        continue;
      }

      results.updated++;

      // Delete existing activities for this participant
      const { error: deleteActivitiesError } = await supabase
        .from('participant_activities')
        .delete()
        .eq('participant_id', participant.id);

      if (deleteActivitiesError) {
        console.error(`Error deleting activities for ${fullName}:`, deleteActivitiesError);
      }

      // Build activities array
      const activities: string[] = [];

      // Add activities based on counts (some activities can be done multiple times)
      for (let i = 0; i < p.tube; i++) activities.push('Tube');
      for (let i = 0; i < p.tretten; i++) activities.push('Tretten meter');
      for (let i = 0; i < p.taubane; i++) activities.push('Taubane');
      for (let i = 0; i < p.vannski; i++) activities.push('Vannski');
      for (let i = 0; i < p.triatlon; i++) activities.push('Triatlon');
      for (let i = 0; i < p.klatring; i++) activities.push('Klatring');
      for (let i = 0; i < p.atte; i++) activities.push('Åtte meter');
      for (let i = 0; i < p.ti; i++) activities.push('Ti meter');
      for (let i = 0; i < p.bruskasse; i++) activities.push('Bruskasse');
      for (let i = 0; i < p.rappis; i++) activities.push('Rappis');
      for (let i = 0; i < p.outboard; i++) activities.push('Outboard');
      for (let i = 0; i < p.pilBue; i++) activities.push('Pil & Bue');

      // Handle Skrikern specially
      if (p.skrikern) {
        const skrikernLower = p.skrikern.toLowerCase();
        if (skrikernLower.includes('begge') || skrikernLower === '2') {
          activities.push('Svømming til Skrikeren begge veier');
        } else if (skrikernLower.includes('en') || skrikernLower === '1' || skrikernLower === 'true') {
          activities.push('Svømming til Skrikeren en vei');
        }
      }

      // Insert activities
      if (activities.length > 0) {
        const activityRecords = activities.map(activity => ({
          participant_id: participant.id,
          activity,
        }));

        const { error: insertActivitiesError } = await supabase
          .from('participant_activities')
          .insert(activityRecords);

        if (insertActivitiesError) {
          console.error(`Error inserting activities for ${fullName}:`, insertActivitiesError);
          results.errors.push(`Activities error for ${fullName}: ${insertActivitiesError.message}`);
        } else {
          results.activitiesAdded += activities.length;
        }
      }
    }

    console.log('Import completed:', results);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Import error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Returnerer et avslag hvis den som kaller ikke er admin, ellers null.
async function requireAdmin(req: Request, supabase: any): Promise<Response | null> {
  const deny = (error: string, status: number) =>
    new Response(JSON.stringify({ error }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return deny('Unauthorized', 401);

  const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (userError || !userData?.user) return deny('Invalid token', 401);

  const { data: leader } = await supabase
    .from('leaders')
    .select('id')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle();
  if (!leader) return deny('Leader not found', 403);

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('leader_id', leader.id);
  const isAdmin = (roles || []).some((r: { role: string }) => r.role === 'admin' || r.role === 'superadmin');
  return isAdmin ? null : deny('Admin access required', 403);
}
