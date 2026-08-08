import { supabase } from '@/integrations/supabase/client';

export interface BookingSyncResult {
  depositsCreated: number;
  depositsUpdated: number;
  sweatersSet: number;
  matched: number;
  unmatched: string[];
}

const VALID_SIZES = new Set(['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL']);

function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normSize(s: string | null): string | null {
  if (!s) return null;
  const v = s.trim().toUpperCase();
  return VALID_SIZES.has(v) ? v : null;
}

/**
 * Reads the booking rows for a period and pushes kiosk money + sweater sizes
 * onto the matching participants. Safe to run repeatedly.
 */
export async function syncBookingExtras(periodId: string): Promise<BookingSyncResult> {
  const [bookingsRes, participantsRes, depositsRes] = await Promise.all([
    supabase
      .from('participant_bookings')
      .select('first_name, last_name, kiosk_money, sweater_size')
      .eq('period_id', periodId),
    supabase.from('participants').select('id, name').eq('period_id', periodId),
    supabase
      .from('kiosk_deposits')
      .select('id, participant_id, amount')
      .eq('period_id', periodId)
      .eq('kind', 'booking'),
  ]);
  if (bookingsRes.error) throw bookingsRes.error;
  if (participantsRes.error) throw participantsRes.error;
  if (depositsRes.error) throw depositsRes.error;

  const nameMap = new Map<string, string>();
  (participantsRes.data || []).forEach((p) => nameMap.set(normName(p.name || ''), p.id));

  const existingDeposits = new Map<string, { id: string; amount: number }>();
  (depositsRes.data || []).forEach((d) => {
    if (d.participant_id) existingDeposits.set(d.participant_id, { id: d.id, amount: Number(d.amount ?? 0) });
  });

  const unmatched: string[] = [];
  const sweaterRows: { participant_id: string; period_id: string; preordered_size: string | null }[] = [];
  const toInsert: { participant_id: string; period_id: string; amount: number; kind: string; note: string }[] = [];
  const toUpdate: { id: string; amount: number }[] = [];
  const seen = new Set<string>();
  let matched = 0;

  for (const b of bookingsRes.data || []) {
    const fullName = `${b.first_name ?? ''} ${b.last_name ?? ''}`.trim();
    if (!fullName) continue;
    const pid = nameMap.get(normName(fullName));
    if (!pid) {
      unmatched.push(fullName);
      continue;
    }
    if (seen.has(pid)) continue;
    seen.add(pid);
    matched++;

    const amount = Number(b.kiosk_money ?? 0);
    if (Number.isFinite(amount) && amount > 0) {
      const existing = existingDeposits.get(pid);
      if (!existing) {
        toInsert.push({
          participant_id: pid,
          period_id: periodId,
          amount,
          kind: 'booking',
          note: 'Kioskpenger fra booking',
        });
      } else if (existing.amount !== amount) {
        toUpdate.push({ id: existing.id, amount });
      }
    }

    const size = normSize(b.sweater_size ?? null);
    if (size) sweaterRows.push({ participant_id: pid, period_id: periodId, preordered_size: size });
  }

  if (toInsert.length) {
    const { error } = await supabase.from('kiosk_deposits').insert(toInsert);
    if (error) throw error;
  }
  for (const u of toUpdate) {
    const { error } = await supabase.from('kiosk_deposits').update({ amount: u.amount }).eq('id', u.id);
    if (error) throw error;
  }
  if (sweaterRows.length) {
    const { error } = await supabase
      .from('participant_sweaters')
      .upsert(sweaterRows, { onConflict: 'participant_id,period_id' });
    if (error) throw error;
  }

  return {
    depositsCreated: toInsert.length,
    depositsUpdated: toUpdate.length,
    sweatersSet: sweaterRows.length,
    matched,
    unmatched: Array.from(new Set(unmatched)).sort(),
  };
}
