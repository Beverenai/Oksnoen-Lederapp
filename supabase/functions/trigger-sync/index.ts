import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface N8nErrorResponse {
  errorMessage?: string;
  errorDetails?: Record<string, unknown>;
  n8nDetails?: {
    n8nVersion?: string;
    stackTrace?: string[];
  };
  code?: number;
  message?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const correlationId = Date.now().toString()
  console.log(`trigger-sync [${correlationId}]: Starting...`)

  try {
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
      console.error(`trigger-sync [${correlationId}]: Error fetching webhook URL:`, configError)
      return new Response(
        JSON.stringify({ success: false, error: 'Could not fetch webhook URL', correlationId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!configData?.value) {
      console.log(`trigger-sync [${correlationId}]: No webhook URL configured`)
      return new Response(
        JSON.stringify({ success: false, error: 'No webhook URL configured', correlationId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const webhookUrl = configData.value
    console.log(`trigger-sync [${correlationId}]: Calling webhook:`, webhookUrl)

    // Call the n8n webhook from server-side (no CORS issues)
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        triggered_from: 'admin_panel_backend',
        correlationId,
      }),
    })

    const responseText = await response.text()
    console.log(`trigger-sync [${correlationId}]: Webhook response status:`, response.status)
    console.log(`trigger-sync [${correlationId}]: Webhook response body:`, responseText)

    // Try to parse as JSON for better error details
    let parsedResponse: N8nErrorResponse | null = null
    try {
      parsedResponse = JSON.parse(responseText)
    } catch {
      // Not JSON, that's fine
    }

    if (!response.ok) {
      const errorDetails = {
        success: false,
        error: `Webhook returned ${response.status}`,
        webhookStatus: response.status,
        webhookUrl,
        correlationId,
        rawResponse: responseText,
        n8nError: parsedResponse?.errorMessage || parsedResponse?.message || null,
        n8nStackTrace: parsedResponse?.n8nDetails?.stackTrace?.slice(0, 3) || null,
      }
      
      console.error(`trigger-sync [${correlationId}]: Webhook failed:`, errorDetails)
      
      return new Response(
        JSON.stringify(errorDetails),
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
        webhookUrl,
        correlationId,
        webhookResponse: responseText
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error(`trigger-sync [${correlationId}]: Error:`, error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, correlationId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
