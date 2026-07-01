const map: Record<string, { label: string; cls: string }> = {
  owned: { label: "В собственности", cls: "bg-[color:oklch(0.3_0.06_160)] text-[color:oklch(0.85_0.1_160)] border-[color:oklch(0.4_0.06_160)]" },
  purchased: { label: "Куплено", cls: "bg-[color:oklch(0.3_0.06_160)] text-[color:oklch(0.85_0.1_160)] border-[color:oklch(0.4_0.06_160)]" },
  done: { label: "Выполнено", cls: "bg-[color:oklch(0.3_0.06_160)] text-[color:oklch(0.85_0.1_160)] border-[color:oklch(0.4_0.06_160)]" },
  idea: { label: "Идея", cls: "bg-muted text-muted-foreground border-border" },
  planned: { label: "Планируется", cls: "bg-[color:oklch(0.3_0.05_240)] text-[color:oklch(0.8_0.05_240)] border-[color:oklch(0.4_0.05_240)]" },
  in_progress: { label: "В работе", cls: "bg-[color:oklch(0.35_0.1_78)] text-[color:var(--gold)] border-[color:oklch(0.45_0.1_78)]" },
  active: { label: "Активен", cls: "bg-[color:oklch(0.3_0.06_160)] text-[color:oklch(0.85_0.1_160)] border-[color:oklch(0.4_0.06_160)]" },
  paused: { label: "На паузе", cls: "bg-muted text-muted-foreground border-border" },
};

export function StatusBadge({ status }: { status: string }) {
  const v = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={"inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase tracking-wider border " + v.cls}>
      {v.label}
    </span>
  );
}
