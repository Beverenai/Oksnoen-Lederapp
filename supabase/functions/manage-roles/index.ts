import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: 'Invalid token' }, 401);
    }

    const callerAuthId = claimsData.claims.sub;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get caller's leader record
    const { data: callerLeader } = await supabase
      .from('leaders')
      .select('id, phone')
      .eq('auth_user_id', callerAuthId)
      .maybeSingle();

    if (!callerLeader) return json({ error: 'Leader not found' }, 403);

    // Check caller's roles
    const { data: callerRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('leader_id', callerLeader.id);

    const callerRoleList = (callerRoles || []).map(r => r.role);
    const callerIsSuperAdmin = callerRoleList.includes('superadmin');
    const callerIsAdmin = callerIsSuperAdmin || callerRoleList.includes('admin');

    if (!callerIsAdmin) return json({ error: 'Admin access required' }, 403);

    const { action, leader_id, role } = await req.json();

    if (!leader_id || !action || !role) {
      return json({ error: 'Missing required fields: action, leader_id, role' }, 400);
    }

    // Never allow modifying superadmin role
    if (role === 'superadmin') {
      return json({ error: 'Cannot modify superadmin role' }, 403);
    }

    // Only superadmin can manage admin role
    if (role === 'admin' && !callerIsSuperAdmin) {
      return json({ error: 'Only superadmin can manage admin roles' }, 403);
    }

    // Protect superadmin's own roles from being removed
    const { data: targetLeader } = await supabase
      .from('leaders')
      .select('phone')
      .eq('id', leader_id)
      .maybeSingle();

    if (!targetLeader) return json({ error: 'Target leader not found' }, 404);

    const { data: targetRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('leader_id', leader_id);

    const targetIsSuperAdmin = (targetRoles || []).some(r => r.role === 'superadmin');

    // Don't allow removing roles from superadmin (except by themselves, but we block it anyway)
    if (targetIsSuperAdmin && action === 'remove') {
      return json({ error: 'Cannot modify superadmin' }, 403);
    }

    if (action === 'add') {
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({ leader_id, role })
        .select();

      if (insertError) {
        if (insertError.code === '23505') {
          return json({ success: true, message: 'Role already assigned' });
        }
        console.error('Error adding role:', insertError);
        return json({ error: 'Could not add role' }, 500);
      }

      console.log(`Role added: leader ${leader_id} -> ${role} (by ${callerLeader.id})`);
      return json({ success: true });
    }

    if (action === 'remove') {
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('leader_id', leader_id)
        .eq('role', role);

      if (deleteError) {
        console.error('Error removing role:', deleteError);
        return json({ error: 'Could not remove role' }, 500);
      }

      console.log(`Role removed: leader ${leader_id} x ${role} (by ${callerLeader.id})`);
      return json({ success: true });
    }

    if (action === 'set') {
      // Legacy: delete all non-superadmin roles, then set new one
      const { data: existingRoles } = await supabase
        .from('user_roles')
        .select('id, role')
        .eq('leader_id', leader_id);

      // Delete all except superadmin
      const toDelete = (existingRoles || []).filter(r => r.role !== 'superadmin').map(r => r.id);
      if (toDelete.length > 0) {
        await supabase.from('user_roles').delete().in('id', toDelete);
      }

      if (role === 'admin' || role === 'nurse') {
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({ leader_id, role });
        if (insertError) {
          console.error('Error setting role:', insertError);
          return json({ error: 'Could not set role' }, 500);
        }
      }

      console.log(`Role set: leader ${leader_id} -> ${role} (by ${callerLeader.id})`);
      return json({ success: true });
    }

    return json({ error: 'Invalid action. Use: add, remove, or set' }, 400);

  } catch (error) {
    console.error('Unexpected error:', error);
    return json({ error: 'Internal server error' }, 500);
  }
});
