import type { ReactNode } from "react";

interface Props {
  label: string;
  value: ReactNode;
  sublabel?: ReactNode;
  accent?: "default" | "gold" | "green";
  className?: string;
}

export function MetricCard({ label, value, sublabel, accent = "default", className = "" }: Props) {
  const accentClass =
    accent === "gold"
      ? "text-[color:var(--gold)]"
      : accent === "green"
        ? "text-[color:oklch(0.7_0.1_160)]"
        : "text-foreground";
  return (
    <div className={"rounded-lg border border-border bg-card p-5 " + className}>
      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className={"mt-2 font-display text-2xl md:text-[28px] leading-tight tabular " + accentClass}>{value}</div>
      {sublabel && <div className="mt-1.5 text-xs text-muted-foreground tabular">{sublabel}</div>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="mb-8">
      {eyebrow && <div className="text-[10px] uppercase tracking-[0.25em] text-[color:var(--gold)]">{eyebrow}</div>}
      <h1 className="font-display text-3xl md:text-4xl mt-2 text-foreground">{title}</h1>
      {description && <p className="mt-2 text-sm text-muted-foreground max-w-2xl">{description}</p>}
    </div>
  );
}

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="px-6 md:px-10 py-8 md:py-12 max-w-[1400px] mx-auto">{children}</div>;
}