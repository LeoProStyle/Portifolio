'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  Coffee,
  Utensils,
  CreditCard,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Sidebar() {
  const pathname = usePathname();
  const { currentStaff, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Fechar o menu quando a tela for redimensionada para desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fechar o menu quando clicar fora dele em dispositivos móveis
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.getElementById('sidebar');
      const menuButton = document.getElementById('menu-button');
      
      if (isOpen && sidebar && menuButton && 
          !sidebar.contains(event.target as Node) && 
          !menuButton.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const closeSidebar = () => {
    setIsOpen(false);
  };

  // Navigation links based on user role
  const getNavLinks = () => {
    const links = [
      { href: '/', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    ];

    if (currentStaff?.role === 'waiter' || currentStaff?.role === 'admin') {
      links.push(
        { href: '/tables', label: 'Mesas', icon: <Utensils className="h-5 w-5" /> },
      );
    }

    if (currentStaff?.role === 'bar' || currentStaff?.role === 'kitchen' || currentStaff?.role === 'admin') {
      links.push(
        { href: '/orders', label: 'Pedidos', icon: <Coffee className="h-5 w-5" /> },
      );
    }

    if (currentStaff?.role === 'cashier' || currentStaff?.role === 'admin') {
      links.push(
        { href: '/checkout', label: 'Caixa', icon: <CreditCard className="h-5 w-5" /> },
      );
    }

    return links;
  };

  const navLinks = getNavLinks();

  return (
    <>
      {/* Mobile menu button */}
      <button
        id="menu-button"
        className="fixed top-4 left-4 z-50 md:hidden bg-primary/20 text-primary rounded-md p-2"
        onClick={toggleSidebar}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Menu className="h-6 w-6" />
        )}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        id="sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-card shadow-lg transform transition-transform duration-300 ease-in-out md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b">
            <h2 className="text-xl font-bold">Lanchonete System</h2>
            {currentStaff && (
              <div className="mt-2 text-sm text-muted-foreground">
                <span>Olá, {currentStaff.name}</span>
                <span className="block capitalize">({currentStaff.role})</span>
              </div>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-2">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={closeSidebar}
                    className={cn(
                      "flex items-center p-3 rounded-md transition-colors hover:bg-accent group",
                      pathname === link.href
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "text-foreground hover:bg-accent"
                    )}
                  >
                    <span className="mr-3">{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="p-4 border-t">
            <button
              onClick={logout}
              className="flex items-center p-3 w-full rounded-md transition-colors hover:bg-accent text-foreground"
            >
              <LogOut className="mr-3 h-5 w-5" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}