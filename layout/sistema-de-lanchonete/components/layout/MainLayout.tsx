'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated && pathname !== '/login') {
      router.push('/login');
    }
  }, [isAuthenticated, router, pathname]);

  // If user is not logged in and not on login page, don't render anything
  if (!isAuthenticated && pathname !== '/login') {
    return null;
  }

  // Don't show sidebar on login page
  if (pathname === '/login') {
    return (
      <div className="min-h-screen bg-background">
        {children}
        <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 md:ml-64 p-4 md:p-6 overflow-auto">
        {children}
        <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
      </div>
    </div>
  );
}