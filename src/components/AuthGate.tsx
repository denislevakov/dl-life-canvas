import type { ReactNode } from "react";

import { AuthScreen } from "@/components/AuthScreen";
import { useAuth } from "@/lib/auth";

function AccessDenied() {
  const { accessError, signOut, user } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 text-center shadow-sm">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--gold)]">Life Is Good</div>
        <h1 className="mt-3 font-display text-3xl">Доступ не одобрен</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Email {user?.email ? <span className="text-foreground">{user.email}</span> : "этого аккаунта"} пока не добавлен в список доступа.
          Попросите владельца сайта одобрить этот email.
        </p>
        {accessError ? <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{accessError}</div> : null}
        <button
          onClick={() => void signOut()}
          className="mt-5 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Выйти
        </button>
      </div>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { accessChecked, accessLoading, approved, loading, session } = useAuth();

  if (loading || accessLoading || (session && !accessChecked)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--gold)]">Life Is Good</div>
          <div className="mt-3 font-display text-2xl">Проверяю сессию</div>
          <div className="mt-2 text-sm text-muted-foreground">Секунду.</div>
        </div>
      </div>
    );
  }

  if (!session) return <AuthScreen />;

  if (!approved) return <AccessDenied />;

  return <>{children}</>;
}
