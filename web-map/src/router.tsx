import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import { LoginPage } from "./pages/auth/login/LoginPage.tsx";
import { RegisterPage } from './pages/auth/register/RegisterPage.tsx';
import { ProtectedRoute } from './components/ProtectedRoute';
import { GamePage } from "./pages/game";

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: (
          <ProtectedRoute>
            <GamePage />
          </ProtectedRoute>
        ),
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
  {
    path: '/register',
    element: <App />,
    children: [
      {
        index: true,
        element: <RegisterPage />,
      },
    ],

  },
]);
