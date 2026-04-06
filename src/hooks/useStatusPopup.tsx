import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { StatusPopup, type StatusType, type StatusPopupAction } from '@/components/ui/StatusPopup';
import { hapticSuccess, hapticError, hapticImpact } from '@/lib/capacitorHaptics';

interface PopupState {
  type: StatusType;
  title: string;
  message?: string;
  autoClose?: number | false;
  action?: StatusPopupAction;
}

interface StatusPopupContextValue {
  showSuccess: (title: string, message?: string, autoClose?: number) => void;
  showError: (title: string, message?: string, action?: StatusPopupAction) => void;
  showInfo: (title: string, message?: string, autoClose?: number) => void;
}

const StatusPopupContext = createContext<StatusPopupContextValue | null>(null);

export function StatusPopupProvider({ children }: { children: ReactNode }) {
  const [popup, setPopup] = useState<PopupState | null>(null);

  const close = useCallback(() => setPopup(null), []);

  const showSuccess = useCallback((title: string, message?: string, autoClose = 2000) => {
    setPopup({ type: 'success', title, message, autoClose });
    hapticSuccess();
  }, []);

  const showError = useCallback((title: string, message?: string, action?: StatusPopupAction) => {
    setPopup({ type: 'error', title, message, autoClose: false, action });
    hapticError();
  }, []);

  const showInfo = useCallback((title: string, message?: string, autoClose = 3000) => {
    setPopup({ type: 'info', title, message, autoClose });
    hapticImpact('light');
  }, []);

  return (
    <StatusPopupContext.Provider value={{ showSuccess, showError, showInfo }}>
      {children}
      {popup && createPortal(
        <StatusPopup
          type={popup.type}
          title={popup.title}
          message={popup.message}
          autoClose={popup.autoClose}
          onClose={close}
          action={popup.action}
        />,
        document.body
      )}
    </StatusPopupContext.Provider>
  );
}

export function useStatusPopup() {
  const context = useContext(StatusPopupContext);
  if (!context) {
    throw new Error('useStatusPopup must be used within StatusPopupProvider');
  }
  return context;
}

// Imperative API for non-component code
let _showSuccess: StatusPopupContextValue['showSuccess'] | null = null;
let _showError: StatusPopupContextValue['showError'] | null = null;
let _showInfo: StatusPopupContextValue['showInfo'] | null = null;

export function registerStatusPopup(fns: StatusPopupContextValue) {
  _showSuccess = fns.showSuccess;
  _showError = fns.showError;
  _showInfo = fns.showInfo;
}

export const statusPopup = {
  success: (title: string, message?: string, autoClose?: number) => {
    _showSuccess?.(title, message, autoClose);
  },
  error: (title: string, message?: string, action?: StatusPopupAction) => {
    _showError?.(title, message, action);
  },
  info: (title: string, message?: string, autoClose?: number) => {
    _showInfo?.(title, message, autoClose);
  },
};
