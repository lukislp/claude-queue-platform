'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, User, ApiError } from './api';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Promise form on purpose: the state updates happen in the callbacks, not synchronously in
  // the effect below (react-hooks/set-state-in-effect). A 401 means "not signed in"; any other
  // error keeps the previous user, as before.
  const refresh = () =>
    api
      .get<User>('/auth/me')
      .then((me) => {
        setUser(me);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          setUser(null);
        }
      })
      .finally(() => {
        setLoading(false);
      });

  useEffect(() => {
    refresh();
  }, []);

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider.');
  return ctx;
}
