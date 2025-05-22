'use client';

import { useAuth } from '@/context/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TableGrid from '@/components/tables/TableGrid';

export default function TablesPage() {
  const { currentStaff, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && currentStaff) {
      // Restrict access for non-waiter roles (except admin)
      if (currentStaff.role !== 'waiter' && currentStaff.role !== 'admin') {
        router.push('/');
      }
    }
  }, [currentStaff, isAuthenticated, router]);

  // If not authenticated or not authorized, don't render the content
  if (!isAuthenticated || !currentStaff || (currentStaff.role !== 'waiter' && currentStaff.role !== 'admin')) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Gerenciamento de Mesas</h1>
      </div>
      
      <TableGrid />
    </div>
  );
}