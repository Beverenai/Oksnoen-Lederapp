import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

interface Props {
  periodId: string | null;
}

function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Group {
  key: string;
  label: string;
  hint: string;
  names: string[];
}

export function MissingBookingInfoCard({ periodId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['booking-missing-info', periodId],
    enabled: !!periodId,
    queryFn: async () => {
      const [bookings, participants, deposits, sweaters] = await Promise.all([
        supabase
          .from('participant_bookings')
          .select('first_name, last_name, status, kiosk_money, sweater_size, guardian_phone, guardian_email, birth_date')
          .eq('period_id', periodId!),
        supabase.from('participants').select('id, name, cabin_id, room, image_url, birth_date').eq('period_id', periodId!),
        supabase
          .from('kiosk_deposits')
          .select('participant_id, amount')
          .eq('period_id', periodId!)
          .eq('kind', 'booking'),
        supabase.from('participant_sweaters').select('participant_id, preordered_size').eq('period_id', periodId!),
      ]);
      if (bookings.error) throw bookings.error;
      if (participants.error) throw participants.error;
      if (deposits.error) throw deposits.error;
      if (sweaters.error) throw sweaters.error;
      return {
        bookings: bookings.data || [],
        participants: participants.data || [],
        deposits: deposits.data || [],
        sweaters: sweaters.data || [],
      };
    },
  });

  const { groups, bookingCount, participantCount } = useMemo(() => {
    if (!data) return { groups: [] as Group[], bookingCount: 0, participantCount: 0 };

    const pByName = new Map<string, (typeof data.participants)[number]>();
    data.participants.forEach(p => pByName.set(normName(p.name || ''), p));

    const depositByPid = new Map<string, number>();
    data.deposits.forEach(d => {
      if (d.participant_id) depositByPid.set(d.participant_id, Number(d.amount ?? 0));
    });
    const sweaterByPid = new Map<string, string | null>();
    data.sweaters.forEach(s => {
      if (s.participant_id) sweaterByPid.set(s.participant_id, s.preordered_size ?? null);
    });

    const relevant = data.bookings.filter(b => (b.first_name || b.last_name) && !/kansell/i.test(b.status || ''));

    const noKiosk: string[] = [];
    const kioskNotSynced: string[] = [];
    const noSweater: string[] = [];
    const noPhone: string[] = [];
    const noEmail: string[] = [];
    const noBirth: string[] = [];
    const noParticipant: string[] = [];

    for (const b of relevant) {
      const full = `${b.first_name ?? ''} ${b.last_name ?? ''}`.trim();
      const p = pByName.get(normName(full));
      const kiosk = Number(b.kiosk_money ?? 0);

      if (!p) noParticipant.push(full);
      if (!b.kiosk_money || kiosk <= 0) noKiosk.push(full);
      else if (p && !depositByPid.has(p.id)) kioskNotSynced.push(full);
      if (!b.sweater_size?.trim()) noSweater.push(full);
      else if (p && !sweaterByPid.get(p.id)) noSweater.push(`${full} (ikke synket)`);
      if (!b.guardian_phone?.trim()) noPhone.push(full);
      if (!b.guardian_email?.trim()) noEmail.push(full);
      if (!b.birth_date) noBirth.push(full);
    }

    const bookedNames = new Set(relevant.map(b => normName(`${b.first_name ?? ''} ${b.last_name ?? ''}`)));
    const noCabin: string[] = [];
    const noRoom: string[] = [];
    const noImage: string[] = [];
    const noBooking: string[] = [];
    for (const p of data.participants) {
      if (!p.cabin_id) noCabin.push(p.name);
      else if (!p.room?.trim()) noRoom.push(p.name);
      if (!p.image_url) noImage.push(p.name);
      if (!bookedNames.has(normName(p.name || ''))) noBooking.push(p.name);
    }

    const groups: Group[] = [
      { key: 'kiosk', label: 'Mangler kioskpenger i booking', hint: 'Ingen sum i «Kioskpenger»-kolonnen', names: noKiosk },
      { key: 'kiosk-sync', label: 'Kioskpenger ikke overført til Gomla', hint: 'Kjør synk-knappen over', names: kioskNotSynced },
      { key: 'sweater', label: 'Mangler genserstørrelse', hint: 'Tom «Genser»-kolonne eller ikke synket', names: noSweater },
      { key: 'phone', label: 'Mangler telefon til foresatt', hint: 'Nurse kan ikke ringe hjem', names: noPhone },
      { key: 'email', label: 'Mangler e-post til foresatt', hint: '', names: noEmail },
      { key: 'birth', label: 'Mangler fødselsdato', hint: '', names: noBirth },
      { key: 'no-participant', label: 'Booking uten deltager i appen', hint: 'Vises ikke i passkontroll', names: noParticipant },
      { key: 'no-booking', label: 'Deltager uten bookingrad', hint: 'Ingen booking-info tilgjengelig', names: noBooking },
      { key: 'cabin', label: 'Deltager uten hytte', hint: '', names: noCabin },
      { key: 'room', label: 'Deltager uten rom/side', hint: 'Hytte er satt, men ikke side', names: noRoom },
      { key: 'image', label: 'Deltager uten bilde', hint: '', names: noImage },
    ].filter(g => g.names.length > 0);

    return { groups, bookingCount: relevant.length, participantCount: data.participants.length };
  }, [data]);

  if (!periodId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" /> Mangler i booking-info
        </CardTitle>
        <CardDescription>
          {isLoading ? 'Sjekker…' : `${bookingCount} bookinger og ${participantCount} deltagere i valgt periode.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Laster…
          </div>
        ) : groups.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Alt ser komplett ut – ingen mangler funnet.
          </div>
        ) : (
          <Accordion type="multiple" className="w-full">
            {groups.map(g => (
              <AccordionItem key={g.key} value={g.key}>
                <AccordionTrigger className="text-sm">
                  <span className="flex items-center gap-2 text-left">
                    <Badge variant="secondary">{g.names.length}</Badge>
                    {g.label}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  {g.hint && <p className="text-xs text-muted-foreground mb-2">{g.hint}</p>}
                  <ul className="max-h-56 overflow-y-auto text-sm space-y-0.5">
                    {g.names.map((n, i) => (
                      <li key={`${n}-${i}`} className="text-muted-foreground">{n}</li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
