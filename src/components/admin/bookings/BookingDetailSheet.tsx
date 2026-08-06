import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, X } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Booking = Tables<'participant_bookings'>;
type Participant = Pick<Tables<'participants'>, 'id' | 'first_name' | 'last_name' | 'birth_date' | 'image_url'>;

interface Props {
  booking: Booking | null;
  participant: Participant | null;
  onClose: () => void;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm py-1.5 border-b border-border/40">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words">{value ?? '—'}</span>
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

export function BookingDetailSheet({ booking, participant, onClose }: Props) {
  if (!booking) return null;
  const b = booking;
  const initials = `${(b.first_name || '?')[0] || ''}${(b.last_name || '')[0] || ''}`.toUpperCase();
  const v = (x: unknown) => (x === null || x === undefined || x === '' ? '—' : String(x));

  return (
    <Sheet open={!!booking} onOpenChange={open => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg max-h-[100dvh] overflow-y-auto overscroll-contain p-0 [&>button]:hidden"
      >
        <SheetHeader
          className="sticky top-0 z-10 space-y-3 bg-background/95 backdrop-blur border-b border-border/40 px-6 pb-3"
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
          {b.status && <Badge variant="outline" className="w-fit">{b.status}</Badge>}
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
          <Section title="Foresatte">
            <Field label="Navn" value={[b.guardian_first_name, b.guardian_last_name].filter(Boolean).join(' ') || '—'} />
            <Field label="Telefon" value={b.guardian_phone ? (
              <a href={`tel:${b.guardian_phone}`} className="text-primary hover:underline inline-flex items-center gap-1">
                <Phone className="w-3 h-3" />{b.guardian_phone}
              </a>
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
        </div>
      </SheetContent>
    </Sheet>
  );
}