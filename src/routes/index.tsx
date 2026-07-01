import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Compass, FolderKanban, ListChecks } from "lucide-react";

import { MetricCard, PageContainer } from "@/components/MetricCard";
import { ProgressBar } from "@/components/ProgressBar";
import { useCapital } from "@/lib/capital-store";
import { formatMillions, formatRange, formatRub } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Обзор · LIFE IS GOOD" },
      { name: "description", content: "Главный обзор личного капитала, дохода и стратегии." },
    ],
  }),
  component: Index,
});

const formatGoalDeadline = (value: string) => {
  if (!value) return "без срока";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(date);
};

const firstOpenAction = (actions: { deadline: string; status: string; title: string }[] = []) =>
  actions
    .filter((action) => action.status === "active")
    .slice()
    .sort((a, b) => (a.deadline || "9999-12-31").localeCompare(b.deadline || "9999-12-31"))[0];

function Index() {
  const { state, totals } = useCapital();
  const {
    minCapital,
    maxCapital,
    estimatedCapital,
    monthlyMinimum,
    minIncome,
    currentBalance,
    cardCashBalance,
    safetyBalance,
    monthExpenseTotal,
  } = totals;

  const currentStage = state.stages.find((s) => s.id === state.currentStageId) ?? state.stages[0];
  const nextTarget = state.targets.find((t) => t.status !== "purchased");
  const freedomProgress = Math.min(100, (estimatedCapital / 100_000_000) * 100);

  const projects = (state.lifeAreas ?? [])
    .filter((area) => area.status === "active" && area.kind === "project")
    .slice(0, 3);

  const upcomingGoals = (state.lifeGoals ?? [])
    .filter((goal) => goal.status === "active")
    .slice()
    .sort((a, b) => (a.deadline || "9999-12-31").localeCompare(b.deadline || "9999-12-31"))
    .slice(0, 3);

  return (
    <PageContainer>
      <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--gold)]">Life Capital · Обзор</div>
          <h1 className="mt-3 font-display text-4xl text-foreground md:text-5xl">Где я сейчас</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Короткий снимок денег, капитала, проектов и ближайших целей.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-5 py-4">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Текущий этап</div>
          <div className="mt-1 font-display text-lg text-foreground">
            {currentStage.period} · {currentStage.title}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{currentStage.focus}</div>
        </div>
      </div>

      <div className="relative mb-6 overflow-hidden rounded-xl border border-border bg-card p-6 md:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ background: "var(--gradient-gold)" }} />
        <div className="relative grid gap-8 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Общий капитал</div>
            <div className="mt-3 font-display text-5xl text-foreground tabular md:text-6xl">
              {formatRange(minCapital, maxCapital)}
            </div>
            <div className="mt-2 text-sm text-muted-foreground tabular">
              Средняя оценка: <span className="text-[color:var(--gold)]">{formatMillions(estimatedCapital)}</span>
            </div>
            <div className="mt-6 max-w-md">
              <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                <span>Прогресс к цели свободы</span>
                <span className="tabular">{Math.round(freedomProgress)}%</span>
              </div>
              <ProgressBar value={freedomProgress} accent="gold" />
              <div className="mt-1.5 text-[11px] text-muted-foreground tabular">Цель капитала: 100 млн ₽</div>
            </div>
          </div>
          <div className="hidden border-l border-border pl-6 md:block">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Прожиточный минимум</div>
            <div className="mt-2 font-display text-3xl tabular">{formatRub(monthlyMinimum)}</div>
            <div className="mt-1 text-xs text-muted-foreground">в месяц</div>
            <div className="mt-6 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Минимальный доход</div>
            <div className="mt-2 font-display text-3xl text-foreground tabular">{formatRub(minIncome)}</div>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Финансовый снимок</div>
            <div className="mt-1 font-display text-xl">Деньги сейчас</div>
          </div>
          <Link to="/budget" className="inline-flex items-center gap-1 text-xs text-[color:var(--gold)] hover:underline">
            Доходы / Расходы <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard label="Текущий баланс" value={formatRub(currentBalance)} sublabel="по счетам" accent="gold" />
          <MetricCard label="Карта / наличные" value={formatRub(cardCashBalance)} sublabel="доступно" />
          <MetricCard label="Подушка" value={formatRub(safetyBalance)} sublabel="резерв" accent="green" />
          <MetricCard label="Расходы за месяц" value={formatRub(monthExpenseTotal)} sublabel="по операциям" />
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-card p-6">
        <div className="mb-5">
          <div className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--gold)]">Главные фокусы</div>
          <div className="mt-1 font-display text-xl">Проекты и ближайшие цели</div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-border bg-[color:var(--surface-elevated)] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                <FolderKanban className="h-3.5 w-3.5 text-[color:var(--gold)]" />
                Проекты в работе
              </div>
              <Link to="/projects" className="inline-flex items-center gap-1 text-xs text-[color:var(--gold)] hover:underline">
                Все <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              {projects.map((project) => {
                const action = firstOpenAction(project.actions);
                return (
                  <div key={project.id} className="rounded-md border border-border bg-background/55 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-display text-base leading-snug text-foreground">{project.title}</div>
                      <div className="shrink-0 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground">
                        {project.horizon}
                      </div>
                    </div>
                    {action ? (
                      <div className="mt-2 text-sm text-muted-foreground">
                        <span className="text-foreground">{action.title}</span>
                        <span className="ml-2 text-[11px] tabular">{formatGoalDeadline(action.deadline)}</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-[color:var(--surface-elevated)] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                <ListChecks className="h-3.5 w-3.5 text-[color:var(--gold)]" />
                Ближайшие цели
              </div>
              <Link to="/goals" className="inline-flex items-center gap-1 text-xs text-[color:var(--gold)] hover:underline">
                Все <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {upcomingGoals.length ? (
              <div className="space-y-3">
                {upcomingGoals.map((goal) => (
                  <div key={goal.id} className="rounded-md border border-border bg-background/55 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-display text-base leading-snug text-foreground">{goal.title}</div>
                      <div className="shrink-0 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground tabular">
                        {formatGoalDeadline(goal.deadline)}
                      </div>
                    </div>
                    {goal.note ? <div className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{goal.note}</div> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                Активных целей пока нет.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {nextTarget && (
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[color:var(--gold)]">
              <Compass className="h-3.5 w-3.5" /> Следующий крупный актив
            </div>
            <div className="mt-3 font-display text-xl">{nextTarget.name}</div>
            <div className="mt-1 text-sm text-muted-foreground">{nextTarget.meaning}</div>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>Горизонт {nextTarget.horizon}</span>
              <span className="tabular">{formatMillions(nextTarget.estimatedCost)}</span>
            </div>
            <div className="mt-2">
              <ProgressBar value={nextTarget.saved} max={nextTarget.estimatedCost || 1} accent="green" />
            </div>
            <Link to="/targets" className="mt-5 inline-flex items-center gap-1 text-xs text-[color:var(--gold)] hover:underline">
              Все целевые активы <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--gold)]">
            Главные цели периода {currentStage.period}
          </div>
          <div className="mt-3 font-display text-xl">{currentStage.focus}</div>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {currentStage.goals.slice(0, 4).map((g, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-1 text-[color:var(--gold)]">·</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
          <Link to="/life-map" className="mt-5 inline-flex items-center gap-1 text-xs text-[color:var(--gold)] hover:underline">
            Карта жизни <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}
