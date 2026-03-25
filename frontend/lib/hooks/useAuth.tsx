'use client';
import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from 'react';
import { authApi } from '../api';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

let cachedUser: User | null = null;
let fetchPromise: Promise<User | null> | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);

  const fetchUser = useCallback(async () => {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    if (fetchPromise) {
      const result = await fetchPromise;
      setUser(result);
      setLoading(false);
      return;
    }
    fetchPromise = authApi
      .me()
      .then((res) => {
        cachedUser = res.data;
        return res.data;
      })
      .catch(() => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
        }
        cachedUser = null;
        return null;
      })
      .finally(() => {
        fetchPromise = null;
      });
    const result = await fetchPromise;
    setUser(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    localStorage.setItem('token', res.data.access_token);
    const meRes = await authApi.me();
    cachedUser = meRes.data;
    setUser(meRes.data);
  };

  const register = async (
    email: string,
    username: string,
    password: string
  ) => {
    const res = await authApi.register({ email, username, password });
    localStorage.setItem('token', res.data.access_token);
    const meRes = await authApi.me();
    cachedUser = meRes.data;
    setUser(meRes.data);
  };

  const googleLogin = async (credential: string) => {
    const res = await authApi.google(credential);
    localStorage.setItem('token', res.data.access_token);
    const meRes = await authApi.me();
    cachedUser = meRes.data;
    setUser(meRes.data);
  };

  const logout = () => {
    localStorage.removeItem('token');
    cachedUser = null;
    setUser(null);
  };

  const refreshUser = async () => {
    cachedUser = null;
    fetchPromise = null;
    await fetchUser();
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, googleLogin, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
