import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Loader2, PauseCircle } from 'lucide-react';
import oksnoenLogo from '@/assets/oksnoen-logo.png';
import { hapticSuccess, hapticError } from '@/lib/capacitorHaptics';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inactiveState, setInactiveState] = useState(false);
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const { login, deactivatedMessage } = useAuth();
  const navigate = useNavigate();

  // Show deactivated message if user was auto-logged out
  const showDeactivated = inactiveState || !!deactivatedMessage;

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

    if (result.success) {
      navigate('/');
      navigate('/');
    } else if (result.error === 'INACTIVE_LEADER') {
      setInactiveState(true);
    } else {
      showError(result.message || result.error || 'Innlogging feilet');
    }
  };

  const handleDismissInactive = () => {
    setInactiveState(false);
    setPhone('');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="min-h-screen flex items-center justify-center p-4 pt-safe">
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
