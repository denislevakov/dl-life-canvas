import { useEffect, useState } from "react";
import { useCapital } from "@/lib/capital-store";
import { routinePeriods } from "@/lib/routine-periods";
import { routineGroups as groups } from "@/lib/routine-history";
import { RoutineHistory } from "@/components/RoutineHistory";

export function RoutineChecklist() {
  const { state, update } = useCapital();
  const [periods, setPeriods] = useState<ReturnType<typeof routinePeriods> | null>(null);

  useEffect(() => {
    const refresh = () => setPeriods(routinePeriods());
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return (
    <section aria-label="Мои правила" className="mb-6 grid gap-4 md:grid-cols-2">
      {groups.map((group) => {
        const key = periods ? `${group.id}:${periods[group.id]}` : "";
        const checks = state.routineChecks?.[key] ?? {};
        const done = group.items.filter(([id]) => checks[id] === true).length;
        return (
          <div key={group.id} className="rounded-xl border border-border bg-card p-5 md:p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-display text-xl">{group.title}</h2>
              <span className="text-sm text-muted-foreground" aria-live="polite">
                {done} из {group.items.length}
              </span>
            </div>
            <div className="space-y-1">
              {group.items.map(([id, label]) => (
                <label
                  key={id}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0 accent-[var(--gold)]"
                    checked={checks[id] === true}
                    disabled={!periods}
                    onChange={(event) => {
                      // Resolve the period again in case midnight passed before the refresh.
                      const currentKey = `${group.id}:${routinePeriods()[group.id]}`;
                      update({
                        routineChecks: {
                          ...state.routineChecks,
                          [currentKey]: {
                            ...state.routineChecks?.[currentKey],
                            [id]: event.target.checked,
                          },
                        },
                      });
                      setPeriods(routinePeriods());
                    }}
                  />
                  <span
                    className={
                      checks[id] ? "text-sm text-muted-foreground line-through" : "text-sm"
                    }
                  >
                    {label}
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {group.id === "day"
                ? "Новый день — новые отметки"
                : "Новая неделя начинается в понедельник"}{" "}
              · МСК
            </p>
          </div>
        );
      })}
      {periods && <RoutineHistory periods={periods} />}
    </section>
  );
}
