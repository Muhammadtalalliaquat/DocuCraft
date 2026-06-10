import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      // Reset logging in state when auth state actually changes
      setIsLoggingIn(false);
    });
    return unsubscribe;
  }, []);

  // Safety mechanism for stuck login state
  useEffect(() => {
    if (isLoggingIn) {
      const timer = setTimeout(() => {
        setIsLoggingIn(false);
        console.warn('Authentication state timeout: resetting lock.');
      }, 15000); // 15s reset
      return () => clearTimeout(timer);
    }
  }, [isLoggingIn]);

  const login = async () => {
    if (isLoggingIn) {
      console.warn('Authentication attempt blocked: Another login is currently in progress.');
      return;
    }
    
    if (auth.currentUser) {
      toast.success('Already logged in as ' + (auth.currentUser.displayName || auth.currentUser.email));
      return;
    }
    
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    
    try {
      console.log('Initiating Firebase popup authentication...');
      await signInWithPopup(auth, provider);
      toast.success('Successfully logged in!');
    } catch (error: any) {
      console.error('Firebase Auth Error Trace:', error);
      
      if (error.code === 'auth/popup-closed-by-user') {
        toast.error('Sign-in window closed before completion.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        console.warn('Concurrent popup request detected and suppressed.');
      } else if (error.code === 'auth/unauthorized-domain') {
        toast.error('Security Error: Unauthorized domain. Check Firebase console.');
      } else if (error.code === 'auth/network-request-failed') {
        toast.error('Network failure. Check your connection.');
      } else {
        toast.error('Authentication failed: ' + (error.message || 'Unknown protocol error'));
      }
    } finally {
      setIsLoggingIn(false);
      console.log('Authentication state lock released.');
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      toast.success('Logged out');
    } catch (error) {
      console.error(error);
      toast.error('Logout failed');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
