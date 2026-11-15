import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatWristbandCode, wristbandUrl } from '@/lib/wristband';

interface TestCode {
  code: string;
  url: string;
  image: string;
}

/** Testark: QR-koder til utskrift på papir, for å prøve skanningen uten armbånd. */
export default function QrTestSheet() {
  const [start, setStart] = useState(90001);
  const [count, setCount] = useState(40);
  const [codes, setCodes] = useState<TestCode[]>([]);

  useEffect(() => {
    let cancelled = false;
    const safeCount = Math.max(1, Math.min(200, count || 1));
    const safeStart = Math.max(1, start || 1);
    Promise.all(
      Array.from({ length: safeCount }, async (_, i) => {
        const code = String(safeStart + i);
        const url = wristbandUrl(code);
        const image = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, width: 240 });
        return { code, url, image };
      }),
    ).then((result) => {
      if (!cancelled) setCodes(result);
    });
    return () => {
      cancelled = true;
    };
  }, [start, count]);

  return (
    <div className="space-y-4">
      <div className="space-y-3 print:hidden">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Testark for QR-kode</h1>
          <p className="text-sm text-muted-foreground">
            Skriv ut arket og bruk kodene som armbånd når dere tester. Numre fra 90001 brukes bare til testing.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm" htmlFor="qr-test-start">
            <span className="text-muted-foreground">Første nummer</span>
            <Input
              id="qr-test-start"
              type="number"
              inputMode="numeric"
              value={start}
              onChange={(e) => setStart(Number(e.target.value))}
              className="w-36"
            />
          </label>
          <label className="space-y-1 text-sm" htmlFor="qr-test-count">
            <span className="text-muted-foreground">Antall</span>
            <Input
              id="qr-test-count"
              type="number"
              inputMode="numeric"
              min={1}
              max={200}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-28"
            />
          </label>
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" />
            Skriv ut
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 print:grid-cols-5 print:gap-2">
        {codes.map((c) => (
          <div
            key={c.code}
            className="flex break-inside-avoid flex-col items-center gap-1 rounded-xl border border-border bg-white p-2 text-black"
          >
            <img src={c.image} alt={`QR-kode ${c.code}`} className="h-auto w-full" />
            <span className="text-sm font-semibold tabular-nums">{formatWristbandCode(c.code)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
