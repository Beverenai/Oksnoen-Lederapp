import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivePeriodId } from '@/hooks/useActivePeriodId';
import { useStatusPopup } from '@/hooks/useStatusPopup';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Phone, Mail, Loader2, Trash2 } from 'lucide-react';
import { BookingImportCard } from '@/components/admin/bookings/BookingImportCard';
import { BookingDetailSheet } from '@/components/admin/bookings/BookingDetailSheet';
import type { Tables } from '@/integrations/supabase/types';

type Booking = Tables<'participant_bookings'>;
type Participant = Pick<Tables<'participants'>, 'id' | 'first_name' | 'last_name' | 'birth_date' | 'image_url'>;

export function BookingsTab() {
  const { data: activePeriodId } = useActivePeriodId();
  const qc = useQueryClient();
  const { showSuccess, showError } = useStatusPopup();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Booking | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [mailOpen, setMailOpen] = useState(false);

  const periodId = selectedPeriodId ?? activePeriodId ?? null;

  const { data: periods = [] } = useQuery({
    queryKey: ['periods-for-bookings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('periods')
        .select('id, name, slug, is_active')
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['participant-bookings', periodId],
    enabled: !!periodId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('participant_bookings')
        .select('*')
        .eq('period_id', periodId!)
        .order('last_name', { ascending: true });
      if (error) throw error;
      return (data || []) as Booking[];
    },
  });

  const { data: participants = [] } = useQuery({
    queryKey: ['participants-for-bookings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('participants')
        .select('id, first_name, last_name, birth_date, image_url');
      if (error) throw error;
      return (data || []) as Participant[];
    },
  });

  const participantByKey = useMemo(() => {
    const m = new Map<string, Participant>();
    for (const p of participants) {
      const key = `${(p.first_name || '').toLowerCase().trim()}|${(p.last_name || '').toLowerCase().trim()}|${p.birth_date || ''}`;
      m.set(key, p);
    }
    return m;
  }, [participants]);

  const enriched = useMemo(() => {
    return bookings.map(b => {
      const key = `${(b.first_name || '').toLowerCase().trim()}|${(b.last_name || '').toLowerCase().trim()}|${b.birth_date || ''}`;
      return { booking: b, participant: participantByKey.get(key) || null };
    });
  }, [bookings, participantByKey]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return enriched;
    return enriched.filter(({ booking: b }) =>
      [b.first_name, b.last_name, b.guardian_first_name, b.guardian_last_name,
       b.guardian_phone, b.guardian_email, b.reservation_number, b.reservation_code,
       b.postal_city]
        .some(v => (v || '').toString().toLowerCase().includes(q))
    );
  }, [enriched, search]);

  const unmatched = useMemo(() => filtered.filter(e => !e.participant), [filtered]);

  const currentPeriod = periods.find(p => p.id === periodId) || null;
  const parentEmails = useMemo(() => {
    const set = new Set<string>();
    for (const b of bookings) {
      const e = (b.guardian_email || '').trim();
      if (e && /.+@.+\..+/.test(e)) set.add(e);
    }
    return Array.from(set).sort();
  }, [bookings]);
  const mailSubject = currentPeriod ? `Gjenglemt på Øksnøen – ${currentPeriod.name}` : 'Gjenglemt på Øksnøen';
  const publicUrl = currentPeriod ? `https://app.oksnoen.com/gjenglemt/${currentPeriod.slug}` : '';
  const mailBody = [
    'Hei,',
    '',
    `Hvis deltakeren din har glemt igjen noe på Øksnøen (${currentPeriod?.name || ''}), kan dere se alle gjenglemte ting her:`,
    publicUrl,
    '',
    'Passord for å åpne siden: 2026',
    '',
    'Finner dere noe dere kjenner igjen, send en epost til bengt@oksnoen.no med artikkelnummeret og navn på deltaker. Dere kan enten hente det på Øksnøen, eller få det tilsendt på egen regning.',
    '',
    'Vennlig hilsen,',
    'Øksnøen',
  ].join('\n');
  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); showSuccess(`${label} kopiert`); }
    catch { showError('Kunne ikke kopiere'); }
  };

  const handleDeleteAll = async () => {
    if (!periodId) return;
    if (!confirm('Slett ALLE booking-rader for valgt periode?')) return;
    setIsDeleting(true);
    const { error } = await supabase.from('participant_bookings').delete().eq('period_id', periodId);
    setIsDeleting(false);
    if (error) { showError('Sletting feilet'); return; }
    showSuccess('Slettet');
    qc.invalidateQueries({ queryKey: ['participant-bookings', periodId] });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-3 flex items-center gap-3">
          <span className="text-sm font-medium shrink-0">Periode</span>
          <Select value={periodId ?? ''} onValueChange={v => setSelectedPeriodId(v)}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Velg periode" /></SelectTrigger>
            <SelectContent>
              {periods.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}{p.is_active ? ' (aktiv)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <BookingImportCard periodId={periodId || null} onImported={() => qc.invalidateQueries({ queryKey: ['participant-bookings', periodId] })} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span>Bookinger ({bookings.length})</span>
            <div className="flex items-center gap-1">
              {parentEmails.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setMailOpen(true)} className="gap-1">
                  <Send className="w-3.5 h-3.5" /> Epost til foreldre ({parentEmails.length})
                </Button>
              )}
              {bookings.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleDeleteAll} disabled={isDeleting}>
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </Button>
              )}
            </div>
          </CardTitle>
          <CardDescription>Knyttet til valgt periode. Foresatte-kontakt er kun synlig her.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Søk navn, foresatt, telefon, epost..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <Tabs defaultValue="all" className="w-full">
              <TabsList>
                <TabsTrigger value="all">Alle ({filtered.length})</TabsTrigger>
                <TabsTrigger value="unmatched">Ikke matchet ({unmatched.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="mt-4">
                <BookingList rows={filtered} onSelect={setSelected} />
              </TabsContent>
              <TabsContent value="unmatched" className="mt-4">
                <BookingList rows={unmatched} onSelect={setSelected} />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <BookingDetailSheet
        booking={selected}
        participant={selected ? participantByKey.get(`${(selected.first_name || '').toLowerCase().trim()}|${(selected.last_name || '').toLowerCase().trim()}|${selected.birth_date || ''}`) || null : null}
        onClose={() => setSelected(null)}
      />

      <Dialog open={mailOpen} onOpenChange={setMailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send epost til alle foreldre</DialogTitle>
            <DialogDescription>
              {parentEmails.length} unike foreldre-eposter i {currentPeriod?.name || 'valgt periode'}. Lim inn i BCC i din egen epostklient.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium">BCC (alle foreldre)</label>
                <Button size="sm" variant="ghost" className="gap-1" onClick={() => copy(parentEmails.join(', '), 'BCC')}><Copy className="w-3.5 h-3.5" />Kopier</Button>
              </div>
              <Textarea readOnly value={parentEmails.join(', ')} className="font-mono text-xs h-24" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium">Emne</label>
                <Button size="sm" variant="ghost" className="gap-1" onClick={() => copy(mailSubject, 'Emne')}><Copy className="w-3.5 h-3.5" />Kopier</Button>
              </div>
              <Input readOnly value={mailSubject} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium">Melding</label>
                <Button size="sm" variant="ghost" className="gap-1" onClick={() => copy(mailBody, 'Melding')}><Copy className="w-3.5 h-3.5" />Kopier</Button>
              </div>
              <Textarea readOnly value={mailBody} className="h-56 text-sm" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMailOpen(false)}>Lukk</Button>
            <Button asChild>
              <a href={`mailto:?bcc=${encodeURIComponent(parentEmails.join(','))}&subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`}>
                Åpne i epostklient
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BookingList({ rows, onSelect }: { rows: { booking: Booking; participant: Participant | null }[]; onSelect: (b: Booking) => void }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Ingen bookinger</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-2 px-2"></th>
            <th className="py-2 px-2 font-medium">Deltaker</th>
            <th className="py-2 px-2 font-medium">Foresatt</th>
            <th className="py-2 px-2 font-medium">Telefon</th>
            <th className="py-2 px-2 font-medium">Epost</th>
            <th className="py-2 px-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(({ booking: b, participant: p }) => {
            const initials = `${(b.first_name || '?')[0] || ''}${(b.last_name || '')[0] || ''}`.toUpperCase();
            return (
              <tr key={b.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => onSelect(b)}>
                <td className="py-2 px-2">
                  <Avatar className="h-9 w-9">
                    {p?.image_url ? <AvatarImage src={p.image_url} /> : null}
                    <AvatarFallback className="text-xs">{initials || '?'}</AvatarFallback>
                  </Avatar>
                </td>
                <td className="py-2 px-2">
                  <div className="font-medium">{b.first_name} {b.last_name}</div>
                  <div className="text-xs text-muted-foreground">{b.birth_date || '—'}</div>
                </td>
                <td className="py-2 px-2">{[b.guardian_first_name, b.guardian_last_name].filter(Boolean).join(' ') || '—'}</td>
                <td className="py-2 px-2">
                  {b.guardian_phone ? (
                    <a href={`tel:${b.guardian_phone}`} onClick={e => e.stopPropagation()} className="text-primary hover:underline inline-flex items-center gap-1">
                      <Phone className="w-3 h-3" />{b.guardian_phone}
                    </a>
                  ) : '—'}
                </td>
                <td className="py-2 px-2">
                  {b.guardian_email ? (
                    <a href={`mailto:${b.guardian_email}`} onClick={e => e.stopPropagation()} className="text-primary hover:underline inline-flex items-center gap-1 max-w-[200px] truncate">
                      <Mail className="w-3 h-3 shrink-0" /><span className="truncate">{b.guardian_email}</span>
                    </a>
                  ) : '—'}
                </td>
                <td className="py-2 px-2">
                  {b.status ? <Badge variant="outline" className="text-xs">{b.status}</Badge> : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}