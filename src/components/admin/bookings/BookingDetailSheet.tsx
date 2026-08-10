import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Phone, Mail, X, Pencil, Save, Loader2, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { copyText } from '@/lib/clipboard';
import { syncBookingExtras } from '@/lib/syncBookingExtras';
import { BookingEditLog } from '@/components/admin/bookings/BookingEditLog';
import type { Tables } from '@/integrations/supabase/types';

type Booking = Tables<'participant_bookings'>;
type Participant = Pick<Tables<'participants'>, 'id' | 'first_name' | 'last_name' | 'birth_date' | 'image_url'>;

interface Props {
  booking: Booking | null;
  participant: Participant | null;
  onClose: () => void;
  /** Allow admins to edit booking fields inline */
  editable?: boolean;
  onSaved?: () => void;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm py-1.5 border-b border-border/40">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words">{value ?? '—'}</span>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  type = 'text',
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  multiline?: boolean;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm py-1.5 border-b border-border/40 items-center">
      <span className="text-muted-foreground">{label}</span>
      {multiline ? (
        <Textarea value={value} onChange={e => onChange(e.target.value)} rows={3} className="text-sm" />
      ) : (
        <Input type={type} value={value} onChange={e => onChange(e.target.value)} className="h-8 text-sm" />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-3">{title}</h3>
      <div>{children}</div>
    </div>
  );
}

type Draft = Record<string, string>;

const EDIT_FIELDS = [
  'guardian_first_name',
  'guardian_last_name',
  'guardian_phone',
  'guardian_email',
  'address',
  'postal_code',
  'postal_city',
  'times_attended',
  'sweater_size',
  'kiosk_money',
  'friends',
  'notes_info',
  'price',
  'discount',
  'prepayment',
  'payment_status',
  'payment_reference',
  'status',
] as const;

const NUMERIC_FIELDS = new Set(['times_attended', 'kiosk_money', 'price', 'discount', 'prepayment']);

export function BookingDetailSheet({ booking, participant, onClose, editable = false, onSaved }: Props) {
  const { showSuccess, showError } = useStatusPopup();
  const qc = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>({});

  useEffect(() => {
    if (!booking) return;
    const d: Draft = {};
    EDIT_FIELDS.forEach(f => {
      const v = (booking as Record<string, unknown>)[f];
      d[f] = v === null || v === undefined ? '' : String(v);
    });
    setDraft(d);
    setIsEditing(false);
  }, [booking?.id]);

  if (!booking) return null;
  const b = booking;
  const initials = `${(b.first_name || '?')[0] || ''}${(b.last_name || '')[0] || ''}`.toUpperCase();
  const v = (x: unknown) => (x === null || x === undefined || x === '' ? '—' : String(x));
  const set = (k: string) => (val: string) => setDraft(prev => ({ ...prev, [k]: val }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      EDIT_FIELDS.forEach(f => {
        const raw = (draft[f] ?? '').trim();
        if (NUMERIC_FIELDS.has(f)) {
          payload[f] = raw === '' ? null : Number(raw.replace(',', '.'));
        } else {
          payload[f] = raw === '' ? null : raw;
        }
      });
      const { error } = await supabase.from('participant_bookings').update(payload).eq('id', b.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['booking-edit-log', b.id] });
      if (b.period_id) {
        try {
          await syncBookingExtras(b.period_id);
        } catch (e) {
          console.error('syncBookingExtras failed', e);
        }
      }
      showSuccess('Bookinginfo oppdatert');
      setIsEditing(false);
      onSaved?.();
    } catch (e) {
      console.error('Error saving booking', e);
      showError('Kunne ikke lagre bookinginfo');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={!!booking} onOpenChange={open => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg max-h-[100dvh] overflow-y-auto overscroll-contain p-0 [&>button]:hidden"
      >
        <SheetHeader
          className="relative sticky top-0 z-10 space-y-3 bg-background/95 backdrop-blur border-b border-border/40 px-6 pb-3"
          style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
        >
          <div className="flex items-center gap-3 pr-10">
            <Avatar className="h-14 w-14">
              {participant?.image_url ? <AvatarImage src={participant.image_url} /> : null}
              <AvatarFallback>{initials || '?'}</AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle>{b.first_name} {b.last_name}</SheetTitle>
              <SheetDescription>
                {b.birth_date || ''} {b.gender ? `· ${b.gender}` : ''}
              </SheetDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {b.status && <Badge variant="outline" className="w-fit">{b.status}</Badge>}
            {editable && (
              isEditing ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                    Avbryt
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                    Lagre
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Rediger
                </Button>
              )
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Lukk"
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-2 bg-muted/60 text-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </SheetHeader>

        <div className="px-6 pt-2" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
          {isEditing ? (
            <>
              <Section title="Foresatte">
                <EditField label="Fornavn" value={draft.guardian_first_name || ''} onChange={set('guardian_first_name')} />
                <EditField label="Etternavn" value={draft.guardian_last_name || ''} onChange={set('guardian_last_name')} />
                <EditField label="Telefon" value={draft.guardian_phone || ''} onChange={set('guardian_phone')} />
                <EditField label="Epost" value={draft.guardian_email || ''} onChange={set('guardian_email')} type="email" />
              </Section>
              <Section title="Adresse">
                <EditField label="Adresse" value={draft.address || ''} onChange={set('address')} />
                <EditField label="Postnummer" value={draft.postal_code || ''} onChange={set('postal_code')} />
                <EditField label="Poststed" value={draft.postal_city || ''} onChange={set('postal_city')} />
              </Section>
              <Section title="Deltaker">
                <EditField label="Deltatt tidligere" value={draft.times_attended || ''} onChange={set('times_attended')} type="number" />
                <EditField label="Genser" value={draft.sweater_size || ''} onChange={set('sweater_size')} />
                <EditField label="Kioskpenger" value={draft.kiosk_money || ''} onChange={set('kiosk_money')} type="number" />
                <EditField label="Venner" value={draft.friends || ''} onChange={set('friends')} />
                <EditField label="Opplysninger" value={draft.notes_info || ''} onChange={set('notes_info')} multiline />
              </Section>
              <Section title="Betaling">
                <EditField label="Pris" value={draft.price || ''} onChange={set('price')} type="number" />
                <EditField label="Rabatt" value={draft.discount || ''} onChange={set('discount')} type="number" />
                <EditField label="Forhåndsbetaling" value={draft.prepayment || ''} onChange={set('prepayment')} type="number" />
                <EditField label="Status" value={draft.payment_status || ''} onChange={set('payment_status')} />
                <EditField label="Referanse" value={draft.payment_reference || ''} onChange={set('payment_reference')} />
              </Section>
              <Section title="Booking">
                <EditField label="Plass-status" value={draft.status || ''} onChange={set('status')} />
                <Field label="Reservasjonsnr." value={v(b.reservation_number)} />
                <Field label="Periode" value={v(b.period_label)} />
              </Section>
              <p className="text-xs text-muted-foreground pt-3">
                Kioskpenger og genserstørrelse synkroniseres til deltakerens konto når du lagrer.
              </p>
            </>
          ) : (
          <>
          <Section title="Foresatte">
            <Field label="Navn" value={[b.guardian_first_name, b.guardian_last_name].filter(Boolean).join(' ') || '—'} />
            <Field label="Telefon" value={b.guardian_phone ? (
              <span className="inline-flex items-center gap-2">
                <a href={`tel:${b.guardian_phone}`} className="text-primary hover:underline inline-flex items-center gap-1">
                  <Phone className="w-3 h-3" />{b.guardian_phone}
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  aria-label="Kopier telefonnummer"
                  onClick={async () => {
                    const ok = await copyText(b.guardian_phone || '');
                    ok ? showSuccess('Nummer kopiert') : showError('Kunne ikke kopiere');
                  }}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </span>
            ) : '—'} />
            <Field label="Epost" value={b.guardian_email ? (
              <a href={`mailto:${b.guardian_email}`} className="text-primary hover:underline inline-flex items-center gap-1">
                <Mail className="w-3 h-3" />{b.guardian_email}
              </a>
            ) : '—'} />
          </Section>

          <Section title="Adresse">
            <Field label="Adresse" value={v(b.address)} />
            <Field label="Postnummer" value={v(b.postal_code)} />
            <Field label="Poststed" value={v(b.postal_city)} />
          </Section>

          <Section title="Deltaker">
            <Field label="Deltatt tidligere" value={v(b.times_attended)} />
            <Field label="Genser" value={v(b.sweater_size)} />
            <Field label="Kioskpenger" value={v(b.kiosk_money)} />
            <Field label="Venner" value={v(b.friends)} />
            <Field label="Opplysninger" value={v(b.notes_info)} />
          </Section>

          <Section title="Betaling">
            <Field label="Pris" value={v(b.price)} />
            <Field label="Rabatt" value={v(b.discount)} />
            <Field label="Forhåndsbetaling" value={v(b.prepayment)} />
            <Field label="Status" value={v(b.payment_status)} />
            <Field label="Referanse" value={<span className="font-mono text-xs">{v(b.payment_reference)}</span>} />
            <Field label="Fakturert" value={v(b.invoiced_date)} />
            <Field label="Betalt" value={v(b.paid_date)} />
            <Field label="Kansellert" value={v(b.cancelled_date)} />
          </Section>

          <Section title="Booking">
            <Field label="Reservasjonsnr." value={v(b.reservation_number)} />
            <Field label="Kode" value={<span className="font-mono text-xs">{v(b.reservation_code)}</span>} />
            <Field label="Periode" value={v(b.period_label)} />
            <Field label="Bookingstidspunkt" value={v(b.booking_time)} />
            <Field label="Plass bekreftet" value={v(b.seat_confirmed)} />
          </Section>

          <Section title="Endringslogg">
            <BookingEditLog bookingId={b.id} />
          </Section>
          </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}