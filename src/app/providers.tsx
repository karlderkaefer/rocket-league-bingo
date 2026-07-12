import { createContext, useContext, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useAuth } from '@/features/auth/hooks/useAuth';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const auth = useAuth();

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
