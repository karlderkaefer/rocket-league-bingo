import { createHashRouter, Navigate } from 'react-router-dom';

import { HomePage } from '@/features/rooms/components/HomePage';
import { CreateRoomPage } from '@/features/rooms/components/CreateRoomPage';
import { JoinRoomPage } from '@/features/rooms/components/JoinRoomPage';
import { GamePage } from '@/features/game/components/GamePage';

export const router = createHashRouter([
  { path: '/', element: <HomePage /> },
  { path: '/create', element: <CreateRoomPage /> },
  { path: '/join/:code?', element: <JoinRoomPage /> },
  { path: '/game/:roomId', element: <GamePage /> },
  // Catch-all: handles OAuth callback fragments (access_token=...) and any unknown routes
  { path: '*', element: <Navigate to="/" replace /> },
]);
