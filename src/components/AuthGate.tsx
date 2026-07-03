import type { ReactNode } from "react";

import { AuthScreen } from "@/components/AuthScreen";
import { useAuth } from "@/lib/auth";
import { isDemoMode } from "@/lib/capital-store";

export function AuthGate({ children }: { children: ReactNode }) {
  const { loading, session } = useAuth();

  if (isDemoMode()) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--gold)]">Life Capital</div>
          <div className="mt-3 font-display text-2xl">Проверяю сессию</div>
          <div className="mt-2 text-sm text-muted-foreground">Секунду.</div>
        </div>
      </div>
    );
  }

  if (!session) return <AuthScreen />;

  return <>{children}</>;
}
