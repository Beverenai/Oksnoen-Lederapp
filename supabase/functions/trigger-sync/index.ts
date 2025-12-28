import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('trigger-sync: Starting...')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get webhook URL from app_config
    const { data: configData, error: configError } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'sync_webhook_url')
      .maybeSingle()

    if (configError) {
      console.error('trigger-sync: Error fetching webhook URL:', configError)
      return new Response(
        JSON.stringify({ success: false, error: 'Could not fetch webhook URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!configData?.value) {
      console.log('trigger-sync: No webhook URL configured')
      return new Response(
        JSON.stringify({ success: false, error: 'No webhook URL configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const webhookUrl = configData.value
    console.log('trigger-sync: Calling webhook:', webhookUrl)

    // Call the n8n webhook from server-side (no CORS issues)
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        triggered_from: 'admin_panel_backend',
      }),
    })

    const responseText = await response.text()
    console.log('trigger-sync: Webhook response status:', response.status)
    console.log('trigger-sync: Webhook response body:', responseText)

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Webhook returned ${response.status}`,
          details: responseText 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update last sync timestamp
    await supabase
      .from('app_config')
      .upsert({ 
        key: 'last_sync_timestamp', 
        value: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' })

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Sync triggered successfully',
        webhookStatus: response.status,
        webhookResponse: responseText
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('trigger-sync: Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
