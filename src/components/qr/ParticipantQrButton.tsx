import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { hapticError, hapticSuccess } from '@/lib/capacitorHaptics';
import { formatWristbandCode, wristbandUrl } from '@/lib/wristband';

interface Props {
  participantId: string;
  participantName: string;
  disabled?: boolean;
}

// Testnumre starter her, så de aldri blandes med ekte armbånd.
const TEST_START = 90001;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/**
 * Viser deltakerens QR-kode på skjermen. Har deltakeren ikke bånd, kan man gi
 * et testnummer, slik at skanningen kan prøves fra en annen telefon uten utskrift.
 */
export function ParticipantQrButton({ participantId, participantName, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await db
      .from('wristband_assignments')
      .select('code')
      .eq('participant_id', participantId)
      .is('released_at', null)
      .maybeSingle();
    if (err) setError('QR-kode er ikke klar i databasen ennå.');
    setCode(data?.code ?? null);
    setLoading(false);
  }, [participantId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (!code) {
      setImage(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(wristbandUrl(code), { errorCorrectionLevel: 'M', margin: 2, width: 560 }).then((url) => {
      if (!cancelled) setImage(url);
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const giveTestNumber = async () => {
    setBusy(true);
    setError(null);
    try {
      // Neste ledige testnummer: ett høyere enn det høyeste som er brukt.
      const { data: used, error: usedErr } = await db
        .from('wristband_assignments')
        .select('code')
        .gte('code', String(TEST_START))
        .limit(5000);
      if (usedErr) throw usedErr;
      const highest = ((used ?? []) as { code: string }[])
        .map((r) => Number(r.code))
        .filter((n) => Number.isFinite(n) && n >= TEST_START && n < 100000)
        .reduce((max, n) => Math.max(max, n), TEST_START - 1);

      let next = highest + 1;
      for (let attempt = 0; attempt < 5; attempt++, next++) {
        const { data, error: rpcErr } = await db.rpc('assign_wristband', {
          _participant_id: participantId,
          _code: String(next),
          _force: false,
        });
        if (rpcErr) throw rpcErr;
        if (data?.status !== 'opptatt') {
          hapticSuccess();
          setCode(String(next));
          return;
        }
      }
      throw new Error('Fant ikke et ledig testnummer');
    } catch (err) {
      hapticError();
      setError((err as Error)?.message ?? 'Kunne ikke lage testnummer');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    const { error: rpcErr } = await db.rpc('release_wristband', { _participant_id: participantId, _reason: 'feil' });
    if (rpcErr) {
      hapticError();
      setError(rpcErr.message);
    } else {
      setCode(null);
    }
    setBusy(false);
  };

  return (
    <>
      <Button variant="outline" className="w-full" disabled={disabled} onClick={() => setOpen(true)}>
        <QrCode className="h-4 w-4 mr-2 text-primary" />
        QR-kode
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>{participantName}</DialogTitle>
            <DialogDescription>
              {code ? 'Skann denne koden fra en annen telefon.' : 'Deltakeren har ikke noe bånd ennå.'}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Henter…</p>
          ) : code ? (
            <div className="space-y-3">
              <div className="rounded-2xl bg-white p-3">
                {image && <img src={image} alt={`QR-kode ${formatWristbandCode(code)}`} className="h-auto w-full" />}
              </div>
              <p className="text-center text-2xl font-bold tabular-nums">{formatWristbandCode(code)}</p>
              {Number(code) >= TEST_START && (
                <p className="text-center text-xs text-muted-foreground">Testnummer</p>
              )}
              <Button variant="ghost" className="w-full text-destructive" disabled={busy} onClick={remove}>
                Fjern båndet
              </Button>
            </div>
          ) : (
            <Button className="w-full" disabled={busy || !!error} onClick={giveTestNumber}>
              Gi testnummer
            </Button>
          )}

          {error && <p className="text-center text-sm text-destructive">{error}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
