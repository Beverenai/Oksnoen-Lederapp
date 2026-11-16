import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { StatusPopup, type StatusType } from '@/components/ui/StatusPopup';

/** Scoped confirmations: registration flows use modals without changing global notifications. */
export function useRegistrationPopup() {
  const [popup, setPopup] = useState<{ type: StatusType; title: string; message?: string } | null>(null);
  const close = useCallback(() => setPopup(null), []);
  const showSuccess = useCallback((title: string, message?: string) => setPopup({ type: 'success', title, message }), []);
  const showError = useCallback((title: string, message?: string) => setPopup({ type: 'error', title, message }), []);
  const showInfo = useCallback((title: string, message?: string) => setPopup({ type: 'info', title, message }), []);
  return { showSuccess, showError, showInfo, popup: popup && createPortal(<StatusPopup {...popup} autoClose={false} onClose={close} />, document.body) };
}