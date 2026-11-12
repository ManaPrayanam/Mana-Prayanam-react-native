import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as api from '@/api/auth';
import { ApiError, errorMessage } from '@/api/client';

const key = 'ridego.session';
const readToken = () => Platform.OS === 'web' ? Promise.resolve(null) : SecureStore.getItemAsync(key);
const storeToken = (token: string) => Platform.OS === 'web' ? Promise.resolve() : SecureStore.setItemAsync(key, token);
const clearToken = () => Platform.OS === 'web' ? Promise.resolve() : SecureStore.deleteItemAsync(key);

type Session = { token: string; user: api.User };
type SessionContext = {
  session: Session | null;
  loading: boolean;
  recoveryError: string;
  restore: () => Promise<void>;
  signIn: (email: string, password: string, remember?: boolean) => Promise<void>;
  acceptSession: (session: Session, remember?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  authenticated: <T>(action: (token: string) => Promise<T>) => Promise<T>;
};
const Context = createContext<SessionContext | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryError, setRecoveryError] = useState('');

  const restore = useCallback(async () => {
    try {
      const token = await readToken();
      if (token) setSession({ token, user: await api.me(token) });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await clearToken().catch(() => {});
      } else {
        setRecoveryError(errorMessage(error));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const task = setTimeout(() => { void restore(); }, 0);
    return () => clearTimeout(task);
  }, [restore]);

  async function retryRestore() {
    setLoading(true);
    setRecoveryError('');
    await restore();
  }

  async function signIn(email: string, password: string, remember = true) {
    await acceptSession(await api.login(email, password), remember);
  }

  async function acceptSession({ token, user }: Session, remember = true) {
    if (remember) await storeToken(token);
    else await clearToken();
    setSession({ token, user });
  }

  async function signOut() {
    if (session) {
      try {
        await api.logout(session.token);
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 401)) throw error;
      }
    }
    await clearToken();
    setSession(null);
  }

  const authenticated = useCallback(async <T,>(action: (token: string) => Promise<T>) => {
    if (!session) throw new Error('Sign in first.');
    try {
      return await action(session.token);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await clearToken().catch(() => {});
        setSession(null);
      }
      throw error;
    }
  }, [session]);

  return <Context.Provider value={{ session, loading, recoveryError, restore: retryRestore, signIn, acceptSession, signOut, authenticated }}>
    {children}
  </Context.Provider>;
}

export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error('SessionProvider is missing.');
  return value;
}
