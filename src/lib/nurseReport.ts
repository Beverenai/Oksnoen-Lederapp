import { supabase } from '@/integrations/supabase/client';

/**
 * Returns the id of the nurse report for the active period, creating it if missing.
 */
export async function getOrCreateActiveNurseReportId(leaderId?: string | null): Promise<string | null> {
  try {
    const { data: periodRow } = await supabase
      .from('periods')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();
    const pid = periodRow?.id ?? null;

    let q = supabase
      .from('nurse_reports')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1);
    if (pid) q = q.eq('period_id', pid);
    const { data: existing } = await q;
    if (existing && existing.length > 0) return existing[0].id;

    const { data: created, error } = await supabase
      .from('nurse_reports')
      .insert({ content: '', created_by: leaderId ?? null, period_id: pid })
      .select('id')
      .single();
    if (error) throw error;
    return created.id;
  } catch (e) {
    console.error('getOrCreateActiveNurseReportId failed:', e);
    return null;
  }
}
