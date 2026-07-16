import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfig } from "../lib/supabase";

const MISSING_SUPABASE_CONFIG_MESSAGE = "Supabase 환경변수가 설정되지 않아 인증을 사용할 수 없습니다.";
const REQUIRED_CREDENTIALS_MESSAGE = "이메일과 비밀번호를 입력해 주세요.";

type AuthActionResult = {
  error: string | null;
};

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signOut: () => Promise<AuthActionResult>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!supabaseConfig.ready) {
      setSession(null);
      setUser(null);
      setAuthError(MISSING_SUPABASE_CONFIG_MESSAGE);
      setLoading(false);
      return;
    }

    async function loadSession() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          setAuthError(error.message);
          setSession(null);
          setUser(null);
          return;
        }

        setSession(data.session);
        setUser(data.session?.user ?? null);
        setAuthError(null);
      } catch {
        if (!mounted) return;
        setAuthError("인증 세션을 확인하는 중 오류가 발생했습니다.");
        setSession(null);
        setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setAuthError(null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthActionResult> => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setAuthError(REQUIRED_CREDENTIALS_MESSAGE);
      return { error: REQUIRED_CREDENTIALS_MESSAGE };
    }

    if (!supabaseConfig.ready) {
      setAuthError(MISSING_SUPABASE_CONFIG_MESSAGE);
      return { error: MISSING_SUPABASE_CONFIG_MESSAGE };
    }

    setAuthError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        setAuthError(error.message);
        return { error: error.message };
      }

      setSession(data.session);
      setUser(data.user);
      return { error: null };
    } catch {
      const message = "로그인 중 오류가 발생했습니다.";
      setAuthError(message);
      return { error: message };
    }
  }, []);

  const signOut = useCallback(async (): Promise<AuthActionResult> => {
    if (!supabaseConfig.ready) {
      setAuthError(MISSING_SUPABASE_CONFIG_MESSAGE);
      return { error: MISSING_SUPABASE_CONFIG_MESSAGE };
    }

    setAuthError(null);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setAuthError(error.message);
        return { error: error.message };
      }

      setSession(null);
      setUser(null);
      return { error: null };
    } catch {
      const message = "로그아웃 중 오류가 발생했습니다.";
      setAuthError(message);
      return { error: message };
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      loading,
      authError,
      signIn,
      signOut,
    }),
    [authError, loading, session, signIn, signOut, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
