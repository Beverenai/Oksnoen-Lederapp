import { useNavigate } from 'react-router-dom';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Share, MoreVertical, Plus, Smartphone } from 'lucide-react';

export default function Install() {
  const navigate = useNavigate();
  const { isInstallable, promptInstall, declineInstall, isIOS, isAndroid } = usePWAInstall();

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (installed) {
      navigate('/login');
    }
  };

  const handleSkip = () => {
    declineInstall();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <div className="min-h-screen flex flex-col items-center justify-center p-4 pt-safe">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center space-y-4">
          <img 
            src="/oksnoen-logo.png" 
            alt="Oksnøen Logo" 
            className="w-24 h-24 rounded-2xl shadow-lg"
          />
          <h1 className="text-2xl font-bold text-foreground">Oksnøen Leder App</h1>
        </div>

        {/* Install Card */}
        <Card className="border-2 border-primary/20">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              Installer appen
            </CardTitle>
            <CardDescription>
              For beste opplevelse, installer appen på din enhet
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Android / Chrome Install Button */}
            {isInstallable && (
              <Button 
                onClick={handleInstall} 
                className="w-full gap-2"
                size="lg"
              >
                <Download className="w-5 h-5" />
                Installer nå
              </Button>
            )}

            {/* iOS Instructions */}
            {isIOS && (
              <div className="space-y-4 p-4 bg-muted rounded-lg">
                <p className="font-medium text-center">Slik installerer du på iPhone/iPad:</p>
                <ol className="space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                    <span className="flex items-center gap-2">
                      Trykk på <Share className="w-4 h-4 text-primary" /> Del-ikonet nederst
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                    <span>Scroll ned og velg "Legg til på Hjem-skjerm"</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                    <span className="flex items-center gap-2">
                      Trykk <Plus className="w-4 h-4 text-primary" /> Legg til
                    </span>
                  </li>
                </ol>
              </div>
            )}

            {/* Android Instructions (when not installable via prompt) */}
            {isAndroid && !isInstallable && (
              <div className="space-y-4 p-4 bg-muted rounded-lg">
                <p className="font-medium text-center">Slik installerer du på Android:</p>
                <ol className="space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                    <span className="flex items-center gap-2">
                      Trykk på <MoreVertical className="w-4 h-4 text-primary" /> menyen øverst til høyre
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                    <span>Velg "Installer app" eller "Legg til på startskjerm"</span>
                  </li>
                </ol>
              </div>
            )}

            {/* Desktop Instructions */}
            {!isIOS && !isAndroid && !isInstallable && (
              <div className="space-y-4 p-4 bg-muted rounded-lg">
                <p className="font-medium text-center">Installer fra adressefeltet</p>
                <p className="text-sm text-muted-foreground text-center">
                  Se etter et installasjonsikon i adressefeltet til nettleseren din
                </p>
              </div>
            )}

            {/* Skip Button */}
            <Button 
              variant="ghost" 
              onClick={handleSkip}
              className="w-full text-muted-foreground"
            >
              Fortsett uten å installere
            </Button>
          </CardContent>
        </Card>

        {/* Benefits */}
        <div className="text-center text-sm text-muted-foreground space-y-1">
          <p>✓ Fungerer offline</p>
          <p>✓ Raskere oppstart</p>
          <p>✓ Fullskjermsvisning</p>
        </div>
        </div>
      </div>
    </div>
  );
}
