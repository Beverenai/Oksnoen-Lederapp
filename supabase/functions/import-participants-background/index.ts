import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Declare EdgeRuntime for Deno
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedParticipant {
  firstName: string;
  lastName: string;
  birthDate: string | null;
  cabinName: string;
  room: string | null;
  timesAttended: number;
  info: string;
  imageUrl: string | null;
  hasArrived: boolean;
  activities: { activity: string; count: number }[];
}

interface ImportProgress {
  status: 'idle' | 'running' | 'done' | 'error';
  processed: number;
  total: number;
  created: number;
  updated: number;
  activitiesAdded: number;
  errors: string[];
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { participants } = await req.json() as { participants: ParsedParticipant[] };
    
    if (!participants || participants.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No participants provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting background import of ${participants.length} participants`);

    // Initialize progress
    const initialProgress: ImportProgress = {
      status: 'running',
      processed: 0,
      total: participants.length,
      created: 0,
      updated: 0,
      activitiesAdded: 0,
      errors: []
    };

    await updateProgress(supabase, initialProgress);

    // Start background processing
    EdgeRuntime.waitUntil(processParticipants(supabase, participants));

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Import started in background',
        total: participants.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error starting import:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function updateProgress(supabase: any, progress: ImportProgress) {
  const { error } = await supabase
    .from('app_config')
    .upsert({
      key: 'participant_import_progress',
      value: JSON.stringify(progress),
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });

  if (error) {
    console.error('Failed to update progress:', error);
  }
}

async function processParticipants(supabase: any, participants: ParsedParticipant[]) {
  const progress: ImportProgress = {
    status: 'running',
    processed: 0,
    total: participants.length,
    created: 0,
    updated: 0,
    activitiesAdded: 0,
    errors: []
  };

  try {
    // Fetch all cabins
    const { data: cabins } = await supabase.from('cabins').select('id, name');
    const cabinMap = new Map<string, string>((cabins || []).map((c: any) => [c.name.toLowerCase(), c.id]));

    // Find and create missing cabins
    const missingCabins = new Set<string>();
    participants.forEach(p => {
      if (!cabinMap.has(p.cabinName.toLowerCase())) {
        missingCabins.add(p.cabinName);
      }
    });

    if (missingCabins.size > 0) {
      console.log(`Creating ${missingCabins.size} missing cabins`);
      const maxSortOrder = cabins?.length || 0;
      
      const cabinsToCreate = Array.from(missingCabins).map((name, idx) => ({
        name,
        sort_order: maxSortOrder + idx + 1
      }));

      const { data: newCabins, error } = await supabase
        .from('cabins')
        .insert(cabinsToCreate)
        .select();

      if (error) {
        progress.errors.push(`Could not create cabins: ${error.message}`);
      } else if (newCabins) {
        newCabins.forEach((c: any) => cabinMap.set(c.name.toLowerCase(), c.id));
      }
    }

    // Process participants in batches
    const BATCH_SIZE = 10;
    for (let i = 0; i < participants.length; i += BATCH_SIZE) {
      const batch = participants.slice(i, Math.min(i + BATCH_SIZE, participants.length));
      
      for (const participant of batch) {
        try {
          await processParticipant(supabase, participant, cabinMap, progress);
        } catch (error) {
          console.error(`Error processing ${participant.firstName} ${participant.lastName}:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          progress.errors.push(`${participant.firstName} ${participant.lastName}: ${errorMessage}`);
        }
        progress.processed++;
      }

      // Update progress after each batch
      await updateProgress(supabase, progress);
      console.log(`Processed ${progress.processed}/${progress.total} participants`);

      // Small delay between batches to avoid overwhelming the database
      if (i + BATCH_SIZE < participants.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Mark as complete
    progress.status = 'done';
    await updateProgress(supabase, progress);
    console.log(`Import complete: ${progress.created} created, ${progress.updated} updated, ${progress.activitiesAdded} activities`);

  } catch (error) {
    console.error('Import failed:', error);
    progress.status = 'error';
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    progress.errors.push(`Import failed: ${errorMessage}`);
    await updateProgress(supabase, progress);
  }
}

async function processParticipant(
  supabase: any, 
  participant: ParsedParticipant, 
  cabinMap: Map<string, string>,
  progress: ImportProgress
) {
  const cabinId = cabinMap.get(participant.cabinName.toLowerCase());
  if (!cabinId) {
    progress.errors.push(`${participant.firstName} ${participant.lastName}: Cabin "${participant.cabinName}" not found`);
    return;
  }

  const fullName = `${participant.firstName} ${participant.lastName}`.trim();

  // Check if participant exists - first try exact name match
  let existingParticipant = null;
  
  const { data: exactMatch } = await supabase
    .from('participants')
    .select('id, birth_date')
    .ilike('name', fullName)
    .maybeSingle();

  if (exactMatch) {
    existingParticipant = exactMatch;
  } else if (participant.birthDate) {
    // If no exact match, try birth date + first name
    const { data: birthDateMatch } = await supabase
      .from('participants')
      .select('id')
      .eq('birth_date', participant.birthDate)
      .ilike('name', `%${participant.firstName}%`)
      .maybeSingle();
    existingParticipant = birthDateMatch;
  }

  if (existingParticipant) {
    // Update existing participant
    const updateData: any = {
      name: fullName,
      first_name: participant.firstName,
      last_name: participant.lastName,
      cabin_id: cabinId,
      room: participant.room,
      times_attended: participant.timesAttended,
      has_arrived: participant.hasArrived,
    };
    
    if (participant.imageUrl) updateData.image_url = participant.imageUrl;
    if (participant.info) updateData.notes = participant.info;

    const { error } = await supabase
      .from('participants')
      .update(updateData)
      .eq('id', existingParticipant.id);

    if (error) {
      progress.errors.push(`${fullName}: ${error.message}`);
      return;
    }

    progress.updated++;

    // Update or create health info
    if (participant.info) {
      await supabase
        .from('participant_health_info')
        .upsert({
          participant_id: existingParticipant.id,
          info: participant.info
        }, { onConflict: 'participant_id' });
    }

    // Handle activities
    await handleActivities(supabase, existingParticipant.id, participant.activities, progress);
    
  } else {
    // Create new participant
    const insertData = {
      name: fullName,
      first_name: participant.firstName,
      last_name: participant.lastName,
      birth_date: participant.birthDate,
      cabin_id: cabinId,
      room: participant.room,
      times_attended: participant.timesAttended,
      has_arrived: participant.hasArrived,
      image_url: participant.imageUrl || null,
      notes: participant.info || null
    };

    const { data: newParticipant, error } = await supabase
      .from('participants')
      .insert(insertData)
      .select('id')
      .single();

    if (error) {
      progress.errors.push(`${fullName}: ${error.message}`);
      return;
    }

    progress.created++;

    // Create health info if provided
    if (participant.info && newParticipant) {
      await supabase
        .from('participant_health_info')
        .insert({
          participant_id: newParticipant.id,
          info: participant.info
        });
    }

    // Handle activities
    if (newParticipant) {
      await handleActivities(supabase, newParticipant.id, participant.activities, progress);
    }
  }
}

async function handleActivities(
  supabase: any,
  participantId: string,
  activities: { activity: string; count: number }[],
  progress: ImportProgress
) {
  if (activities.length === 0) return;

  // First delete existing activities
  await supabase
    .from('participant_activities')
    .delete()
    .eq('participant_id', participantId);

  // Insert new activities
  const activitiesToInsert: { participant_id: string; activity: string }[] = [];
  for (const act of activities) {
    for (let i = 0; i < act.count; i++) {
      activitiesToInsert.push({
        participant_id: participantId,
        activity: act.activity
      });
    }
  }

  if (activitiesToInsert.length > 0) {
    const { error } = await supabase
      .from('participant_activities')
      .insert(activitiesToInsert);
    
    if (!error) {
      progress.activitiesAdded += activitiesToInsert.length;
    }
  }
}
