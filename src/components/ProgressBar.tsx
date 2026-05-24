export function ProgressBar({ value, max = 100, accent = "gold" }: { value: number; max?: number; accent?: "gold" | "green" | "steel" }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const bg =
    accent === "gold"
      ? "var(--gradient-gold)"
      : accent === "green"
        ? "var(--gradient-green)"
        : "linear-gradient(90deg, var(--steel), var(--muted-foreground))";
  return (
    <div className="h-1.5 w-full rounded-full bg-[color:var(--surface-elevated)] overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: bg }} />
    </div>
  );
}