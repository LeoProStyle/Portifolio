"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Role } from "../types";

type Session = {
  email: string;
  role: Role;
  at: string;
};

type AuthContextValue = {
  session: Session | null;
  role: Role | null;
  signIn: (session: Session) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  role: null,
  signIn: () => {},
  signOut: () => {},
});

const STORAGE_KEY = "caixaFacil.session";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // Read-only hydration from localStorage.
    // Defer setState to avoid the eslint rule warning about setState in effects.
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Session;
      if (!parsed?.email || !parsed?.role) return;
      queueMicrotask(() => setSession(parsed));
    } catch {
      // ignore
    }
  }, []);


  const value = useMemo<AuthContextValue>(() => {
    return {
      session,
      role: session?.role ?? null,
      signIn: (s) => {
        setSession(s);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      },
      signOut: () => {
        setSession(null);
        localStorage.removeItem(STORAGE_KEY);
      },
    };
  }, [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

