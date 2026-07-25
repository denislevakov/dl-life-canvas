import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type AuthResult = { ok: true; message?: string } | { ok: false; message: string };

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  accessLoading: boolean;
  accessChecked: boolean;
  approved: boolean;
  accessError: string | null;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const OWNER_EMAIL = "denlevakov@gmail.com";
const ACCESS_CHECK_RETRY_DELAYS_MS = [0, 400, 1_000];
const SESSION_RESTORE_TIMEOUT_MS = 60_000;
const SIGN_IN_TIMEOUT_MS = 30_000;

const reportClientBoot = (stage: string, detail?: string) => {
  if (typeof window !== "undefined") {
    window.__gugentusBootReport?.(stage, detail);
  }
};

const authUnavailable = (): AuthResult => ({
  ok: false,
  message:
    "Supabase пока не настроен. Добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY на сервере.",
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
  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("load failed") ||
    normalized.includes("network") ||
    normalized.includes("timed out") ||
    normalized.includes("timeout")
  ) {
    return "Не удалось связаться с сервером входа. Проверьте интернет и попробуйте еще раз.";
  }
  if (normalized.includes("user already registered"))
    return "Пользователь с таким email уже зарегистрирован.";
  if (normalized.includes("password")) return "Пароль должен соответствовать требованиям Supabase.";
  return message;
};

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(
      () => reject(new Error("Authentication request timed out")),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([Promise.resolve(promise), timeout]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [approved, setApproved] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    reportClientBoot("auth-provider-mounted");
    if (!supabase) {
      reportClientBoot("supabase-not-configured");
      setLoading(false);
      return;
    }

    let mounted = true;
    const loadingTimeout = window.setTimeout(() => {
      if (!mounted) return;
      reportClientBoot("auth-session-timeout");
      setLoading(false);
    }, SESSION_RESTORE_TIMEOUT_MS);

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      reportClientBoot("auth-state-ready", event);
      window.clearTimeout(loadingTimeout);
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      window.clearTimeout(loadingTimeout);
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session || !supabase) {
      setAccessLoading(false);
      setAccessChecked(false);
      setApproved(false);
      setAccessError(null);
      return;
    }

    let mounted = true;
    const email = session.user.email?.trim().toLowerCase();
    if (!email) {
      setAccessLoading(false);
      setAccessChecked(true);
      setApproved(false);
      setAccessError("У аккаунта нет email. Доступ невозможен.");
      return;
    }

    if (email === OWNER_EMAIL) {
      reportClientBoot("owner-access-approved");
      setAccessLoading(false);
      setAccessChecked(true);
      setApproved(true);
      setAccessError(null);
      return;
    }

    setAccessLoading(true);
    setAccessChecked(false);
    setApproved(false);
    setAccessError(null);

    const checkApprovedAccess = async () => {
      for (const delay of ACCESS_CHECK_RETRY_DELAYS_MS) {
        if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
        if (!mounted) return;

        const { data, error } = await supabase
          .from("approved_emails")
          .select("email")
          .eq("email", email)
          .maybeSingle();

        if (!error) {
          if (!mounted) return;
          setApproved(Boolean(data?.email));
          setAccessError(null);
          setAccessChecked(true);
          setAccessLoading(false);
          return;
        }
      }

      if (!mounted) return;
      setApproved(false);
      setAccessError("Не удалось проверить доступ. Попробуйте обновить страницу.");
      setAccessChecked(true);
      setAccessLoading(false);
    };

    void checkApprovedAccess();

    return () => {
      mounted = false;
    };
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      accessLoading,
      accessChecked,
      approved,
      accessError,
      configured: isSupabaseConfigured,
      async signIn(email, password) {
        if (!supabase) return authUnavailable();
        reportClientBoot("auth-sign-in-started");

        try {
          const { data, error } = await withTimeout(
            supabase.auth.signInWithPassword({ email, password }),
            SIGN_IN_TIMEOUT_MS,
          );
          if (error) {
            reportClientBoot("auth-sign-in-error", error.code ?? error.message);
            return { ok: false, message: humanizeAuthError(error.message) };
          }

          if (!data.session) {
            reportClientBoot("auth-sign-in-no-session");
            return { ok: false, message: "Сервер не вернул сессию. Попробуйте войти еще раз." };
          }

          setSession(data.session);
          setLoading(false);
          reportClientBoot("auth-sign-in-success");
          openOverview();
          return { ok: true };
        } catch (error) {
          const message = error instanceof Error ? error.message : undefined;
          reportClientBoot("auth-sign-in-exception", message);
          return { ok: false, message: humanizeAuthError(message) };
        }
      },
      async signUp() {
        return {
          ok: false,
          message: "Регистрация закрыта. Доступ выдает владелец сайта после одобрения email.",
        };
      },
      async signOut() {
        if (!supabase) return;
        await supabase.auth.signOut();
      },
    }),
    [accessChecked, accessError, accessLoading, approved, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
