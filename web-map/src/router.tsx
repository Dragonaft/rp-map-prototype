import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import { MapView } from './components/MapView';
import { LoginPage } from "./pages/auth/login/LoginPage.tsx";

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <MapView />,
      },
    ],
  },
  {
    path: '/login',
    element: <App />,
    children: [
      {
        index: true,
        element: <LoginPage />,
      },
    ],
  },
]);
