import { Check } from "lucide-react";

import { routineGroups, routineItems, shiftDate } from "@/lib/routine-history";

export type RoutineKind = "day" | "week";

const shortDate = (date: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));

export function RoutineTimeline({
  kind,
  date,
  checks,
  onToggle,
  eyebrow,
}: {
  kind: RoutineKind;
  date: string;
  checks: Record<string, boolean>;
  onToggle: (id: string, checked: boolean) => void;
  eyebrow?: string;
}) {
  const group = routineGroups.find((entry) => entry.id === kind)!;
  const applicableIds = new Set(routineItems(kind, date).map(([id]) => id));
  const done = [...applicableIds].filter((id) => checks[id] === true).length;
  const periodLabel =
    kind === "day" ? shortDate(date) : `${shortDate(date)} — ${shortDate(shiftDate(date, 6))}`;

  return (
    <section
      className={`p-3 md:grid md:grid-cols-[7.5rem_minmax(0,1fr)_3rem] md:items-center md:gap-4 ${kind === "week" ? "border-t border-border xl:border-l xl:border-t-0" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-3 md:block">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {eyebrow ?? (kind === "day" ? "Сегодня" : "Эта неделя")}
          </div>
          <div className="mt-0.5 whitespace-nowrap text-[11px] text-muted-foreground">
            {periodLabel}
          </div>
        </div>
        <div className="font-display text-lg tabular text-[color:var(--gold)] md:hidden">
          {done}/{applicableIds.size}
        </div>
      </div>

      <div className="relative mt-3 md:mt-0">
        <div className="absolute left-[12.5%] right-[12.5%] top-3 h-px bg-border" />
        <div className="relative grid grid-cols-4 gap-1">
          {group.items.map(([id, label]) => {
            const applicable = applicableIds.has(id);
            const checked = checks[id] === true && applicable;
            return (
              <button
                key={id}
                type="button"
                role="checkbox"
                aria-checked={checked}
                disabled={!applicable}
                onClick={() => onToggle(id, !checked)}
                className="group flex min-w-0 flex-col items-center text-center disabled:cursor-default"
              >
                <span
                  className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
                    checked
                      ? "border-[color:var(--gold)] bg-[color:var(--gold)] text-background"
                      : applicable
                        ? "border-border bg-background text-transparent group-hover:border-[color:var(--gold)]/70"
                        : "border-border/50 bg-card text-transparent opacity-35"
                  }`}
                >
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </span>
                <span
                  className={`mt-1.5 line-clamp-1 text-[10px] leading-tight ${
                    checked
                      ? "text-[color:var(--gold)]"
                      : applicable
                        ? "text-foreground"
                        : "text-muted-foreground/35"
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="hidden text-right font-display text-lg tabular text-[color:var(--gold)] md:block">
        {done}/{applicableIds.size}
      </div>
    </section>
  );
}
