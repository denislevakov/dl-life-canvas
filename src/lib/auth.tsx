import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type AuthResult = { ok: true; message?: string } | { ok: false; message: string };

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const authUnavailable = (): AuthResult => ({
  ok: false,
  message: "Supabase пока не настроен. Добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY на сервере.",
});

const openOverview = () => {
  if (typeof window !== "undefined" && window.location.pathname !== "/") {
    window.location.assign("/");
  }
};

const humanizeAuthError = (message?: string) => {
  if (!message) return "Не удалось выполнить действие. Попробуйте еще раз.";
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "Неверный email или пароль.";
  if (normalized.includes("email not confirmed")) return "Email еще не подтвержден.";
  if (normalized.includes("user already registered")) return "Пользователь с таким email уже зарегистрирован.";
  if (normalized.includes("password")) return "Пароль должен соответствовать требованиям Supabase.";
  return message;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      configured: isSupabaseConfigured,
      async signIn(email, password) {
        if (!supabase) return authUnavailable();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { ok: false, message: humanizeAuthError(error.message) };
        openOverview();
        return { ok: true };
      },
      async signUp(email, password) {
        if (!supabase) return authUnavailable();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: typeof window === "undefined" ? undefined : window.location.origin,
          },
        });
        if (error) return { ok: false, message: humanizeAuthError(error.message) };
        if (!data.session) {
          return { ok: true, message: "Регистрация создана. Проверьте почту и подтвердите email." };
        }
        openOverview();
        return { ok: true };
      },
      async signOut() {
        if (!supabase) return;
        await supabase.auth.signOut();
      },
    }),
    [loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
