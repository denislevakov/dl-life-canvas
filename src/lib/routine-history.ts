// The checklist was first published on this date; earlier days are not misses.
export const ROUTINE_STARTED_ON = "2026-10-13";
export type RoutineChecks = Record<string, Record<string, boolean>>;

export const routineGroups = [
  {
    id: "day",
    title: "Сегодня",
    items: [
      ["wake", "Подъем в 7:30"],
      ["nonfiction", "Нон-фикшен 20 мин."],
      ["fiction", "Фикшен 20 мин."],
      ["sleep", "Сон до 23:30"],
    ],
  },
  {
    id: "week",
    title: "Неделя",
    items: [
      ["workouts", "Две тренировки"],
      ["active", "Активный выходной"],
      ["rest", "Выходной без решений"],
      ["pool", "Бассейн"],
    ],
  },
] as const;

const weekendDailyItemIds = new Set(["nonfiction", "fiction"]);

export function isWeekend(date: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function routineItems(kind: "day" | "week", date: string) {
  const group = routineGroups.find((entry) => entry.id === kind)!;
  if (kind !== "day" || !isWeekend(date)) return group.items;
  return group.items.filter(([id]) => weekendDailyItemIds.has(id));
}

export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function monthDays(month: string) {
  const result: string[] = [];
  for (let date = `${month}-01`; date.startsWith(month); date = shiftDate(date, 1))
    result.push(date);
  return result;
}

export function shiftMonth(month: string, amount: number) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
}

export function completedCount(checks: RoutineChecks, kind: "day" | "week", date: string) {
  return routineItems(kind, date).filter(([id]) => checks[`${kind}:${date}`]?.[id] === true).length;
}

export function monthStats(checks: RoutineChecks, month: string, today: string) {
  const days = monthDays(month).filter((date) => date >= ROUTINE_STARTED_ON && date < today);
  return {
    days: days.length,
    full: days.filter(
      (date) => completedCount(checks, "day", date) === routineItems("day", date).length,
    ).length,
    rules: routineGroups[0].items.map(([id, label]) => {
      const eligibleDays = days.filter((date) =>
        routineItems("day", date).some(([itemId]) => itemId === id),
      );
      const done = eligibleDays.filter((date) => checks[`day:${date}`]?.[id] === true).length;
      return {
        id,
        label,
        done,
        total: eligibleDays.length,
        percent: eligibleDays.length ? Math.round((done / eligibleDays.length) * 100) : null,
      };
    }),
  };
}

export function monthWeeks(month: string, currentWeek: string) {
  const first = `${month}-01`;
  const offset = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const weeks: string[] = [];
  for (
    let date = shiftDate(first, -offset);
    date <= monthDays(month).at(-1)!;
    date = shiftDate(date, 7)
  ) {
    if (shiftDate(date, 6) >= ROUTINE_STARTED_ON && date <= currentWeek) weeks.push(date);
  }
  return weeks;
}
