import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../constants/firebase';
import { setCrashContext } from '../utils/crashReporter';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      // Para saber a quien le ocurrio el fallo. Solo el uid, nada mas.
      setCrashContext({ uid: firebaseUser?.uid || null });
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { user, loading };
}
