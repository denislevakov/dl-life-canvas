import { useEffect, useMemo, useRef, useState } from "react";

import { formatRub } from "@/lib/format";
import { formatMonthKey } from "@/lib/local-date";

export type BudgetHistoryMonth = {
  monthKey: string;
  expense: number;
  income: number;
  expenseCategories: { name: string; total: number }[];
  incomeCategories: { name: string; total: number }[];
};

type HistoryMode = "overall" | "expense" | "income";
type HistoryRange = 1 | 3 | 6 | 12 | "custom";
type ChartDatum = Record<string, number | string> & {
  monthKey: string;
  monthLabel: string;
  expense: number;
  income: number;
  net: number;
};

type ChartSeries = {
  key: string;
  label: string;
  color: string;
};

const INCOME_COLOR = "#42b979";
const EXPENSE_COLOR = "#e57e7e";
const DISTINCT_CATEGORY_COLORS = [
  "#e07a3f",
  "#19aaa8",
  "#8b6edb",
  "#d9b53f",
  "#c65d94",
  "#58a66b",
  "#4d8fd6",
  "#bd5e4b",
  "#33a9c9",
  "#7654c8",
  "#8c9b3e",
  "#e36c82",
  "#3f72c9",
  "#79a840",
  "#9a7048",
  "#cf63bf",
];

const formatCompactRub = (value: number) => {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (absolute >= 1_000_000) {
    const millions = absolute / 1_000_000;
    return `${sign}${millions.toFixed(millions >= 10 ? 0 : 1).replace(".0", "")} млн`;
  }
  if (absolute >= 1_000) return `${sign}${Math.round(absolute / 1_000)} тыс.`;
  return `${sign}${Math.round(absolute)}`;
};

const formatShortMonth = (monthKey: string, showYear = false) => {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  return new Intl.DateTimeFormat("ru-RU", {
    month: "short",
    ...(showYear ? { year: "2-digit" as const } : {}),
  })
    .format(new Date(year, month - 1, 1, 12))
    .replace(" г.", "")
    .replace(".", "");
};

const nextMonthKey = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  const next = new Date(year, month, 1, 12);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
};

const categoryColor = (name: string) => {
  let hash = 2166136261;
  for (const character of name) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const unsigned = hash >>> 0;
  const hue = unsigned % 360;
  const saturation = 58 + ((unsigned >>> 8) % 18);
  const lightness = 52 + ((unsigned >>> 16) % 9);
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
};

const barHeight = (value: number, maximum: number) => {
  if (value <= 0 || maximum <= 0) return 0;
  return Math.max(1.5, (value / maximum) * 100);
};

export function BudgetHistoryChart({
  months,
  currentMonthKey,
  selectedMonthKey,
  onSelectMonth,
}: {
  months: BudgetHistoryMonth[];
  currentMonthKey: string;
  selectedMonthKey: string | null;
  onSelectMonth: (monthKey: string) => void;
}) {
  const [mode, setMode] = useState<HistoryMode>("overall");
  const [range, setRange] = useState<HistoryRange>(12);
  const [selectedCategories, setSelectedCategories] = useState<string[] | null>(null);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [annualYear, setAnnualYear] = useState(currentMonthKey.slice(0, 4));
  const categoryPickerRef = useRef<HTMLDetailsElement>(null);
  const periodPickerRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closePickers = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      for (const picker of [categoryPickerRef.current, periodPickerRef.current]) {
        if (picker?.open && !picker.contains(event.target)) picker.removeAttribute("open");
      }
    };
    document.addEventListener("pointerdown", closePickers);
    return () => document.removeEventListener("pointerdown", closePickers);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setRange(6);
  }, []);

  const chronologicalMonths = useMemo(() => {
    const sorted = [...months].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    if (!sorted.length) return [];
    const monthsByKey = new Map(sorted.map((month) => [month.monthKey, month]));
    const firstMonthKey = sorted[0].monthKey;
    const finalMonthKey =
      sorted.at(-1)!.monthKey > currentMonthKey ? sorted.at(-1)!.monthKey : currentMonthKey;
    const timeline: BudgetHistoryMonth[] = [];

    for (
      let monthKey = firstMonthKey, index = 0;
      monthKey <= finalMonthKey && index < 240;
      monthKey = nextMonthKey(monthKey), index += 1
    ) {
      timeline.push(
        monthsByKey.get(monthKey) ?? {
          monthKey,
          expense: 0,
          income: 0,
          expenseCategories: [],
          incomeCategories: [],
        },
      );
    }

    return timeline;
  }, [currentMonthKey, months]);
  const categoryColorMap = useMemo(() => {
    const names = Array.from(
      new Set(
        months.flatMap((month) =>
          [...month.expenseCategories, ...month.incomeCategories].map((category) => category.name),
        ),
      ),
    ).sort((a, b) => a.localeCompare(b, "ru"));
    return new Map(
      names.map((name, index) => [
        name,
        DISTINCT_CATEGORY_COLORS[index] ??
          `hsl(${Math.round((index * 137.508) % 360)} ${62 + (index % 3) * 5}% ${50 + (index % 2) * 8}%)`,
      ]),
    );
  }, [months]);

  useEffect(() => {
    if (!chronologicalMonths.length) return;
    setCustomStart((value) => value || chronologicalMonths[0].monthKey);
    setCustomEnd((value) => value || chronologicalMonths.at(-1)!.monthKey);
  }, [chronologicalMonths]);

  const visibleMonths = useMemo(() => {
    if (range === "custom") {
      const first = chronologicalMonths[0]?.monthKey ?? "";
      const last = chronologicalMonths.at(-1)?.monthKey ?? "";
      const start = customStart || first;
      const end = customEnd || last;
      const lower = start <= end ? start : end;
      const upper = start <= end ? end : start;
      return chronologicalMonths.filter(
        (month) => month.monthKey >= lower && month.monthKey <= upper,
      );
    }
    return chronologicalMonths.slice(-range);
  }, [chronologicalMonths, customEnd, customStart, range]);

  const categoryOptions = useMemo(() => {
    if (mode === "overall") return [];
    const totals = new Map<string, number>();
    for (const month of chronologicalMonths) {
      const rows = mode === "expense" ? month.expenseCategories : month.incomeCategories;
      for (const row of rows) totals.set(row.name, (totals.get(row.name) ?? 0) + row.total);
    }
    return Array.from(totals.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "ru"));
  }, [chronologicalMonths, mode]);

  useEffect(() => {
    setSelectedCategories((current) => {
      if (current === null) return current;
      const available = new Set(categoryOptions.map((category) => category.name));
      const valid = current.filter((name) => available.has(name));
      if (valid.length === current.length) return current;
      return valid.length ? valid : null;
    });
  }, [categoryOptions]);

  const { chartData, series } = useMemo<{ chartData: ChartDatum[]; series: ChartSeries[] }>(() => {
    if (mode === "overall") {
      return {
        chartData: visibleMonths.map((month) => ({
          monthKey: month.monthKey,
          monthLabel: formatShortMonth(month.monthKey),
          expense: month.expense,
          income: month.income,
          net: month.income - month.expense,
        })),
        series: [
          { key: "income", label: "Доходы", color: INCOME_COLOR },
          { key: "expense", label: "Расходы", color: EXPENSE_COLOR },
        ],
      };
    }

    const visibleTotals = new Map<string, number>();
    for (const month of visibleMonths) {
      const rows = mode === "expense" ? month.expenseCategories : month.incomeCategories;
      for (const row of rows)
        visibleTotals.set(row.name, (visibleTotals.get(row.name) ?? 0) + row.total);
    }

    const selectedNames =
      selectedCategories === null
        ? Array.from(visibleTotals.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([name]) => name)
        : selectedCategories;
    const nextSeries: ChartSeries[] = selectedNames.map((name, index) => ({
      key: `category_${index}`,
      label: name,
      color: categoryColorMap.get(name) ?? categoryColor(name),
    }));

    const nextData: ChartDatum[] = visibleMonths.map((month) => {
      const rows = mode === "expense" ? month.expenseCategories : month.incomeCategories;
      const values = new Map(rows.map((row) => [row.name, row.total]));
      const row: ChartDatum = {
        monthKey: month.monthKey,
        monthLabel: formatShortMonth(month.monthKey),
        expense: month.expense,
        income: month.income,
        net: month.income - month.expense,
      };
      selectedNames.forEach((name, index) => {
        row[`category_${index}`] = values.get(name) ?? 0;
      });
      return row;
    });

    return { chartData: nextData, series: nextSeries };
  }, [categoryColorMap, mode, selectedCategories, visibleMonths]);

  const maximum = useMemo(() => {
    if (mode === "overall") {
      return Math.max(1, ...chartData.flatMap((month) => [month.income, month.expense])) * 1.12;
    }
    return (
      Math.max(
        1,
        ...chartData.map((month) =>
          series.reduce((sum, item) => sum + Number(month[item.key] ?? 0), 0),
        ),
      ) * 1.12
    );
  }, [chartData, mode, series]);
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((ratio) => ({
    ratio,
    label: formatCompactRub(maximum * ratio),
  }));
  const spansYears =
    chartData.length > 1 &&
    chartData[0].monthKey.slice(0, 4) !== chartData.at(-1)!.monthKey.slice(0, 4);
  const monthWidth = 78;
  const chartMinWidth = Math.max(560, chartData.length * monthWidth);
  const selectedMonthSummary = selectedMonthKey
    ? (months.find((month) => month.monthKey === selectedMonthKey) ?? null)
    : null;
  const availableExpenseYears = useMemo(
    () =>
      Array.from(
        new Set(
          months
            .filter((month) => month.expense > 0 || month.expenseCategories.length > 0)
            .map((month) => month.monthKey.slice(0, 4)),
        ),
      ).sort((a, b) => b.localeCompare(a)),
    [months],
  );

  useEffect(() => {
    if (!availableExpenseYears.length || availableExpenseYears.includes(annualYear)) return;
    setAnnualYear(availableExpenseYears[0]);
  }, [annualYear, availableExpenseYears]);

  const annualMonths = useMemo(
    () => chronologicalMonths.filter((month) => month.monthKey.startsWith(`${annualYear}-`)),
    [annualYear, chronologicalMonths],
  );
  const annualExpenseSummary = useMemo(() => {
    const totals = new Map<string, number>();
    for (const month of annualMonths) {
      for (const category of month.expenseCategories) {
        totals.set(category.name, (totals.get(category.name) ?? 0) + category.total);
      }
    }
    return Array.from(totals.entries())
      .map(([name, total]) => ({
        name,
        total,
        color: categoryColorMap.get(name) ?? categoryColor(name),
      }))
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "ru"));
  }, [annualMonths, categoryColorMap]);
  const annualExpenseTotal = annualExpenseSummary.reduce((sum, item) => sum + item.total, 0);
  const annualDonutBackground = useMemo(() => {
    if (!annualExpenseTotal) return "var(--muted)";
    let offset = 0;
    const segments = annualExpenseSummary.map((item) => {
      const start = offset;
      offset += (item.total / annualExpenseTotal) * 100;
      return `${item.color} ${start}% ${offset}%`;
    });
    return `conic-gradient(from -90deg, ${segments.join(", ")})`;
  }, [annualExpenseSummary, annualExpenseTotal]);
  const annualActiveMonthCount = annualMonths.filter((month) => month.expense > 0).length;

  const changeMode = (nextMode: HistoryMode) => {
    setMode(nextMode);
    setSelectedCategories(null);
  };

  const toggleCategory = (name: string) => {
    setSelectedCategories((current) => {
      if (current === null) return [name];
      if (!current.includes(name)) return [...current, name];
      const next = current.filter((item) => item !== name);
      return next.length ? next : null;
    });
  };

  const setManualBoundary = (boundary: "start" | "end", value: string) => {
    if (boundary === "start") {
      setCustomStart(value);
      if (customEnd && value > customEnd) setCustomEnd(value);
    } else {
      setCustomEnd(value);
      if (customStart && value < customStart) setCustomStart(value);
    }
    setRange("custom");
  };

  const showAnnualCategoryHistory = (name: string) => {
    setMode("expense");
    setSelectedCategories([name]);
    setRange("custom");
    setCustomStart(annualMonths[0]?.monthKey ?? `${annualYear}-01`);
    setCustomEnd(annualMonths.at(-1)?.monthKey ?? `${annualYear}-12`);
  };

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex w-fit max-w-full flex-wrap rounded-lg border border-border bg-background/40 p-1">
          {(
            [
              ["overall", "Общее"],
              ["expense", "Расходы по статьям"],
              ["income", "Доходы по статьям"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => changeMode(value)}
              className={`rounded-md px-3 py-2 text-xs transition-colors ${
                mode === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            {mode !== "overall" ? (
              <details ref={categoryPickerRef} className="relative min-w-48 flex-1 lg:flex-none">
                <summary className="cursor-pointer list-none rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground outline-none [&::-webkit-details-marker]:hidden">
                  {selectedCategories === null
                    ? "Статьи: все"
                    : `Статьи: выбрано ${selectedCategories.length}`}
                </summary>
                <div className="absolute right-0 top-full z-30 mt-2 w-[min(88vw,360px)] rounded-lg border border-border bg-card p-3 shadow-xl">
                  <button
                    type="button"
                    onClick={() => setSelectedCategories(null)}
                    className={`mb-2 w-full rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                      selectedCategories === null
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Все статьи
                  </button>
                  <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                    {categoryOptions.map((category) => {
                      const active = selectedCategories?.includes(category.name) ?? false;
                      return (
                        <button
                          key={category.name}
                          type="button"
                          onClick={() => toggleCategory(category.name)}
                          className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors ${
                            active
                              ? "bg-[color:var(--surface-elevated)] text-foreground"
                              : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                          }`}
                        >
                          <span
                            className="h-3 w-3 shrink-0 rounded-sm"
                            style={{
                              backgroundColor:
                                categoryColorMap.get(category.name) ?? categoryColor(category.name),
                            }}
                          />
                          <span className="min-w-0 flex-1 truncate">{category.name}</span>
                          <span
                            className={`h-4 w-4 shrink-0 rounded border text-center text-[10px] leading-[14px] ${
                              active ? "border-primary text-primary" : "border-border"
                            }`}
                          >
                            {active ? "✓" : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 border-t border-border pt-2 text-[10px] text-muted-foreground">
                    Нажмите на несколько статей, чтобы сравнить их по месяцам.
                  </div>
                </div>
              </details>
            ) : null}
            <div className="inline-flex flex-wrap rounded-md border border-border p-1">
              {(
                [
                  [1, "Месяц"],
                  [3, "3 мес."],
                  [6, "6 мес."],
                  [12, "Год"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={String(value)}
                  type="button"
                  onClick={() => setRange(value)}
                  className={`rounded px-2.5 py-1.5 text-[11px] transition-colors ${
                    range === value
                      ? "bg-[color:var(--surface-elevated)] text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <details ref={periodPickerRef} className="relative">
              <summary
                className={`cursor-pointer list-none rounded-md border px-2.5 py-2 text-[11px] outline-none [&::-webkit-details-marker]:hidden ${
                  range === "custom"
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                {range === "custom" && customStart && customEnd
                  ? `${formatShortMonth(customStart, true)} — ${formatShortMonth(customEnd, true)}`
                  : "Период"}
              </summary>
              <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-lg border border-border bg-card p-3 shadow-xl">
                <div className="mb-3 text-xs font-medium text-foreground">Выберите месяцы</div>
                <label className="mb-2 grid grid-cols-[26px_1fr] items-center gap-2 text-[11px] text-muted-foreground">
                  <span>С</span>
                  <select
                    value={customStart}
                    onChange={(event) => setManualBoundary("start", event.target.value)}
                    className="min-w-0 appearance-none rounded-md border border-input bg-background px-2.5 py-2 text-xs capitalize text-foreground outline-none"
                  >
                    {chronologicalMonths.map((month) => (
                      <option key={month.monthKey} value={month.monthKey}>
                        {formatMonthKey(month.monthKey)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid grid-cols-[26px_1fr] items-center gap-2 text-[11px] text-muted-foreground">
                  <span>По</span>
                  <select
                    value={customEnd}
                    onChange={(event) => setManualBoundary("end", event.target.value)}
                    className="min-w-0 appearance-none rounded-md border border-input bg-background px-2.5 py-2 text-xs capitalize text-foreground outline-none"
                  >
                    {chronologicalMonths.map((month) => (
                      <option key={month.monthKey} value={month.monthKey}>
                        {formatMonthKey(month.monthKey)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => periodPickerRef.current?.removeAttribute("open")}
                  className="mt-3 w-full rounded-md bg-[color:var(--surface-elevated)] px-3 py-2 text-xs text-foreground"
                >
                  Готово
                </button>
              </div>
            </details>
          </div>
        </div>
      </div>

      {chartData.length && (mode === "overall" || series.length) ? (
        <>
          <div className="overflow-x-auto pb-2">
            <div
              className="grid grid-cols-[58px_minmax(0,1fr)]"
              style={{ minWidth: `${chartMinWidth + 58}px` }}
            >
              <div className="relative h-[320px]">
                {yTicks.map((tick) => (
                  <span
                    key={tick.ratio}
                    className={`absolute right-2 text-[10px] tabular text-muted-foreground ${
                      tick.ratio === 1 ? "translate-y-0" : "-translate-y-1/2"
                    }`}
                    style={{ top: `${(1 - tick.ratio) * 88}%` }}
                  >
                    {tick.label}
                  </span>
                ))}
              </div>
              <div className="relative h-[320px]">
                <div className="absolute inset-x-0 top-0 h-[88%] border-b border-border">
                  {yTicks.map((tick) => (
                    <span
                      key={tick.ratio}
                      className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border/70"
                      style={{ top: `${(1 - tick.ratio) * 100}%` }}
                    />
                  ))}
                  <div
                    className="absolute inset-0 grid"
                    style={{
                      gridTemplateColumns: `repeat(${chartData.length}, minmax(0, 1fr))`,
                    }}
                  >
                    {chartData.map((month) => {
                      const selected = selectedMonthKey === month.monthKey;
                      const selectedCategoryTotal = series.reduce(
                        (sum, item) => sum + Number(month[item.key] ?? 0),
                        0,
                      );
                      return (
                        <button
                          key={month.monthKey}
                          type="button"
                          onClick={() => onSelectMonth(month.monthKey)}
                          className={`group relative flex min-w-0 items-end justify-center border-x border-transparent px-2 pt-6 transition-colors hover:bg-muted/20 ${
                            selected ? "bg-muted/25 ring-1 ring-inset ring-primary/50" : ""
                          } ${month.monthKey === currentMonthKey ? "border-r-[color:var(--gold)]/50" : ""}`}
                          title={formatMonthKey(month.monthKey)}
                        >
                          {mode === "overall" ? (
                            <div className="flex h-full w-full items-end justify-center gap-1.5 sm:gap-2">
                              {[
                                { label: "Доходы", value: month.income, color: INCOME_COLOR },
                                {
                                  label: "Расходы",
                                  value: month.expense,
                                  color: EXPENSE_COLOR,
                                },
                              ].map((bar) => (
                                <span
                                  key={bar.label}
                                  className="relative block w-[34%] max-w-11 rounded-t transition-[filter] group-hover:brightness-110"
                                  style={{
                                    height: `${barHeight(bar.value, maximum)}%`,
                                    backgroundColor: bar.color,
                                  }}
                                  title={`${bar.label}: ${formatRub(bar.value)}`}
                                >
                                  {bar.value > 0 ? (
                                    <span className="absolute -top-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap text-[9px] tabular text-muted-foreground xl:block">
                                      {formatCompactRub(bar.value)}
                                    </span>
                                  ) : null}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="flex h-full w-full items-end justify-center transition-[filter] group-hover:brightness-110">
                              <div
                                className="relative flex w-[58%] max-w-16 flex-col-reverse overflow-visible rounded-t"
                                style={{
                                  height: `${barHeight(selectedCategoryTotal, maximum)}%`,
                                }}
                              >
                                {selectedCategoryTotal > 0 ? (
                                  <span className="absolute -top-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap text-[9px] tabular text-muted-foreground xl:block">
                                    {formatCompactRub(selectedCategoryTotal)}
                                  </span>
                                ) : null}
                                <span className="absolute inset-0 flex flex-col-reverse overflow-hidden rounded-t">
                                  {series.map((item) => {
                                    const value = Number(month[item.key] ?? 0);
                                    if (value <= 0 || selectedCategoryTotal <= 0) return null;
                                    return (
                                      <span
                                        key={item.key}
                                        className="block w-full shrink-0"
                                        style={{
                                          height: `${(value / selectedCategoryTotal) * 100}%`,
                                          backgroundColor: item.color,
                                        }}
                                        title={`${item.label}: ${formatRub(value)}`}
                                      />
                                    );
                                  })}
                                </span>
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div
                  className="absolute inset-x-0 bottom-0 grid h-[12%] items-end"
                  style={{ gridTemplateColumns: `repeat(${chartData.length}, minmax(0, 1fr))` }}
                >
                  {chartData.map((month) => (
                    <span
                      key={month.monthKey}
                      className={`truncate px-1 text-center text-[10px] capitalize sm:text-[11px] ${
                        selectedMonthKey === month.monthKey
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }`}
                      title={formatMonthKey(month.monthKey)}
                    >
                      {formatShortMonth(month.monthKey, spansYears)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            {series.map((item) => (
              <span key={item.key} className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                {item.label}
              </span>
            ))}
          </div>
          <div className="mt-3 text-center text-[11px] text-muted-foreground">
            Нажмите на месяц, чтобы увидеть расшифровку
            {selectedMonthKey ? ` · выбран ${formatMonthKey(selectedMonthKey)}` : "."}
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          Для выбранного периода пока нет операций.
        </div>
      )}

      {selectedMonthSummary ? (
        <div className="mt-5 border-t border-border pt-5">
          <div className="mb-4 text-sm font-medium capitalize text-foreground">
            {formatMonthKey(selectedMonthSummary.monthKey)} · расшифровка
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="mb-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Расходы по статьям
              </div>
              <div className="grid gap-2">
                {selectedMonthSummary.expenseCategories.length ? (
                  selectedMonthSummary.expenseCategories.map((category) => (
                    <div
                      key={category.name}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="inline-flex min-w-0 items-center gap-2 text-muted-foreground">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{
                            backgroundColor:
                              categoryColorMap.get(category.name) ?? categoryColor(category.name),
                          }}
                        />
                        <span className="truncate">{category.name}</span>
                      </span>
                      <span className="shrink-0 tabular text-foreground">
                        {formatRub(category.total)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">Нет расходов</div>
                )}
              </div>
            </div>
            <div>
              <div className="mb-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Доходы по статьям
              </div>
              <div className="grid gap-2">
                {selectedMonthSummary.incomeCategories.length ? (
                  selectedMonthSummary.incomeCategories.map((category) => (
                    <div
                      key={category.name}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-muted-foreground">{category.name}</span>
                      <span className="tabular text-[#42b979]">{formatRub(category.total)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">Нет доходов</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {annualExpenseSummary.length ? (
        <div className="mt-8 border-t border-border pt-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Структура года
              </div>
              <div className="mt-1 text-base font-medium text-foreground">
                Расходы по статьям за {annualYear} год
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {annualActiveMonthCount} из 12 месяцев с расходами
              </div>
            </div>
            {availableExpenseYears.length > 1 ? (
              <select
                value={annualYear}
                onChange={(event) => setAnnualYear(event.target.value)}
                className="appearance-none rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground outline-none"
                aria-label="Выбрать год для структуры расходов"
              >
                {availableExpenseYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <div className="grid items-center gap-7 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="flex justify-center">
              <div
                className="relative h-56 w-56 rounded-full shadow-[inset_0_0_0_1px_var(--border)]"
                style={{ background: annualDonutBackground }}
                role="img"
                aria-label={`Расходы за ${annualYear} год: ${formatRub(annualExpenseTotal)}`}
              >
                <div className="absolute inset-[23%] flex flex-col items-center justify-center rounded-full border border-border bg-card px-3 text-center shadow-sm">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    За год
                  </span>
                  <span className="mt-1 text-lg font-medium tabular text-foreground">
                    {formatCompactRub(annualExpenseTotal)}
                  </span>
                  <span className="mt-1 text-[10px] text-muted-foreground">{annualYear}</span>
                </div>
              </div>
            </div>

            <div>
              <div className="grid gap-2 sm:grid-cols-2">
                {annualExpenseSummary.map((item) => {
                  const percentage = (item.total / annualExpenseTotal) * 100;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => showAnnualCategoryHistory(item.name)}
                      className="grid grid-cols-[auto_minmax(0,1fr)_42px_auto] items-center gap-2 rounded-md border border-border/70 bg-background/20 px-2.5 py-1.5 text-left transition-colors hover:bg-muted/40"
                      title={`Показать ${item.name} по месяцам`}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="min-w-0 truncate text-[11px] text-foreground">
                        {item.name}
                      </span>
                      <span className="text-right text-[10px] tabular text-muted-foreground">
                        {percentage.toFixed(1).replace(".0", "")}%
                      </span>
                      <span className="text-[11px] tabular text-foreground">
                        {formatCompactRub(item.total)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 text-[11px] text-muted-foreground">
                Нажмите на статью, чтобы посмотреть её динамику по месяцам.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
