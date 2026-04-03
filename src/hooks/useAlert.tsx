import React, { createContext, useContext, useState, useCallback } from 'react';
import CustomAlert, { AlertType, AlertButton, AlertConfig } from '../components/CustomAlert';

interface AlertAPI {
  show: (type: AlertType, title: string, message?: string, buttons?: AlertButton[]) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  confirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText?: string,
    cancelText?: string,
    destructive?: boolean,
  ) => void;
}

const AlertContext = createContext<AlertAPI>({
  show: () => {},
  success: () => {},
  error: () => {},
  warning: () => {},
  info: () => {},
  confirm: () => {},
});

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AlertConfig>({
    visible: false,
    type: 'info',
    title: '',
  });

  const dismiss = useCallback(() => {
    setConfig((prev) => ({ ...prev, visible: false }));
  }, []);

  const show: AlertAPI['show'] = useCallback((type, title, message, buttons) => {
    setConfig({ visible: true, type, title, message, buttons });
  }, []);

  const success: AlertAPI['success'] = useCallback(
    (title, message) => show('success', title, message),
    [show],
  );

  const error: AlertAPI['error'] = useCallback(
    (title, message) => show('error', title, message),
    [show],
  );

  const warning: AlertAPI['warning'] = useCallback(
    (title, message) => show('warning', title, message),
    [show],
  );

  const info: AlertAPI['info'] = useCallback(
    (title, message) => show('info', title, message),
    [show],
  );

  const confirm: AlertAPI['confirm'] = useCallback(
    (title, message, onConfirm, confirmText = 'OK', cancelText = 'Cancel', destructive = false) => {
      show('confirm', title, message, [
        { text: cancelText, style: 'cancel' },
        { text: confirmText, onPress: onConfirm, style: destructive ? 'destructive' : 'default' },
      ]);
    },
    [show],
  );

  const api: AlertAPI = { show, success, error, warning, info, confirm };

  return (
    <AlertContext.Provider value={api}>
      {children}
      <CustomAlert {...config} onDismiss={dismiss} />
    </AlertContext.Provider>
  );
}

export function useAlert(): AlertAPI {
  return useContext(AlertContext);
}
