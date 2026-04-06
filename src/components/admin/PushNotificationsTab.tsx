import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, Send, Users, Key, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { hapticSuccess, hapticError } from '@/lib/capacitorHaptics';

export function PushNotificationsTab() {
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const { leader } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);
  const [subscriptionCount, setSubscriptionCount] = useState(0);
  const [isConfigured, setIsConfigured] = useState(false);
  const [generatedKeys, setGeneratedKeys] = useState<{
    publicKey: string;
    privateKey: string;
  } | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [url, setUrl] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Check if VAPID is configured
      const { data: vapidData } = await supabase.functions.invoke('push-vapid-key');
      setIsConfigured(vapidData?.configured ?? false);

      // Get subscription count
      const { count } = await supabase
        .from('push_subscriptions')
        .select('*', { count: 'exact', head: true });
      
      setSubscriptionCount(count ?? 0);
    } catch (error) {
      console.error('Error loading push data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateVapidKeys = async () => {
    if (!leader?.id) {
      showError('Du må være logget inn');
      return;
    }
    
    setIsGeneratingKeys(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-vapid-keys', {
        body: { leader_id: leader.id }
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        hapticSuccess();
        setGeneratedKeys({
          publicKey: data.publicKey,
          privateKey: data.privateKey,
        });
        showSuccess('VAPID-nøkler generert! Kopier og lagre disse som secrets.');
      } else {
        throw new Error(data?.error || 'Ukjent feil');
      }
    } catch (error: any) {
      console.error('Error generating VAPID keys:', error);
      showError('Kunne ikke generere VAPID-nøkler: ' + (error.message || 'Ukjent feil'));
    } finally {
      setIsGeneratingKeys(false);
    }
  };

  const sendBroadcast = async () => {
    if (!title.trim() || !message.trim()) {
      showError('Fyll inn tittel og melding');
      return;
    }

    if (!leader?.id) {
      showError('Du må være logget inn');
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('push-send', {
        body: {
          title: title.trim(),
          message: message.trim(),
          url: url.trim() || '/',
          broadcast: true,
          sender_leader_id: leader.id,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        showSuccess(`Sendt til ${data.sent} mottakere`);
        setTitle('');
        setMessage('');
        setUrl('');
        
        // Reload to update counts
        loadData();
      } else {
        throw new Error(data?.error || 'Ukjent feil');
      }
    } catch (error: any) {
      console.error('Error sending broadcast:', error);
      showError('Kunne ikke sende varsel: ' + (error.message || 'Ukjent feil'));
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Push-varsler Status
          </CardTitle>
          <CardDescription>
            Oversikt over push-varsler konfigurasjonen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              {isConfigured ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Konfigurert
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Ikke konfigurert
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <strong>{subscriptionCount}</strong> aktive abonnementer
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* VAPID Key Generation (only if not configured) */}
      {!isConfigured && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Generer VAPID-nøkler
            </CardTitle>
            <CardDescription>
              Du må generere og konfigurere VAPID-nøkler før push-varsler kan brukes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {generatedKeys ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                    ✅ Nøkler generert! Lagre disse som secrets i Lovable:
                  </p>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-green-700 dark:text-green-300">
                        VAPID_PUBLIC_KEY
                      </Label>
                      <Input
                        value={generatedKeys.publicKey}
                        readOnly
                        className="font-mono text-xs mt-1"
                        onClick={(e) => {
                          (e.target as HTMLInputElement).select();
                          navigator.clipboard.writeText(generatedKeys.publicKey);
                          showSuccess('Public key kopiert!');
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-green-700 dark:text-green-300">
                        VAPID_PRIVATE_KEY
                      </Label>
                      <Input
                        value={generatedKeys.privateKey}
                        readOnly
                        className="font-mono text-xs mt-1"
                        onClick={(e) => {
                          (e.target as HTMLInputElement).select();
                          navigator.clipboard.writeText(generatedKeys.privateKey);
                          showSuccess('Private key kopiert!');
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-green-700 dark:text-green-300">
                        VAPID_SUBJECT
                      </Label>
                      <Input
                        value="mailto:support@oksnoen.com"
                        readOnly
                        className="font-mono text-xs mt-1"
                        onClick={(e) => {
                          (e.target as HTMLInputElement).select();
                          navigator.clipboard.writeText('mailto:support@oksnoen.com');
                          showSuccess('Subject kopiert!');
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-3">
                    Klikk på feltene for å kopiere. Legg disse til som secrets i Lovable Cloud.
                  </p>
                </div>
              </div>
            ) : (
              <Button onClick={generateVapidKeys} disabled={isGeneratingKeys}>
                {isGeneratingKeys ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Genererer...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Generer VAPID-nøkler
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Send Broadcast */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Varsel til Alle
          </CardTitle>
          <CardDescription>
            Send et push-varsel til alle ledere som har aktivert varsler
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="push-title">Tittel</Label>
            <Input
              id="push-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="F.eks: Viktig melding"
              disabled={!isConfigured || isSending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="push-message">Melding</Label>
            <Textarea
              id="push-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Skriv meldingen som skal sendes..."
              disabled={!isConfigured || isSending}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="push-url">URL (valgfritt)</Label>
            <Input
              id="push-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="/schedule"
              disabled={!isConfigured || isSending}
            />
            <p className="text-xs text-muted-foreground">
              Side som åpnes når brukeren trykker på varselet
            </p>
          </div>
          <Button
            onClick={sendBroadcast}
            disabled={!isConfigured || isSending || !title.trim() || !message.trim()}
            className="w-full sm:w-auto"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sender...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send til alle ({subscriptionCount})
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
