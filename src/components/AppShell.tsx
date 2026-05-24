import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { CapitalProvider } from "@/lib/capital-store";
import { LayoutDashboard, Wallet, Target, Receipt, Briefcase, Map, Sparkles } from "lucide-react";

const nav = [
  { to: "/", label: "Обзор", icon: LayoutDashboard },
  { to: "/assets", label: "Активы", icon: Wallet },
  { to: "/targets", label: "Целевые активы", icon: Target },
  { to: "/budget", label: "Доход и расходы", icon: Receipt },
  { to: "/income-sources", label: "Источники дохода", icon: Briefcase },
  { to: "/life-map", label: "Карта жизни", icon: Map },
  { to: "/freedom", label: "Свобода", icon: Sparkles },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { location } = useRouterState();
  const path = location.pathname;

  return (
    <CapitalProvider>
      <div className="min-h-screen flex bg-background text-foreground">
        <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-border bg-[color:var(--surface-elevated)]/40 backdrop-blur-sm">
          <div className="px-6 py-7 border-b border-border">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Life Capital</div>
            <div className="mt-1 font-display text-xl text-foreground">Личная панель</div>
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
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Этап</div>
            <div className="mt-1 text-sm text-foreground">37–40 · Фундамент</div>
          </div>
        </aside>

        <div className="lg:hidden fixed top-0 inset-x-0 z-30 bg-background/95 backdrop-blur border-b border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="font-display text-lg">Life Capital</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">37–40</div>
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