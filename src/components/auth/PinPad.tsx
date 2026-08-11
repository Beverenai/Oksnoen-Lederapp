import { Delete, Loader2 } from 'lucide-react';
import { hapticLight } from '@/lib/capacitorHaptics';
import { cn } from '@/lib/utils';

interface PinPadProps {
  title: string;
  subtitle?: string;
  value: string;
  onChange: (next: string) => void;
  length?: number;
  isLoading?: boolean;
  shake?: boolean;
  onCancel?: () => void;
  cancelLabel?: string;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function PinPad({
  title,
  subtitle,
  value,
  onChange,
  length = 4,
  isLoading = false,
  shake = false,
  onCancel,
  cancelLabel = 'Avbryt',
}: PinPadProps) {
  const press = (digit: string) => {
    if (isLoading || value.length >= length) return;
    void hapticLight?.();
    onChange(value + digit);
  };

  const back = () => {
    if (isLoading || !value.length) return;
    void hapticLight?.();
    onChange(value.slice(0, -1));
  };

  return (
    <div className="flex flex-col items-center select-none">
      <h2 className="text-xl font-heading font-semibold text-foreground text-center">{title}</h2>
      {subtitle && (
        <p className="text-sm text-muted-foreground text-center mt-1 max-w-[18rem]">{subtitle}</p>
      )}

      {/* Dots */}
      <div
        className={cn(
          'flex items-center justify-center gap-5 mt-8 mb-8 h-4',
          shake && 'animate-[pin-shake_0.4s_ease-in-out]'
        )}
      >
        {isLoading ? (
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        ) : (
          Array.from({ length }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'w-3.5 h-3.5 rounded-full border-2 border-foreground/60 transition-all duration-150',
                i < value.length && 'bg-foreground border-foreground scale-110'
              )}
            />
          ))
        )}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-x-6 gap-y-4">
        {KEYS.map((k) => (
          <PinKey key={k} onClick={() => press(k)} disabled={isLoading}>
            {k}
          </PinKey>
        ))}
        <div className="flex items-center justify-center">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              {cancelLabel}
            </button>
          )}
        </div>
        <PinKey onClick={() => press('0')} disabled={isLoading}>
          0
        </PinKey>
        <div className="flex items-center justify-center">
          {value.length > 0 && !isLoading && (
            <button
              type="button"
              onClick={back}
              aria-label="Slett siffer"
              className="w-16 h-16 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <Delete className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PinKey({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-[4.5rem] h-[4.5rem] rounded-full bg-muted/60 backdrop-blur-sm text-2xl font-light text-foreground
                 flex items-center justify-center transition-all duration-100
                 active:bg-foreground/20 active:scale-95 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
