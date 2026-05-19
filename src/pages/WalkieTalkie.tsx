import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWalkieTalkie } from '@/hooks/useWalkieTalkie';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Mic, MicOff, Radio, Users, Megaphone, Home, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConnectionState } from 'livekit-client';

type Channel = {
  id: string;
  name: string;
  channel_type: 'cabin' | 'team' | 'all' | 'custom';
};

function channelIcon(type: Channel['channel_type']) {
  if (type === 'all') return Megaphone;
  if (type === 'cabin') return Home;
  if (type === 'team') return Users;
  return Radio;
}

export default function WalkieTalkiePage() {
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const offline = useOfflineStatus();
  const walkie = useWalkieTalkie();

  const { data: channels, isLoading } = useQuery<Channel[]>({
    queryKey: ['walkie-channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('walkie_channels')
        .select('id, name, channel_type')
        .order('channel_type', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data as Channel[]) || [];
    },
  });

  const enterChannel = async (ch: Channel) => {
    setActiveChannel(ch);
    try {
      await walkie.connect(ch.id);
    } catch {
      // error surfaced via walkie.error
    }
  };

  const leaveChannel = async () => {
    await walkie.disconnect();
    setActiveChannel(null);
  };

  // Push-to-talk handlers
  const onPttDown = (e: React.PointerEvent | React.TouchEvent) => {
    e.preventDefault();
    walkie.startTalking();
  };
  const onPttUp = (e: React.PointerEvent | React.TouchEvent) => {
    e.preventDefault();
    walkie.stopTalking();
  };

  useEffect(() => {
    return () => { walkie.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (activeChannel) {
    const stateLabel: Record<ConnectionState, string> = {
      [ConnectionState.Connecting]: 'Kobler til…',
      [ConnectionState.Connected]: 'Tilkoblet',
      [ConnectionState.Reconnecting]: 'Kobler til igjen…',
      [ConnectionState.Disconnected]: 'Frakoblet',
      [ConnectionState.SignalReconnecting]: 'Kobler til igjen…',
    };
    return (
      <div className="min-h-[100dvh] flex flex-col p-4 gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={leaveChannel}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">{activeChannel.name}</h1>
            <p className="text-xs text-muted-foreground">{stateLabel[walkie.connectionState] ?? walkie.connectionState}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={walkie.toggleMute} aria-label="Mute andre">
            {walkie.isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </Button>
        </div>

        {offline && (
          <Card className="p-3 bg-destructive/10 border-destructive/30 text-sm text-destructive">
            Du er offline. Walkie virker ikke uten nettforbindelse.
          </Card>
        )}

        {walkie.permissionDenied && (
          <Card className="p-4 space-y-2">
            <p className="text-sm">Mikrofon-tilgang er nektet. Tillat mikrofonen i innstillingene for å snakke.</p>
            <Button onClick={() => walkie.startTalking()}>Prøv igjen</Button>
          </Card>
        )}

        {walkie.error && !walkie.permissionDenied && (
          <Card className="p-3 bg-destructive/10 border-destructive/30 text-sm text-destructive">
            {walkie.error}
          </Card>
        )}

        {!walkie.canPlayAudio && walkie.isConnected && (
          <button
            onClick={() => walkie.startAudio()}
            className="p-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2"
          >
            <Volume2 className="w-4 h-4" />
            Trykk for å aktivere lyd
          </button>
        )}

        {/* Participants */}
        <Card className="p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Deltakere ({walkie.participants.length})
          </h2>
          {walkie.participants.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen tilkoblet ennå.</p>
          ) : (
            <ul className="space-y-3">
              {walkie.participants.map((p) => {
                const initials = p.name
                  .split(/\s+/)
                  .map((s) => s[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();
                return (
                  <li key={p.identity} className="flex items-center gap-3">
                    <div className={cn(
                      'relative rounded-full transition-shadow',
                      p.isSpeaking && 'ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse'
                    )}>
                      <Avatar className="w-10 h-10">
                        {p.avatarUrl && <AvatarImage src={p.avatarUrl} alt={p.name} />}
                        <AvatarFallback>{initials || '?'}</AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {p.name}
                        {p.isLocal && <span className="text-muted-foreground ml-1">(du)</span>}
                      </p>
                      {p.isSpeaking && (
                        <p className="text-xs text-primary flex items-center gap-1">
                          <Mic className="w-3 h-3" /> Snakker
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="flex-1" />

        {/* PTT button */}
        <div className="flex flex-col items-center gap-3 pb-8">
          <button
            type="button"
            disabled={!walkie.isConnected}
            onPointerDown={onPttDown}
            onPointerUp={onPttUp}
            onPointerCancel={onPttUp}
            onPointerLeave={(e) => { if (walkie.isTalking) onPttUp(e); }}
            onTouchStart={onPttDown}
            onTouchEnd={onPttUp}
            className={cn(
              'w-48 h-48 rounded-full flex flex-col items-center justify-center select-none transition-all touch-none',
              'shadow-lg active:scale-95 disabled:opacity-50 disabled:active:scale-100',
              walkie.isTalking
                ? 'bg-destructive text-destructive-foreground scale-105'
                : 'bg-primary text-primary-foreground'
            )}
          >
            {walkie.isTalking ? <Mic className="w-12 h-12" /> : <Mic className="w-12 h-12" />}
            <span className="text-sm font-medium mt-2">
              {walkie.isTalking ? 'Sender…' : 'Trykk og hold'}
            </span>
          </button>
          <Button variant="outline" onClick={leaveChannel}>Forlat kanal</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col p-4 gap-4">
      <div className="flex items-center gap-3">
        <Radio className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold">Walkie-Talkie</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Velg en kanal for å koble til. Trykk og hold for å snakke.
      </p>

      {offline && (
        <Card className="p-3 bg-destructive/10 border-destructive/30 text-sm text-destructive">
          Du er offline.
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (channels?.length ?? 0) === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Du har ingen tilgjengelige kanaler ennå.
        </Card>
      ) : (
        <div className="grid gap-2">
          {channels!.map((ch) => {
            const Icon = channelIcon(ch.channel_type);
            return (
              <button
                key={ch.id}
                onClick={() => enterChannel(ch)}
                className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent text-left transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{ch.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{ch.channel_type === 'all' ? 'Alle ledere' : ch.channel_type}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}