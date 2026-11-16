import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { formatWristbandCode, parseWristbandCode } from '@/lib/wristband';
import oksnoenLogo from '@/assets/oksnoen-logo.png';

/**
 * Siden QR-koden på armbåndet peker til (/b/<nummer>).
 * Innloggede ledere sendes rett til QR-siden. Alle andre ser bare at båndet
 * tilhører Oksnøen. Ingen opplysninger om deltakeren vises her.
 */
export default function Band() {
  const { code: raw } = useParams();
  const { leader, isLoading, isInitialized } = useAuth();
  const code = parseWristbandCode(raw);

  if (!isInitialized && isLoading) return null;
  if (leader && code) return <Navigate to={`/qr?kode=${code}`} replace />;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <img src={oksnoenLogo} alt="Oksnøen" className="h-20 w-20 object-contain" />
      <h1 className="text-2xl font-heading font-bold text-foreground">Oksnøen-armbånd</h1>
      {code && <p className="text-lg tabular-nums text-muted-foreground">Nr. {formatWristbandCode(code)}</p>}
      <p className="max-w-xs text-sm text-muted-foreground">
        Dette armbåndet tilhører en deltaker på Oksnøen Leir. Har du funnet det, kan du levere det til en leder.
      </p>
    </div>
  );
}
