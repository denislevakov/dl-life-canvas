import { useState } from "react";

import { RoutineTimeline } from "@/components/RoutineTimeline";
import { useCapital } from "@/lib/capital-store";
import {
  completedCount,
  monthDays,
  monthStats,
  monthWeekStats,
  ROUTINE_STARTED_ON,
  routineGroups,
  routineItems,
  shiftMonth,
  weekStart,
} from "@/lib/routine-history";

const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));

function StatsGroup({
  title,
  full,
  total,
  rules,
}: {
  title: string;
  full: number;
  total: number;
  rules: { id: string; label: string; done: number; total: number; percent: number | null }[];
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-sm">{title}</h3>
        <span className="text-[11px] text-muted-foreground">
          Полностью {full}/{total}
        </span>
      </div>
      <div className="space-y-2">
        {rules.map((rule) => (
          <div key={rule.id}>
            <div className="mb-0.5 flex justify-between gap-3 text-[11px]">
              <span>{rule.label}</span>
              <span className="shrink-0 text-muted-foreground">
                {rule.percent === null ? "—" : `${rule.done}/${rule.total} · ${rule.percent}%`}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-[var(--gold)]" style={{ width: `${rule.percent ?? 0}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RoutineHistory({ periods }: { periods: { day: string; week: string } }) {
  const { state, update } = useCapital();
  const [chosenMonth, setMonth] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const month = chosenMonth ?? periods.day.slice(0, 7);
  const checks = state.routineChecks ?? {};
  const days = monthDays(month);
  const dayStats = monthStats(checks, month, periods.day);
  const weekStats = monthWeekStats(checks, month, periods.week);
  const offset = (new Date(`${days[0]}T12:00:00Z`).getUTCDay() + 6) % 7;
  const selectedWeek = selectedDate ? weekStart(selectedDate) : null;
  const buttonClass =
    "h-9 rounded-lg border border-border px-3 text-sm hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-30";

  const changeMonth = (amount: number) => {
    setMonth(shiftMonth(month, amount));
    setSelectedDate(null);
  };

  const updateCheck = (kind: "day" | "week", period: string, id: string, checked: boolean) => {
    const key = `${kind}:${period}`;
    update({
      routineChecks: {
        ...checks,
        [key]: { ...checks[key], [id]: checked },
      },
    });
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            История
          </div>
          <h2 className="mt-1 font-display text-xl">Календарь</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={buttonClass}
            disabled={month <= ROUTINE_STARTED_ON.slice(0, 7)}
            onClick={() => changeMonth(-1)}
            aria-label="Предыдущий месяц"
          >
            ←
          </button>
          <h3 className="min-w-36 text-center font-display text-base capitalize">
            {new Intl.DateTimeFormat("ru-RU", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }).format(new Date(`${month}-01T12:00:00Z`))}
          </h3>
          <button
            type="button"
            className={buttonClass}
            disabled={month >= periods.day.slice(0, 7)}
            onClick={() => changeMonth(1)}
            aria-label="Следующий месяц"
          >
            →
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-center">
        <div className="grid grid-cols-7 gap-1 text-center">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
            <span key={day} className="py-1 text-xs text-muted-foreground">
              {day}
            </span>
          ))}
          {Array.from({ length: offset }, (_, index) => (
            <span key={`blank-${index}`} />
          ))}
          {days.map((date) => {
            const available = date >= ROUTINE_STARTED_ON && date <= periods.day;
            const dayCount = completedCount(checks, "day", date);
            const dayTarget = routineItems("day", date).length;
            const week = weekStart(date);
            const weekCount = completedCount(checks, "week", week);
            const dayComplete = available && dayCount === dayTarget;
            const weekComplete = available && weekCount === routineGroups[1].items.length;
            const selected = selectedDate === date;

            return (
              <button
                key={date}
                type="button"
                disabled={!available}
                aria-label={`${dateLabel(date)}: день ${dayCount} из ${dayTarget}, неделя ${weekCount} из 4`}
                aria-pressed={selected}
                onClick={() => setSelectedDate(selected ? null : date)}
                className={`min-h-12 rounded-lg border px-1 py-0.5 text-xs transition-colors disabled:opacity-30 ${
                  selected
                    ? "border-[color:var(--gold)] ring-2 ring-[color:var(--gold)]/35"
                    : dayComplete
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : "border-border hover:bg-muted/50"
                } ${date === periods.day ? "font-bold" : ""}`}
              >
                <span className={date === periods.day ? "underline" : ""}>
                  {Number(date.slice(-2))}
                </span>
                {available ? (
                  <span className="mt-0.5 grid gap-0.5 text-[9px] leading-none">
                    <span className={dayComplete ? "text-emerald-400" : "text-muted-foreground"}>
                      Д {dayCount}/{dayTarget}
                    </span>
                    <span
                      className={
                        weekComplete ? "text-[color:var(--gold)]" : "text-muted-foreground"
                      }
                    >
                      Н {weekCount}/4
                    </span>
                  </span>
                ) : (
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">—</span>
                )}
              </button>
            );
          })}
        </div>

        <aside className="grid gap-4 rounded-lg border border-border/70 bg-background/30 p-4">
          <StatsGroup
            title="Дни"
            full={dayStats.full}
            total={dayStats.days}
            rules={dayStats.rules}
          />
          <StatsGroup
            title="Недели"
            full={weekStats.full}
            total={weekStats.weeks}
            rules={weekStats.rules}
          />
        </aside>
      </div>

      {selectedDate && selectedWeek ? (
        <div className="mt-5 grid overflow-hidden rounded-lg border border-border bg-background/30 xl:grid-cols-2">
          <RoutineTimeline
            kind="day"
            date={selectedDate}
            checks={checks[`day:${selectedDate}`] ?? {}}
            onToggle={(id, checked) => updateCheck("day", selectedDate, id, checked)}
            eyebrow="День"
          />
          <RoutineTimeline
            kind="week"
            date={selectedWeek}
            checks={checks[`week:${selectedWeek}`] ?? {}}
            onToggle={(id, checked) => updateCheck("week", selectedWeek, id, checked)}
            eyebrow="Неделя"
          />
        </div>
      ) : null}
    </section>
  );
}
