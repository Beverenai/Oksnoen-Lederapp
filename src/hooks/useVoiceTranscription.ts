import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

function encodeWav(chunks: Float32Array[], sampleRate: number, targetRate = 16000): Blob {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }

  // Downsample to targetRate
  const ratio = sampleRate / targetRate;
  const outLength = Math.floor(merged.length / ratio);
  const samples = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    samples[i] = merged[Math.floor(i * ratio)] ?? 0;
  }

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(pos + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let pos = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    pos += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export function useVoiceTranscription() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);

  const cleanup = useCallback(async () => {
    nodeRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (ctxRef.current && ctxRef.current.state !== 'closed') await ctxRef.current.close();
    nodeRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    ctxRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const node = ctx.createScriptProcessor(4096, 1, 1);
      nodeRef.current = node;
      chunksRef.current = [];
      node.onaudioprocess = (e) => {
        chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      source.connect(node);
      node.connect(ctx.destination);
      setIsRecording(true);
    } catch {
      await cleanup();
      setError('Fikk ikke tilgang til mikrofonen');
    }
  }, [cleanup]);

  const cancel = useCallback(async () => {
    chunksRef.current = [];
    setIsRecording(false);
    await cleanup();
  }, [cleanup]);

  /** Stops recording and returns the transcribed text (or null on failure). */
  const stopAndTranscribe = useCallback(async (): Promise<string | null> => {
    if (!isRecording) return null;
    const rate = ctxRef.current?.sampleRate ?? 48000;
    const chunks = chunksRef.current;
    chunksRef.current = [];
    setIsRecording(false);
    await cleanup();

    const blob = encodeWav(chunks, rate);
    if (blob.size < 4096) {
      setError('Opptaket var tomt – prøv igjen');
      return null;
    }

    setIsTranscribing(true);
    try {
      const form = new FormData();
      form.append('file', blob, 'recording.wav');
      const { data, error: fnError } = await supabase.functions.invoke('transcribe-audio', {
        body: form,
      });
      if (fnError) throw fnError;
      const text = (data as { text?: string })?.text?.trim() ?? '';
      if (!text) {
        setError('Ingen tale gjenkjent');
        return null;
      }
      return text;
    } catch (e: any) {
      setError(e?.message ?? 'Transkribering feilet');
      return null;
    } finally {
      setIsTranscribing(false);
    }
  }, [cleanup, isRecording]);

  return { isRecording, isTranscribing, error, start, stopAndTranscribe, cancel };
}