import { Button } from '@/components/ui/button';
import { Loader2, Mic, Square, X } from 'lucide-react';
import { useEffect } from 'react';
import { useVoiceTranscription } from '@/hooks/useVoiceTranscription';
import { useStatusPopup } from '@/hooks/useStatusPopup';

interface VoiceDictateButtonProps {
  onTranscript: (text: string) => void;
}

export function VoiceDictateButton({ onTranscript }: VoiceDictateButtonProps) {
  const { isRecording, isTranscribing, error, start, stopAndTranscribe, cancel } = useVoiceTranscription();
  const { showError } = useStatusPopup();

  useEffect(() => {
    if (error) showError('Tale til tekst', error);
  }, [error, showError]);

  const handleStop = async () => {
    const text = await stopAndTranscribe();
    if (text) onTranscript(text);
  };

  if (isTranscribing) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Transkriberer…
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="flex items-center gap-1.5 text-xs font-medium text-destructive">
          <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
          Spiller inn
        </span>
        <Button type="button" size="sm" variant="secondary" className="h-7 px-2" onClick={handleStop}>
          <Square className="h-3 w-3 mr-1" />
          Ferdig
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={cancel}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={start}>
      <Mic className="h-3.5 w-3.5 mr-1" />
      Snakk inn
    </Button>
  );
}