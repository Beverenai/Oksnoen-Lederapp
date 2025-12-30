import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Sparkles, CheckCircle2, AlertCircle, RefreshCw, Search, ChevronDown, User } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import { CheckoutDetailDialog } from '@/components/checkout/CheckoutDetailDialog';
import { hapticImpact, hapticSuccess, hapticError } from '@/lib/capacitorHaptics';

interface CheckoutProgress {
  status: 'idle' | 'starting' | 'running' | 'done' | 'error';
  processed: number;
  total: number;
  error?: string;
}

interface PassWrittenEntry {
  id: string;
  name: string;
  cabin_name: string;
  written_at: string;
  written_by_name: string;
  image_url: string | null;
}

export function CheckoutTab() {
  const [checkoutEnabled, setCheckoutEnabled] = useState(false);
  const [progress, setProgress] = useState<CheckoutProgress>({ status: 'idle', processed: 0, total: 0 });
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [passWrittenCount, setPassWrittenCount] = useState(0);
  const [passWrittenList, setPassWrittenList] = useState<PassWrittenEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPassListOpen, setIsPassListOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [configRes, progressRes, participantsRes, writtenRes, leadersRes] = await Promise.all([
        supabase.from('app_config').select('*').eq('key', 'checkout_enabled').single(),
        supabase.from('app_config').select('*').eq('key', 'checkout_progress').single(),
        supabase.from('participants').select('id, pass_written'),
        supabase.from('participants')
          .select('id, name, first_name, last_name, image_url, pass_written_at, pass_written_by, cabin:cabins(name)')
          .eq('pass_written', true)
          .order('pass_written_at', { ascending: false }),
        supabase.from('leaders').select('id, name'),
      ]);

      setCheckoutEnabled(configRes.data?.value === 'true');
      setTotalParticipants(participantsRes.data?.length || 0);
      setPassWrittenCount(participantsRes.data?.filter(p => p.pass_written).length || 0);

      // Build leader name map
      const leaderMap = new Map<string, string>();
      leadersRes.data?.forEach(l => leaderMap.set(l.id, l.name));

      // Build pass written list
      const writtenList: PassWrittenEntry[] = (writtenRes.data || []).map(p => ({
        id: p.id,
        name: p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.name,
        cabin_name: (p.cabin as any)?.name || 'Ukjent hytte',
        written_at: p.pass_written_at || '',
        written_by_name: p.pass_written_by ? (leaderMap.get(p.pass_written_by) || 'Ukjent') : 'Ukjent',
        image_url: p.image_url || null,
      }));
      setPassWrittenList(writtenList);

      if (progressRes.data?.value) {
        try {
          const parsed = JSON.parse(progressRes.data.value) as CheckoutProgress;
          setProgress(parsed);
        } catch {
          setProgress({ status: 'idle', processed: 0, total: 0 });
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Poll for progress when generation is running
  useEffect(() => {
    if (progress.status === 'starting' || progress.status === 'running') {
      const interval = setInterval(async () => {
        const { data } = await supabase
          .from('app_config')
          .select('value')
          .eq('key', 'checkout_progress')
          .single();

        if (data?.value) {
          try {
            const parsed = JSON.parse(data.value) as CheckoutProgress;
            setProgress(parsed);

            if (parsed.status === 'done') {
              setCheckoutEnabled(true);
              toast.success('Utsjekk aktivert! Ledere kan nå skrive pass.');
              loadData();
            } else if (parsed.status === 'error') {
              toast.error('Feil ved generering: ' + (parsed.error || 'Ukjent feil'));
            }
          } catch {
            // ignore parse errors
          }
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [progress.status, loadData]);

  const handleStartCheckout = async () => {
    hapticImpact('medium');
    try {
      setProgress({ status: 'starting', processed: 0, total: 0 });

      const { error } = await supabase.functions.invoke('generate-all-passes');

      if (error) {
        console.error('Error starting pass generation:', error);
        hapticError();
        toast.error('Kunne ikke starte generering');
        setProgress({ status: 'error', processed: 0, total: 0, error: error.message });
      }
    } catch (error) {
      console.error('Error starting checkout:', error);
      hapticError();
      toast.error('Kunne ikke starte utsjekk');
      setProgress({ status: 'error', processed: 0, total: 0 });
    }
  };

  const handleDisableCheckout = async () => {
    hapticImpact('medium');
    try {
      await supabase
        .from('app_config')
        .update({ value: 'false' })
        .eq('key', 'checkout_enabled');
      
      await supabase
        .from('app_config')
        .upsert({ key: 'checkout_progress', value: JSON.stringify({ status: 'idle', processed: 0, total: 0 }) }, { onConflict: 'key' });
      
      setCheckoutEnabled(false);
      setProgress({ status: 'idle', processed: 0, total: 0 });
      hapticSuccess();
      toast.success('Utsjekk deaktivert');
    } catch (error) {
      console.error('Error disabling checkout:', error);
      hapticError();
      toast.error('Kunne ikke deaktivere utsjekk');
    }
  };

  const isGenerating = progress.status === 'starting' || progress.status === 'running';
  const progressPercent = progress.total > 0 ? (progress.processed / progress.total) * 100 : 0;

  const filteredPassWrittenList = useMemo(() => {
    if (!searchQuery.trim()) return passWrittenList;
    const query = searchQuery.toLowerCase();
    return passWrittenList.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.cabin_name.toLowerCase().includes(query)
    );
  }, [passWrittenList, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Utsjekk - Pass-generering
          </CardTitle>
          <CardDescription>
            Start utsjekk for å generere AI-baserte passforslag for alle deltakere.
            Genereringen fortsetter i bakgrunnen selv om du navigerer bort.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status */}
          <div className="flex items-center gap-3">
            <Badge 
              variant={checkoutEnabled ? 'default' : 'secondary'}
              className={checkoutEnabled ? 'bg-success hover:bg-success' : ''}
            >
              {checkoutEnabled ? (
                <>
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Aktiv
                </>
              ) : isGenerating ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Genererer...
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Ikke startet
                </>
              )}
            </Badge>
            {checkoutEnabled && (
              <span className="text-sm text-muted-foreground">
                {passWrittenCount} av {totalParticipants} pass skrevet
              </span>
            )}
          </div>

          {/* Progress during generation */}
          {isGenerating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Genererer passforslag i bakgrunnen...
                </span>
                <span>{progress.processed} / {progress.total || '?'}</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Du kan navigere bort fra denne siden. Genereringen fortsetter.
              </p>
            </div>
          )}

          {/* Error state */}
          {progress.status === 'error' && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">
                Feil ved generering: {progress.error || 'Ukjent feil'}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {!checkoutEnabled ? (
              <Button 
                onClick={handleStartCheckout} 
                disabled={isGenerating}
                className="gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Genererer...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Start Utsjekk
                  </>
                )}
              </Button>
            ) : (
              <>
                <Button 
                  onClick={handleStartCheckout} 
                  disabled={isGenerating}
                  variant="outline"
                  className="gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Genererer...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generer på nytt
                    </>
                  )}
                </Button>
                <Button 
                  onClick={handleDisableCheckout} 
                  variant="destructive"
                  disabled={isGenerating}
                >
                  Deaktiver Utsjekk
                </Button>
              </>
            )}
          </div>

          {/* Stats when enabled */}
          {checkoutEnabled && !isGenerating && (
            <div className="pt-4 border-t space-y-4">
              <div>
                <h4 className="font-medium mb-3">Fremgang</h4>
                <div className="space-y-2">
                  <Progress value={(passWrittenCount / totalParticipants) * 100} className="h-3" />
                  <p className="text-sm text-muted-foreground">
                    {passWrittenCount} av {totalParticipants} deltakere har fått pass skrevet
                  </p>
                </div>
              </div>

              {/* Search and collapsible list of written passes */}
              {passWrittenList.length > 0 && (
                <div className="pt-4 border-t">
                  {/* Search field */}
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Søk etter deltaker..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  
                  {/* Collapsible list */}
                  <Collapsible open={isPassListOpen} onOpenChange={setIsPassListOpen}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-muted/50 rounded-md">
                      <h4 className="font-medium flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-success" />
                        Pass skrevet ({filteredPassWrittenList.length})
                      </h4>
                      <ChevronDown className={`w-4 h-4 transition-transform ${isPassListOpen ? 'rotate-180' : ''}`} />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ScrollArea className="max-h-80 mt-2">
                        <div className="space-y-2 pr-4">
                          {filteredPassWrittenList.map((p) => (
                            <div 
                              key={p.id} 
                              className="flex items-center justify-between p-2 bg-muted/50 rounded-md text-sm cursor-pointer hover:bg-muted transition-colors"
                              onClick={() => {
                                setSelectedParticipantId(p.id);
                                setIsDetailDialogOpen(true);
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <Avatar className="w-8 h-8">
                                  <AvatarImage src={p.image_url || undefined} />
                                  <AvatarFallback><User className="w-4 h-4" /></AvatarFallback>
                                </Avatar>
                                <div>
                                  <span className="font-medium">{p.name}</span>
                                  <span className="text-muted-foreground ml-2">({p.cabin_name})</span>
                                </div>
                              </div>
                              <div className="text-right text-muted-foreground text-xs">
                                <div>Av: {p.written_by_name}</div>
                                {p.written_at && (
                                  <div>{format(new Date(p.written_at), 'dd.MM HH:mm', { locale: nb })}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hvordan fungerer utsjekk?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. <strong>Start Utsjekk</strong> - AI genererer passforslag for alle deltakere i bakgrunnen.</p>
          <p>2. <strong>Naviger fritt</strong> - Du kan gå til andre sider mens genereringen pågår.</p>
          <p>3. <strong>Ledere skriver pass</strong> - I Passkontroll får ledere tilgang til Utsjekk-knappen.</p>
          <p>4. <strong>AI-forslag</strong> - Hvert pass har et AI-generert forslag som kan redigeres.</p>
        </CardContent>
      </Card>

      {/* Checkout Detail Dialog */}
      <CheckoutDetailDialog
        participantId={selectedParticipantId}
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        onComplete={loadData}
      />
    </div>
  );
}