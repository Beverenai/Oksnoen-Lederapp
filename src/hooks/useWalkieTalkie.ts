import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  ConnectionState,
  RemoteParticipant,
  Participant,
  Track,
} from 'livekit-client';
import { supabase } from '@/integrations/supabase/client';
import { hapticImpact } from '@/lib/capacitorHaptics';

export type WalkieParticipant = {
  identity: string;
  name: string;
  isLocal: boolean;
  isSpeaking: boolean;
};

export function useWalkieTalkie() {
  const roomRef = useRef<Room | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [participants, setParticipants] = useState<WalkieParticipant[]>([]);
  const [isTalking, setIsTalking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const refreshParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room) {
      setParticipants([]);
      return;
    }
    const list: WalkieParticipant[] = [];
    const speakingIds = new Set(room.activeSpeakers.map((p) => p.identity));
    const all: Participant[] = [room.localParticipant, ...Array.from(room.remoteParticipants.values())];
    for (const p of all) {
      list.push({
        identity: p.identity,
        name: p.name || p.identity,
        isLocal: p === room.localParticipant,
        isSpeaking: speakingIds.has(p.identity),
      });
    }
    setParticipants(list);
  }, []);

  const attachRoomEvents = useCallback((room: Room) => {
    room
      .on(RoomEvent.ConnectionStateChanged, (s) => setConnectionState(s))
      .on(RoomEvent.ParticipantConnected, refreshParticipants)
      .on(RoomEvent.ParticipantDisconnected, refreshParticipants)
      .on(RoomEvent.ActiveSpeakersChanged, refreshParticipants)
      .on(RoomEvent.TrackSubscribed, refreshParticipants)
      .on(RoomEvent.TrackUnsubscribed, refreshParticipants);
  }, [refreshParticipants]);

  const connect = useCallback(async (channelId: string) => {
    setError(null);
    setPermissionDenied(false);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('livekit-token', {
        body: { channel_id: channelId },
      });
      if (fnErr) throw fnErr;
      if (!data?.token || !data?.url) throw new Error('Invalid token response');

      // Tear down any previous room
      if (roomRef.current) {
        await roomRef.current.disconnect();
        roomRef.current = null;
      }

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      attachRoomEvents(room);
      roomRef.current = room;

      await room.connect(data.url, data.token);
      // Publish mic but start disabled (push-to-talk)
      try {
        await room.localParticipant.setMicrophoneEnabled(false);
      } catch (e) {
        console.warn('mic init', e);
      }
      refreshParticipants();
    } catch (e: any) {
      console.error('walkie connect', e);
      setError(e?.message || 'Tilkobling feilet');
      throw e;
    }
  }, [attachRoomEvents, refreshParticipants]);

  const disconnect = useCallback(async () => {
    const room = roomRef.current;
    if (room) {
      try { await room.disconnect(); } catch {}
    }
    roomRef.current = null;
    setParticipants([]);
    setIsTalking(false);
    setConnectionState(ConnectionState.Disconnected);
  }, []);

  const startTalking = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
      setIsTalking(true);
      hapticImpact('medium');
    } catch (e: any) {
      console.error('startTalking', e);
      if (e?.name === 'NotAllowedError' || /permission/i.test(String(e?.message))) {
        setPermissionDenied(true);
      }
      setError(e?.message || 'Kunne ikke åpne mikrofon');
    }
  }, []);

  const stopTalking = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setMicrophoneEnabled(false);
    } catch (e) {
      console.warn('stopTalking', e);
    }
    setIsTalking(false);
    hapticImpact('light');
  }, []);

  const toggleMute = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const next = !isMuted;
    setIsMuted(next);
    room.remoteParticipants.forEach((rp: RemoteParticipant) => {
      rp.audioTrackPublications.forEach((pub) => {
        if (pub.track && pub.track.kind === Track.Kind.Audio) {
          (pub.track as any).setVolume?.(next ? 0 : 1);
        }
      });
    });
  }, [isMuted]);

  // Auto-disconnect on background to save battery
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden' && roomRef.current) {
        disconnect();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [disconnect]);

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect().catch(() => {});
        roomRef.current = null;
      }
    };
  }, []);

  return {
    connect,
    disconnect,
    startTalking,
    stopTalking,
    toggleMute,
    participants,
    isTalking,
    isMuted,
    connectionState,
    isConnected: connectionState === ConnectionState.Connected,
    error,
    permissionDenied,
  };
}