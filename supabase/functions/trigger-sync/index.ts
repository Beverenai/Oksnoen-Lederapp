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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const correlationId = Date.now().toString()

  try {
    // Validate JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify caller is admin
    const callerAuthId = claimsData.claims.sub
    const { data: callerLeader } = await supabase.from('leaders').select('id').eq('auth_user_id', callerAuthId).maybeSingle()
    if (!callerLeader) {
      return new Response(JSON.stringify({ error: 'Leader not found' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const { data: adminRole } = await supabase.from('user_roles').select('role').eq('leader_id', callerLeader.id).eq('role', 'admin').maybeSingle()
    if (!adminRole) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    console.log(`trigger-sync [${correlationId}]: Starting (by admin ${callerLeader.id})...`)

    // Get webhook URL from app_config
    const { data: configData, error: configError } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'sync_webhook_url')
      .maybeSingle()

    if (configError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Could not fetch webhook URL', correlationId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!configData?.value) {
      return new Response(
        JSON.stringify({ success: false, error: 'No webhook URL configured', correlationId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const webhookUrl = configData.value

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        triggered_from: 'admin_panel_backend',
        correlationId,
      }),
    })

    const responseText = await response.text()
    console.log(`trigger-sync [${correlationId}]: Webhook response status:`, response.status)

    let parsedResponse: N8nErrorResponse | null = null
    try { parsedResponse = JSON.parse(responseText) } catch { /* not JSON */ }

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Webhook returned ${response.status}`,
          webhookStatus: response.status,
          webhookUrl,
          correlationId,
          rawResponse: responseText,
          n8nError: parsedResponse?.errorMessage || parsedResponse?.message || null,
          n8nStackTrace: parsedResponse?.n8nDetails?.stackTrace?.slice(0, 3) || null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    await supabase
      .from('app_config')
      .upsert({ key: 'last_sync_timestamp', value: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'key' })

    return new Response(
      JSON.stringify({ success: true, message: 'Sync triggered successfully', webhookStatus: response.status, webhookUrl, correlationId, webhookResponse: responseText }),
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
