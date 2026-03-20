import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import { MapView } from './components/MapView';

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
]);
