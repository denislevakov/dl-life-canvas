import { useState } from "react";
import { useCapital } from "@/lib/capital-store";
import {
  completedCount,
  monthDays,
  monthStats,
  monthWeeks,
  ROUTINE_STARTED_ON,
  routineGroups,
  shiftDate,
  shiftMonth,
} from "@/lib/routine-history";

const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));

export function RoutineHistory({ periods }: { periods: { day: string; week: string } }) {
  const { state, update } = useCapital();
  const [chosenMonth, setMonth] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ kind: "day" | "week"; date: string } | null>(null);
  const month = chosenMonth ?? periods.day.slice(0, 7);
  const checks = state.routineChecks ?? {};
  const days = monthDays(month);
  const stats = monthStats(checks, month, periods.day);
  const offset = (new Date(`${days[0]}T12:00:00Z`).getUTCDay() + 6) % 7;
  const selectedGroup = routineGroups.find((group) => group.id === selected?.kind);
  const buttonClass =
    "min-h-11 rounded-lg border border-border px-3 text-sm hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed";
  const changeMonth = (amount: number) => {
    setMonth(shiftMonth(month, amount));
    setSelected(null);
  };

  return (
    <details className="rounded-xl border border-border bg-card px-4 py-1 md:col-span-2">
      <summary className="min-h-11 cursor-pointer py-3 font-display text-sm">
        История и статистика
      </summary>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Учёт с 13 октября 2026 · МСК. Сегодня не входит в итоги месяца. Пустые прошедшие дни
        означают отсутствие отметок, а не обязательно невыполнение.
      </p>
      <div className="my-5 flex items-center justify-between gap-2">
        <button
          type="button"
          className={buttonClass}
          disabled={month <= ROUTINE_STARTED_ON.slice(0, 7)}
          onClick={() => changeMonth(-1)}
          aria-label="Предыдущий месяц"
        >
          ←
        </button>
        <h3 className="text-center font-display text-lg">
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
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
              <span key={day} className="py-2 text-xs text-muted-foreground">
                {day}
              </span>
            ))}
            {Array.from({ length: offset }, (_, index) => (
              <span key={`blank-${index}`} />
            ))}
            {days.map((date) => {
              const available = date >= ROUTINE_STARTED_ON && date <= periods.day;
              const count = completedCount(checks, "day", date);
              return (
                <button
                  key={date}
                  type="button"
                  disabled={!available}
                  aria-label={`${dateLabel(date)}: ${available ? `${count} из 4${date === periods.day ? ", сегодня" : ""}` : "вне периода учёта"}`}
                  aria-pressed={selected?.kind === "day" && selected.date === date}
                  onClick={() => setSelected({ kind: "day", date })}
                  className={`min-h-14 rounded-lg border p-1 text-sm disabled:opacity-30 ${selected?.kind === "day" && selected.date === date ? "ring-2 ring-[var(--gold)]" : ""} ${count === 4 && available ? "border-emerald-500/50 bg-emerald-500/15" : "border-border hover:bg-muted/50"} ${date === periods.day ? "font-bold underline" : ""}`}
                >
                  {Number(date.slice(-2))}
                  <span className="block text-[10px] text-muted-foreground">
                    {available ? `${count}/4` : "—"}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Нажми на дату, чтобы посмотреть или исправить отметки. Зелёный — 4/4, подчёркнутый —
            сегодня.
          </p>
        </div>
        <div>
          <h3 className="font-display text-lg">Итоги месяца</h3>
          <p className="my-3 text-sm">
            {stats.days
              ? `Полностью отмечено дней: ${stats.full} из ${stats.days}`
              : "Пока нет завершённых дней для статистики"}
          </p>
          <div className="space-y-4">
            {stats.rules.map((rule) => (
              <div key={rule.id}>
                <div className="mb-1 flex justify-between gap-3 text-sm">
                  <span>{rule.label}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {rule.percent === null ? "—" : `${rule.done}/${stats.days} · ${rule.percent}%`}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-[var(--gold)]"
                    style={{ width: `${rule.percent ?? 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <h3 className="mb-3 mt-6 font-display text-lg">История недель</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {monthWeeks(month, periods.week).map((week) => (
          <button
            key={week}
            type="button"
            className={`${buttonClass} py-3 text-left`}
            aria-pressed={selected?.kind === "week" && selected.date === week}
            onClick={() => setSelected({ kind: "week", date: week })}
          >
            <span className="block">
              {dateLabel(week)} – {dateLabel(shiftDate(week, 6))}
            </span>
            <span className="text-xs text-muted-foreground">
              {completedCount(checks, "week", week)}/4{week === periods.week ? " · ещё идёт" : ""}
              {week < ROUTINE_STARTED_ON ? " · учёт с 13 октября" : ""}
            </span>
          </button>
        ))}
      </div>
      {selected && selectedGroup && (
        <fieldset className="mt-5 rounded-lg border border-border p-4">
          <legend className="px-2 text-sm">
            {selected.kind === "day" ? "День" : "Неделя с"} {dateLabel(selected.date)}
          </legend>
          <p className="mb-2 text-xs text-muted-foreground">
            Изменения сохраняются сразу и учитываются в статистике.
          </p>
          <div className="grid gap-1 sm:grid-cols-2">
            {selectedGroup.items.map(([id, label]) => (
              <label key={id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[var(--gold)]"
                  checked={checks[`${selected.kind}:${selected.date}`]?.[id] === true}
                  onChange={(event) => {
                    const key = `${selected.kind}:${selected.date}`;
                    update({
                      routineChecks: {
                        ...checks,
                        [key]: { ...checks[key], [id]: event.target.checked },
                      },
                    });
                  }}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </details>
  );
}
