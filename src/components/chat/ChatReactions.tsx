import { useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hapticImpact } from '@/lib/capacitorHaptics';

export const CHAT_EMOJIS = ['❤️', '😂', '👍', '🔥', '😮', '😢'] as const;

export type ChatReaction = { message_id: string; leader_id: string; emoji: string };

type Props = {
  reactions: ChatReaction[];
  myLeaderId: string | undefined;
  onToggle: (emoji: string) => void;
  align: 'start' | 'end';
};

/** Emoji-reaksjoner under en melding, med hurtigvelger. */
export function ChatReactions({ reactions, myLeaderId, onToggle, align }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const grouped = new Map<string, { count: number; mine: boolean }>();
  for (const r of reactions) {
    const prev = grouped.get(r.emoji) ?? { count: 0, mine: false };
    grouped.set(r.emoji, {
      count: prev.count + 1,
      mine: prev.mine || r.leader_id === myLeaderId,
    });
  }

  const pick = (emoji: string) => {
    hapticImpact('light');
    setPickerOpen(false);
    onToggle(emoji);
  };

  return (
    <div
      className={cn(
        'relative mt-1 flex flex-wrap items-center gap-1',
        align === 'end' ? 'justify-end' : 'justify-start',
      )}
    >
      {[...grouped.entries()].map(([emoji, info]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => pick(emoji)}
          className={cn(
            'flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] leading-none',
            info.mine ? 'border-primary/60 bg-primary/10 text-foreground' : 'border-border bg-card/70 text-muted-foreground',
          )}
          aria-label={`Reager med ${emoji}`}
        >
          <span className="text-[13px]">{emoji}</span>
          {info.count > 1 && <span className="font-medium">{info.count}</span>}
        </button>
      ))}

      <button
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        className="rounded-full border border-border bg-card/70 p-1 text-muted-foreground opacity-70 transition-opacity hover:opacity-100"
        aria-label="Legg til reaksjon"
      >
        <SmilePlus className="h-3.5 w-3.5" />
      </button>

      {pickerOpen && (
        <>
          {/* Klikk utenfor lukker velgeren */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setPickerOpen(false)}
          />
          <div
            className={cn(
              'absolute bottom-full z-50 mb-1 flex gap-1 rounded-full border bg-popover p-1 shadow-xl',
              align === 'end' ? 'right-0' : 'left-0',
            )}
          >
            {CHAT_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => pick(e)}
                className="rounded-full px-1.5 py-0.5 text-lg leading-none transition-transform hover:scale-125"
                aria-label={`Reager med ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
