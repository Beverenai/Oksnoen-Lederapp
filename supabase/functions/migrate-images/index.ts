import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get request body for options
    let batchSize = 10;
    let dryRun = false;
    try {
      const body = await req.json();
      batchSize = body.batch_size || 10;
      dryRun = body.dry_run || false;
    } catch {
      // Use defaults if no body
    }

    console.log(`Starting image migration (batch_size: ${batchSize}, dry_run: ${dryRun})`);

    // Find all participants with Glide URLs
    const { data: participants, error: fetchError } = await supabase
      .from('participants')
      .select('id, name, image_url')
      .not('image_url', 'is', null)
      .ilike('image_url', '%glide%')
      .limit(batchSize);

    if (fetchError) {
      console.error('Error fetching participants:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${participants?.length || 0} participants with Glide images`);

    if (!participants || participants.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No Glide images to migrate',
          migrated: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      migrated: 0,
      failed: 0,
      skipped: 0,
      details: [] as { id: string; name: string; status: string; error?: string }[],
    };

    for (const participant of participants) {
      try {
        const glideUrl = participant.image_url;
        console.log(`Processing ${participant.name} (${participant.id}): ${glideUrl}`);

        if (dryRun) {
          results.details.push({
            id: participant.id,
            name: participant.name,
            status: 'would_migrate',
          });
          results.skipped++;
          continue;
        }

        // Download image from Glide
        const imageResponse = await fetch(glideUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to download image: ${imageResponse.status}`);
        }

        const imageBlob = await imageResponse.blob();
        const imageBuffer = await imageBlob.arrayBuffer();
        const imageUint8 = new Uint8Array(imageBuffer);

        console.log(`Downloaded image: ${(imageBlob.size / 1024).toFixed(1)}KB`);

        // Upload to Supabase Storage
        const fileName = `${participant.id}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('participant-images')
          .upload(fileName, imageUint8, {
            upsert: true,
            contentType: 'image/jpeg',
          });

        if (uploadError) {
          throw uploadError;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('participant-images')
          .getPublicUrl(fileName);

        // Add timestamp to bust cache
        const imageUrlWithTimestamp = `${publicUrl}?t=${Date.now()}`;

        // Update participant record
        const { error: updateError } = await supabase
          .from('participants')
          .update({ image_url: imageUrlWithTimestamp })
          .eq('id', participant.id);

        if (updateError) {
          throw updateError;
        }

        console.log(`Successfully migrated ${participant.name}`);
        results.migrated++;
        results.details.push({
          id: participant.id,
          name: participant.name,
          status: 'migrated',
        });

      } catch (error) {
        console.error(`Failed to migrate ${participant.name}:`, error);
        results.failed++;
        results.details.push({
          id: participant.id,
          name: participant.name,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Check if there are more to migrate
    const { count } = await supabase
      .from('participants')
      .select('id', { count: 'exact', head: true })
      .not('image_url', 'is', null)
      .ilike('image_url', '%glide%');

    console.log(`Migration batch complete. Remaining: ${count || 0}`);

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
        remaining: count || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Migration error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
