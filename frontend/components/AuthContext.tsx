'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export interface AuthUser {
  email: string;
  role: 'admin' | 'analyst';
  id?: number;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, role: 'admin' | 'analyst', accessToken: string, refreshToken: string) => void;
  logout: () => void;
  isLoading: boolean;
  isAdmin: boolean;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check localStorage on mount
    try {
      const savedToken = localStorage.getItem('context_token');
      const savedRole = localStorage.getItem('context_role') as 'admin' | 'analyst' | null;
      const savedEmail = localStorage.getItem('context_email');

      if (savedToken && savedRole && savedEmail) {
        setToken(savedToken);
        setUser({ email: savedEmail, role: savedRole });
      } else if (pathname !== '/login') {
        router.push('/login');
      }
    } catch (e) {
      console.error('Error reading auth storage', e);
    } finally {
      setIsLoading(false);
    }
  }, [pathname, router]);

  const login = (email: string, role: 'admin' | 'analyst', accessToken: string, refreshToken: string) => {
    localStorage.setItem('context_token', accessToken);
    localStorage.setItem('context_refresh_token', refreshToken);
    localStorage.setItem('context_role', role);
    localStorage.setItem('context_email', email);
    setToken(accessToken);
    setUser({ email, role });
    router.push('/');
  };

  const logout = () => {
    localStorage.removeItem('context_token');
    localStorage.removeItem('context_refresh_token');
    localStorage.removeItem('context_role');
    localStorage.removeItem('context_email');
    setToken(null);
    setUser(null);
    router.push('/login');
  };

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(url, { ...options, headers });
    if (res.status === 401 && pathname !== '/login') {
      logout();
    }
    return res;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isLoading,
        isAdmin: user?.role === 'admin',
        fetchWithAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
