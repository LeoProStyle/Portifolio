'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Staff } from '@/types';
import { mockStaff } from '@/data/mockData';

interface AuthContextType {
  currentStaff: Staff | null;
  isAuthenticated: boolean;
  login: (pin: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentStaff: null,
  isAuthenticated: false,
  login: () => false,
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentStaff, setCurrentStaff] = useState<Staff | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Attempt to restore session from localStorage on component mount
  useEffect(() => {
    const storedStaff = localStorage.getItem('currentStaff');
    if (storedStaff) {
      try {
        const staffData = JSON.parse(storedStaff);
        setCurrentStaff(staffData);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Failed to parse stored staff data', error);
        localStorage.removeItem('currentStaff');
      }
    }
  }, []);

  const login = (pin: string): boolean => {
    const staff = mockStaff.find((s) => s.pin === pin);
    
    if (staff) {
      setCurrentStaff(staff);
      setIsAuthenticated(true);
      // Store in localStorage for persistence
      localStorage.setItem('currentStaff', JSON.stringify(staff));
      return true;
    }
    
    return false;
  };

  const logout = () => {
    setCurrentStaff(null);
    setIsAuthenticated(false);
    localStorage.removeItem('currentStaff');
  };

  return (
    <AuthContext.Provider
      value={{
        currentStaff,
        isAuthenticated,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};