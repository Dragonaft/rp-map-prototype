import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { setApiErrorHandler } from './api/config';
import { useSnackbar } from './context/SnackbarContext';

export default function App() {
  const { showError } = useSnackbar();

  useEffect(() => {
    setApiErrorHandler(showError);
  }, [showError]);

  return <Outlet />;
}
