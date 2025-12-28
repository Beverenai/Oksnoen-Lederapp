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

  const correlationId = Date.now().toString()
  console.log(`trigger-export [${correlationId}]: Starting...`)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get export webhook URL from app_config
    const { data: configData, error: configError } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'export_webhook_url')
      .maybeSingle()

    if (configError) {
      console.error(`trigger-export [${correlationId}]: Error fetching webhook URL:`, configError)
      return new Response(
        JSON.stringify({ success: false, error: 'Could not fetch export webhook URL', correlationId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!configData?.value) {
      console.log(`trigger-export [${correlationId}]: No export webhook URL configured`)
      return new Response(
        JSON.stringify({ success: false, error: 'No export webhook URL configured', correlationId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const exportWebhookUrl = configData.value
    console.log(`trigger-export [${correlationId}]: Fetching leaders for export...`)

    // Fetch all leaders with their content
    const { data: leaders, error: leadersError } = await supabase
      .from('leaders')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (leadersError) {
      console.error(`trigger-export [${correlationId}]: Error fetching leaders:`, leadersError)
      return new Response(
        JSON.stringify({ success: false, error: 'Could not fetch leaders', correlationId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: contents } = await supabase
      .from('leader_content')
      .select('*')

    const contentMap = new Map(contents?.map(c => [c.leader_id, c]) || [])

    // Build export data
    const exportData = leaders?.map(leader => {
      const content = contentMap.get(leader.id)
      return {
        phone: leader.phone,
        name: leader.name,
        cabin_info: leader.cabin_info,
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

    console.log(`trigger-export [${correlationId}]: Exporting ${exportData.length} leaders to webhook...`)

    // Send to n8n webhook
    const response = await fetch(exportWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        triggered_from: 'admin_panel_export',
        correlationId,
        leaders: exportData,
      }),
    })

    const responseText = await response.text()
    console.log(`trigger-export [${correlationId}]: Webhook response status:`, response.status)
    console.log(`trigger-export [${correlationId}]: Webhook response body:`, responseText)

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Export webhook returned ${response.status}`,
          webhookStatus: response.status,
          correlationId,
          rawResponse: responseText
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update last export timestamp
    await supabase
      .from('app_config')
      .upsert({ 
        key: 'last_export_timestamp', 
        value: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' })

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Exported ${exportData.length} leaders to Google Sheets`,
        webhookStatus: response.status,
        correlationId,
        leadersExported: exportData.length
      }),
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
