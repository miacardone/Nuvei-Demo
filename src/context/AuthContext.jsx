import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import brand from '@/brand/brand.config';
import { CURRENT_USER } from '@/data/people';

/**
 * Demo authentication.
 *
 * Unlike the reference, this does NOT clear storage as an import-time side
 * effect — a module that mutates localStorage when it is merely imported is a
 * surprise. The session simply starts empty each load.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const signIn = useCallback(async (username, password) => {
    setBusy(true);
    setError(null);
    await new Promise((r) => setTimeout(r, 320));
    setBusy(false);

    const ok = username === brand.demoCredentials.username && password === brand.demoCredentials.password;
    if (!ok) {
      setError('Those credentials were not recognized.');
      return false;
    }
    setUser({ ...CURRENT_USER });
    return true;
  }, []);

  const signOut = useCallback(() => setUser(null), []);

  const value = useMemo(
    () => ({ user, error, busy, signIn, signOut, isAuthenticated: Boolean(user) }),
    [user, error, busy, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export default AuthProvider;
