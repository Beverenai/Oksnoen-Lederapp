import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    console.log(`trigger-export [${correlationId}]: Starting (by admin ${callerLeader.id})...`)

    const { data: configData, error: configError } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'export_webhook_url')
      .maybeSingle()

    if (configError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Could not fetch export webhook URL', correlationId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!configData?.value) {
      return new Response(
        JSON.stringify({ success: false, error: 'No export webhook URL configured', correlationId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const exportWebhookUrl = configData.value

    const { data: leaders, error: leadersError } = await supabase
      .from('leaders')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (leadersError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Could not fetch leaders', correlationId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: contents } = await supabase.from('leader_content').select('*')
    const contentMap = new Map(contents?.map(c => [c.leader_id, c]) || [])

    const exportData = leaders?.map(leader => {
      const content = contentMap.get(leader.id)
      return {
        phone: leader.phone,
        name: leader.name,
        cabin_info: leader.cabin || leader.cabin_info || '',
        ministerpost: leader.ministerpost,
        team: leader.team,
        current_activity: content?.current_activity || '',
        extra_activity: content?.extra_activity || '',
        personal_notes: content?.personal_notes || '',
        obs_message: content?.obs_message || '',
        extra_1: content?.extra_1 || '',
        extra_2: content?.extra_2 || '',
        extra_3: content?.extra_3 || '',
        extra_4: content?.extra_4 || '',
        extra_5: content?.extra_5 || '',
      }
    }) || []

    const response = await fetch(exportWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        triggered_from: 'admin_panel_export',
        correlationId,
        leaders: exportData,
      }),
    })

    const responseText = await response.text()

    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `Export webhook returned ${response.status}`, webhookStatus: response.status, correlationId, rawResponse: responseText }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    await supabase
      .from('app_config')
      .upsert({ key: 'last_export_timestamp', value: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'key' })

    return new Response(
      JSON.stringify({ success: true, message: `Exported ${exportData.length} leaders to Google Sheets`, webhookStatus: response.status, correlationId, leadersExported: exportData.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error(`trigger-export [${correlationId}]: Error:`, error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, correlationId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
