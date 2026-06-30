import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { CapitalProvider, useCapital } from "@/lib/capital-store";
import { useAuth } from "@/lib/auth";
import { LayoutDashboard, Wallet, Target, Receipt, Briefcase, Map, Sparkles, RotateCcw, AlertTriangle, LogOut, UserCircle } from "lucide-react";

const nav = [
  { to: "/", label: "Обзор", icon: LayoutDashboard },
  { to: "/assets", label: "Активы", icon: Wallet },
  { to: "/targets", label: "Целевые активы", icon: Target },
  { to: "/budget", label: "Доход и расходы", icon: Receipt },
  { to: "/income-sources", label: "Источники дохода", icon: Briefcase },
  { to: "/life-map", label: "Карта жизни", icon: Map },
  { to: "/freedom", label: "Свобода", icon: Sparkles },
] as const;

function AccountPanel() {
  const { user, signOut } = useAuth();

  return (
    <div className="rounded-md border border-border bg-[color:var(--surface-elevated)]/50 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <UserCircle className="h-4 w-4 text-[color:var(--gold)]" />
        <span className="truncate">{user?.email ?? "Аккаунт"}</span>
      </div>
      <button
        onClick={() => void signOut()}
        className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span>Выйти</span>
      </button>
    </div>
  );
}

function ResetButton() {
  const { reset } = useCapital();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-3">
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="font-medium">Вернуть всё к начальным значениям?</span>
        </div>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => {
              reset();
              setConfirming(false);
              window.location.reload();
            }}
            className="flex-1 rounded-md bg-destructive px-2 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            Да, сбросить
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="mt-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-[color:var(--surface-elevated)]/60 hover:text-foreground"
    >
      <RotateCcw className="h-3.5 w-3.5" />
      <span>Сбросить данные</span>
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { location } = useRouterState();
  const { signOut } = useAuth();
  const path = location.pathname;

  return (
    <CapitalProvider>
      <div className="min-h-screen flex bg-background text-foreground">
        <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-border bg-[color:var(--surface-elevated)]/40 backdrop-blur-sm">
          <div className="px-6 py-7 border-b border-border">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                window.location.href = '/';
              }}
              className="group inline-block cursor-pointer"
            >
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground group-hover:text-[color:var(--gold)] transition-colors">Life Capital</div>
              <div className="mt-1 font-display text-xl text-foreground group-hover:text-[color:var(--gold)] transition-colors">LIFE IS GOOD</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground group-hover:text-[color:var(--gold)]/80 transition-colors">Дашборд жизни</div>
            </a>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            {nav.map((item) => {
              const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors " +
                    (active
                      ? "bg-[color:var(--surface-elevated)] text-[color:var(--gold)] border border-border"
                      : "text-muted-foreground hover:text-foreground hover:bg-[color:var(--surface-elevated)]/60")
                  }
                >
                  <Icon className="h-4 w-4" strokeWidth={1.5} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="p-4 border-t border-border">
            <AccountPanel />
            <div className="mt-4 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Этап</div>
            <div className="mt-1 text-sm text-foreground">37–40 · Фундамент</div>
            <ResetButton />
          </div>
        </aside>

        <div className="lg:hidden fixed top-0 inset-x-0 z-30 bg-background/95 backdrop-blur border-b border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="font-display text-lg">Life Capital</div>
            <div className="flex items-center gap-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">37–40</div>
              <button
                onClick={() => void signOut()}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-[color:var(--surface-elevated)] hover:text-foreground"
                aria-label="Выйти"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto px-3 pb-2 no-scrollbar">
            {nav.map((item) => {
              const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={
                    "whitespace-nowrap px-3 py-1.5 rounded-md text-xs " +
                    (active ? "bg-[color:var(--surface-elevated)] text-[color:var(--gold)] border border-border" : "text-muted-foreground")
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <main className="flex-1 min-w-0 pt-28 lg:pt-0">{children}</main>
      </div>
    </CapitalProvider>
  );
}