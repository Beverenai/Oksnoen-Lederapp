import { useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type StatusType = 'success' | 'error' | 'info';

export interface StatusPopupAction {
  label: string;
  onClick: () => void;
}

export interface StatusPopupProps {
  type: StatusType;
  title: string;
  message?: string;
  autoClose?: number | false;
  onClose: () => void;
  action?: StatusPopupAction;
}

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  info: AlertTriangle,
};

const colorMap = {
  success: 'text-green-500',
  error: 'text-red-500',
  info: 'text-amber-500',
};

const bgMap = {
  success: 'bg-green-500/10',
  error: 'bg-red-500/10',
  info: 'bg-amber-500/10',
};

export function StatusPopup({ type, title, message, autoClose, onClose, action }: StatusPopupProps) {
  const Icon = iconMap[type];

  useEffect(() => {
    if (autoClose !== false && autoClose !== undefined && autoClose > 0) {
      const timer = setTimeout(onClose, autoClose);
      return () => clearTimeout(timer);
    }
  }, [autoClose, onClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-fade-in"
      onClick={handleBackdropClick}
      style={{ animationDuration: '150ms' }}
    >
      <div
        className="relative bg-background rounded-2xl shadow-2xl p-6 mx-6 max-w-sm w-full flex flex-col items-center gap-3 border border-border"
        style={{
          animation: 'status-popup-in 200ms ease-out forwards',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon */}
        <div className={cn('rounded-full p-4', bgMap[type])}>
          <Icon className={cn('h-10 w-10', colorMap[type])} strokeWidth={2} />
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-foreground text-center">{title}</h3>

        {/* Message */}
        {message && (
          <p className="text-sm text-muted-foreground text-center leading-relaxed">{message}</p>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 mt-1 w-full">
          {action && (
            <Button
              variant="default"
              className="flex-1"
              onClick={() => {
                action.onClick();
                onClose();
              }}
            >
              {action.label}
            </Button>
          )}
          <Button
            variant={action ? 'outline' : 'default'}
            className="flex-1"
            onClick={onClose}
          >
            OK
          </Button>
        </div>
      </div>
    </div>
  );
}
