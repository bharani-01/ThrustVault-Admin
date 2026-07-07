import React, { createContext, useContext, useState, useEffect } from 'react';

export interface UserSession {
  email: string;
  role: 'user' | 'admin';
  name?: string;
  token?: string; // Optional if session uses express cookies
}

interface AuthContextType {
  session: UserSession | null;
  isLoading: boolean;
  login: (sessionData: UserSession) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Verify session with the backend directly
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data && data.logged_in && data.role === 'admin') {
          setSession({ email: data.email, role: 'admin' });
        } else {
          setSession(null);
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
      })
      .catch(err => {
        console.error('Session check failed:', err);
        setSession(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = (sessionData: UserSession) => {
    setSession(sessionData);
    localStorage.setItem('thrustvault_admin_session', JSON.stringify(sessionData));
  };

  const logout = async () => {
    setSession(null);
    localStorage.removeItem('thrustvault_session');
    try {
      // Call backend logout API to clear express session cookie if active
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Backend logout call skipped or failed', e);
    }
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ session, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
