import React, { createContext, useCallback, useContext, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';

type Severity = 'error' | 'warning' | 'info' | 'success';

interface SnackbarContextType {
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  showSnackbar: (message: string, severity?: Severity) => void;
}

const SnackbarContext = createContext<SnackbarContextType | null>(null);

export const useSnackbar = (): SnackbarContextType => {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error('useSnackbar must be used within SnackbarProvider');
  return ctx;
};

interface SnackbarState {
  open: boolean;
  message: string;
  severity: Severity;
}

export const SnackbarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SnackbarState>({ open: false, message: '', severity: 'error' });

  const showSnackbar = useCallback((message: string, severity: Severity = 'error') => {
    setState({ open: true, message, severity });
  }, []);

  const showError = useCallback((message: string) => showSnackbar(message, 'error'), [showSnackbar]);
  const showSuccess = useCallback((message: string) => showSnackbar(message, 'success'), [showSnackbar]);

  const handleClose = (_: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setState(s => ({ ...s, open: false }));
  };

  return (
    <SnackbarContext.Provider value={{ showError, showSuccess, showSnackbar }}>
      {children}
      <Snackbar
        open={state.open}
        autoHideDuration={5000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleClose} severity={state.severity} variant="filled" sx={{ width: '100%' }}>
          {state.message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  );
};
