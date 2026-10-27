import { useEffect, useState } from "react";

import { RoutineHistory } from "@/components/RoutineHistory";
import { RoutineTimeline, type RoutineKind } from "@/components/RoutineTimeline";
import { useCapital } from "@/lib/capital-store";
import { routineGroups } from "@/lib/routine-history";
import { routinePeriods } from "@/lib/routine-periods";

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

  if (!periods) return null;

  const toggle = (kind: RoutineKind, id: string, checked: boolean) => {
    const livePeriods = routinePeriods();
    const key = `${kind}:${livePeriods[kind]}`;
    update({
      routineChecks: {
        ...state.routineChecks,
        [key]: { ...state.routineChecks?.[key], [id]: checked },
      },
    });
    setPeriods(livePeriods);
  };

  return (
    <div className="grid gap-4">
      <div className="grid overflow-hidden rounded-xl border border-border bg-card xl:grid-cols-2">
        {routineGroups.map((group) => {
          const key = `${group.id}:${periods[group.id]}`;
          return (
            <RoutineTimeline
              key={group.id}
              kind={group.id}
              date={periods[group.id]}
              checks={state.routineChecks?.[key] ?? {}}
              onToggle={(id, checked) => toggle(group.id, id, checked)}
            />
          );
        })}
      </div>
      <RoutineHistory periods={periods} />
    </div>
  );
}
