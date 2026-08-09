import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, History } from 'lucide-react';

const FIELD_LABELS: Record<string, string> = {
  guardian_first_name: 'Foresatt fornavn',
  guardian_last_name: 'Foresatt etternavn',
  guardian_phone: 'Telefon',
  guardian_email: 'Epost',
  address: 'Adresse',
  postal_code: 'Postnummer',
  postal_city: 'Poststed',
  times_attended: 'Deltatt tidligere',
  sweater_size: 'Genser',
  kiosk_money: 'Kioskpenger',
  friends: 'Venner',
  notes_info: 'Opplysninger',
  price: 'Pris',
  discount: 'Rabatt',
  prepayment: 'Forhåndsbetaling',
  payment_status: 'Betalingsstatus',
  payment_reference: 'Referanse',
  status: 'Plass-status',
};

export function BookingEditLog({ bookingId }: { bookingId: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['booking-edit-log', bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_edit_log')
        .select('id, field_name, old_value, new_value, changed_by_name, created_at')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return <div className="py-3 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  }
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">Ingen endringer registrert.</p>;
  }

  return (
    <div className="space-y-2 py-1">
      {data.map(row => (
        <div key={row.id} className="text-sm border-b border-border/40 pb-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <History className="w-3 h-3" />
            <span>{new Date(row.created_at).toLocaleString('nb-NO')}</span>
            {row.changed_by_name && <span>· {row.changed_by_name}</span>}
          </div>
          <div className="mt-0.5">
            <span className="font-medium">{FIELD_LABELS[row.field_name] || row.field_name}: </span>
            <span className="line-through text-muted-foreground break-words">{row.old_value || '—'}</span>
            <span className="mx-1">→</span>
            <span className="break-words">{row.new_value || '—'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
