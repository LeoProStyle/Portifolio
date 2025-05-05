'use client';

import { useAuth } from '@clerk/nextjs';

export function AuthProvider({ children }) {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return <div>Carregando...</div>;
  }

  return <>{children}</>;
} 