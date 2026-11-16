import { useCallback, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Info } from 'lucide-react';
import type { StatusType } from '@/components/ui/StatusPopup';

/** Scoped confirmations: registration flows use modals without changing global notifications. */
export function useRegistrationPopup() {
  const [popup, setPopup] = useState<{ type: StatusType; title: string; message?: string } | null>(null);
  const close = useCallback(() => setPopup(null), []);
  const showSuccess = useCallback((title: string, message?: string) => setPopup({ type: 'success', title, message }), []);
  const showError = useCallback((title: string, message?: string) => setPopup({ type: 'error', title, message }), []);
  const showInfo = useCallback((title: string, message?: string) => setPopup({ type: 'info', title, message }), []);
  const Icon = popup?.type === 'success' ? CheckCircle : popup?.type === 'error' ? XCircle : Info;
  return { showSuccess, showError, showInfo, popup: popup && <Dialog.Root open onOpenChange={open => { if (!open) close(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[9998] bg-foreground/40 backdrop-blur-sm" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-[9999] w-[calc(100%-3rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background p-6 shadow-xl text-center space-y-4">
        <Icon className={popup.type === 'error' ? 'mx-auto h-10 w-10 text-destructive' : 'mx-auto h-10 w-10 text-primary'} />
        <Dialog.Title className="text-lg font-semibold break-words">{popup.title}</Dialog.Title>
        <Dialog.Description className="text-sm text-muted-foreground">{popup.message ?? ''}</Dialog.Description>
        <Button onClick={close} className="w-full">OK</Button>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root> };
}