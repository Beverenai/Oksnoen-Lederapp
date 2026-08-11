import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Loader2, PauseCircle } from 'lucide-react';
import oksnoenLogo from '@/assets/oksnoen-logo.png';
import { hapticError } from '@/lib/capacitorHaptics';
import { PinPad } from '@/components/auth/PinPad';

const PIN_LENGTH = 4;

export default function Login() {
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inactiveState, setInactiveState] = useState(false);
  const [pinStep, setPinStep] = useState<'none' | 'enter' | 'create' | 'confirm'>('none');
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [shake, setShake] = useState(false);
  const [adminName, setAdminName] = useState<string | null>(null);
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const { login, deactivatedMessage } = useAuth();
  const navigate = useNavigate();

  // Show deactivated message if user was auto-logged out
  const showDeactivated = inactiveState || !!deactivatedMessage;

  const triggerShake = () => {
    hapticError();
    setShake(true);
    window.setTimeout(() => setShake(false), 450);
  };

  const handleResult = (result: Awaited<ReturnType<typeof login>>) => {
    if (result.success) {
      navigate('/');
      return;
    }
    if (result.error === 'PIN_REQUIRED') {
      setAdminName(result.name ?? null);
      setPin('');
      setPinStep('enter');
      return;
    }
    if (result.error === 'PIN_SETUP_REQUIRED') {
      setAdminName(result.name ?? null);
      setPin('');
      setFirstPin('');
      setPinStep('create');
      return;
    }
    if (result.error === 'WRONG_PIN') {
      setPin('');
      triggerShake();
      showError('Feil PIN-kode', 'Prøv igjen, eller kontakt admin for å nullstille.');
      return;
    }
    if (result.error === 'INVALID_PIN_FORMAT') {
      setPin('');
      triggerShake();
      showError('Ugyldig PIN', 'PIN-koden må være 4–6 siffer.');
      return;
    }
    if (result.error === 'INACTIVE_LEADER') {
      setInactiveState(true);
      return;
    }
    showError(result.message || result.error || 'Innlogging feilet');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone.trim()) {
      showError('Skriv inn telefonnummeret ditt');
      return;
    }

    setIsLoading(true);
    setInactiveState(false);
    const result = await login(phone);
    setIsLoading(false);
    handleResult(result);
  };

  const submitPin = useCallback(async (value: string) => {
    setIsLoading(true);
    const result = await login(phone, value);
    setIsLoading(false);
    handleResult(result);
  }, [phone, login]);

  // Auto-advance when the PIN is complete (iOS-style)
  useEffect(() => {
    if (pin.length !== PIN_LENGTH || isLoading) return;
    if (pinStep === 'enter') {
      void submitPin(pin);
    } else if (pinStep === 'create') {
      setFirstPin(pin);
      setPin('');
      setPinStep('confirm');
    } else if (pinStep === 'confirm') {
      if (pin === firstPin) {
        void submitPin(pin);
      } else {
        setPin('');
        setFirstPin('');
        setPinStep('create');
        triggerShake();
        showError('PIN-kodene er ikke like', 'Prøv på nytt.');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, pinStep, isLoading, firstPin]);

  const resetPinStep = () => {
    setPinStep('none');
    setPin('');
    setFirstPin('');
    setAdminName(null);
  };

  const handleDismissInactive = () => {
    setInactiveState(false);
    setPhone('');
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="min-h-[100dvh] flex items-center justify-center p-4 pt-safe">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <img 
            src={oksnoenLogo} 
            alt="Oksnøen" 
            className="w-24 h-24 mx-auto mb-4 object-contain"
          />
          <h1 className="text-3xl font-heading font-bold text-foreground">
            Oksnøen
          </h1>
          <p className="text-muted-foreground mt-2">
            Logg inn med telefonnummeret ditt
          </p>
        </div>

        {showDeactivated ? (
          <Card className="border-0 shadow-xl">
            <CardContent className="pt-8 pb-6 text-center space-y-4">
              <PauseCircle className="w-16 h-16 mx-auto text-muted-foreground" />
              <h2 className="text-xl font-heading font-semibold text-foreground">
                Du jobber ikke denne perioden
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Kontoen din er satt som inaktiv. Kontakt leirledelsen hvis du mener dette er feil.
              </p>
              <Button
                onClick={handleDismissInactive}
                variant="outline"
                className="w-full h-12 text-lg font-medium mt-2"
              >
                OK
              </Button>
            </CardContent>
          </Card>
        ) : pinStep !== 'none' ? (
          <div className="py-2">
            <PinPad
              title={
                pinStep === 'enter'
                  ? adminName
                    ? `Hei ${adminName.split(' ')[0]}!`
                    : 'Skriv inn PIN-kode'
                  : pinStep === 'create'
                    ? 'Lag din PIN-kode'
                    : 'Bekreft PIN-koden'
              }
              subtitle={
                pinStep === 'enter'
                  ? 'Skriv inn PIN-koden din'
                  : pinStep === 'create'
                    ? `Velg en firesifret PIN-kode. Du bruker den hver gang du logger inn.`
                    : 'Skriv inn de samme fire sifrene på nytt'
              }
              value={pin}
              onChange={setPin}
              length={PIN_LENGTH}
              isLoading={isLoading}
              shake={shake}
              onCancel={resetPinStep}
              cancelLabel="Tilbake"
            />
          </div>
        ) : (
          <Card className="border-0 shadow-xl">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl font-heading">Velkommen</CardTitle>
              <CardDescription>
                Skriv inn telefonnummeret ditt for å logge inn
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="tel"
                    placeholder="12345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10 h-12 text-lg"
                    autoComplete="tel"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-12 text-lg font-medium"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Logger inn...
                    </>
                  ) : (
                    'Logg inn'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          Kontakt admin hvis du ikke finner deg selv i systemet
        </p>
        </div>
      </div>
    </div>
  );
}
