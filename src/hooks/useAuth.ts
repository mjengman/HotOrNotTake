import { useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  signInAnonymous,
  onAuthStateChange,
  getCurrentUser,
  createUserIfNotExists,
} from '../services/userService';

interface UseAuthResult {
  user: FirebaseUser | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = (): UseAuthResult => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      
      // If user is signed in, ensure user document exists
      if (firebaseUser) {
        try {
          await createUserIfNotExists(firebaseUser.uid);
        } catch (err) {
          console.error('Error creating user document:', err);
        }
      }
    });

    // Check if user is already signed in
    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      setLoading(false);
    }

    return unsubscribe;
  }, []);

  const signIn = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await signInAnonymous();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const { signOut: firebaseSignOut } = await import('../services/userService');
      await firebaseSignOut();
      setUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign out failed');
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    loading,
    error,
    signIn,
    signOut,
  };
};