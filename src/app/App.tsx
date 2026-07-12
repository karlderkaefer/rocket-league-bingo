import { RouterProvider } from 'react-router-dom';

import { AuthProvider } from '@/app/providers';
import { AuthGuard } from '@/features/auth/components/AuthGuard';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { router } from '@/app/router';

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AuthGuard>
          <RouterProvider router={router} />
        </AuthGuard>
      </AuthProvider>
    </ErrorBoundary>
  );
}
