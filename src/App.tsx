import { createHashRouter, RouterProvider } from 'react-router-dom';
import HomePage from './pages/HomePage';
import CreateRoomPage from './pages/CreateRoomPage';
import JoinRoomPage from './pages/JoinRoomPage';
import GamePage from './pages/GamePage';
import ThemeToggle from './components/ThemeToggle';

const router = createHashRouter([
  { path: '/', element: <HomePage /> },
  { path: '/create', element: <CreateRoomPage /> },
  { path: '/join/:code?', element: <JoinRoomPage /> },
  { path: '/game', element: <GamePage /> },
]);

export default function App() {
  return (
    <>
      <ThemeToggle />
      <RouterProvider router={router} />
    </>
  );
}
