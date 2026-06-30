import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useCapital } from "@/lib/capital-store";
import { MetricCard, PageContainer, PageHeader } from "@/components/MetricCard";
import { ProgressBar } from "@/components/ProgressBar";
import { formatMillions, formatRange, formatRub } from "@/lib/format";
import { ArrowUpRight, Compass } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Обзор · LIFE IS GOOD" },
      { name: "description", content: "Главный обзор личного капитала, дохода и стратегии." },
    ],
  }),
  component: Index,
});

function Index() {
  const { state, totals } = useCapital();
  const { minCapital, maxCapital, estimatedCapital, monthlyMinimum, minIncome } = totals;
  const nextTarget = state.targets.find((t) => t.status !== "purchased");
  const currentStage = state.stages.find((s) => s.id === state.currentStageId) ?? state.stages[0];

  const scenarios = state.incomeScenarios.map((income) => ({
    income,
    surplus: income - monthlyMinimum,
    yearly: (income - monthlyMinimum) * 12,
    coverage: monthlyMinimum ? income / monthlyMinimum : 0,
  }));

  const freedomProgress = Math.min(100, (estimatedCapital / 100_000_000) * 100);

  return (
    <PageContainer>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--gold)]">Life Capital · Обзор</div>
          <h1 className="font-display text-4xl md:text-5xl mt-3 text-foreground">Где я сейчас</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl">
            Снимок капитала, прожиточного минимума и пространства для свободы. Всё пересчитывается автоматически.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-5 py-4">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Текущий этап</div>
          <div className="mt-1 font-display text-lg text-foreground">{currentStage.period} · {currentStage.title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{currentStage.focus}</div>
        </div>
      </div>

      {/* Hero capital */}
      <div className="rounded-xl border border-border bg-card p-6 md:p-8 mb-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{ background: "var(--gradient-gold)" }} />
        <div className="relative grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Общий капитал</div>
            <div className="mt-3 font-display text-5xl md:text-6xl text-foreground tabular">
              {formatRange(minCapital, maxCapital)}
            </div>
            <div className="mt-2 text-sm text-muted-foreground tabular">
              Средняя оценка: <span className="text-[color:var(--gold)]">{formatMillions(estimatedCapital)}</span>
            </div>
            <div className="mt-6 max-w-md">
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>Прогресс к цели свободы</span>
                <span className="tabular">{Math.round(freedomProgress)}%</span>
              </div>
              <ProgressBar value={freedomProgress} accent="gold" />
              <div className="mt-1.5 text-[11px] text-muted-foreground tabular">Цель капитала: 100 млн ₽</div>
            </div>
          </div>
          <div className="border-l border-border pl-6 hidden md:block">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Прожиточный минимум</div>
            <div className="mt-2 font-display text-3xl tabular">{formatRub(monthlyMinimum)}</div>
            <div className="text-xs text-muted-foreground mt-1">в месяц</div>
            <div className="mt-6 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Минимальный доход</div>
            <div className="mt-2 font-display text-3xl tabular text-foreground">{formatRub(minIncome)}</div>
          </div>
        </div>
      </div>

      {/* Freedom range */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <MetricCard
          label="Комфортный доход в месяц"
          value="1-2М ₽"
          sublabel="целевой коридор"
          accent="gold"
        />
        <MetricCard
          label="Запас прочности"
          value={`${(minIncome / monthlyMinimum).toFixed(1)}×`}
          sublabel={`при доходе ${formatRub(minIncome)}`}
          accent="green"
        />
        <MetricCard
          label="Активы идентичности"
          value={`${state.assets.filter((a) => a.identity).length} коллекции`}
        />
      </div>

      {/* Income scenarios */}
      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Сценарии дохода</div>
            <div className="font-display text-xl mt-1">Свободный остаток после расходов</div>
          </div>
          <Link to="/budget" className="text-xs text-[color:var(--gold)] inline-flex items-center gap-1 hover:underline">
            Детали <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {scenarios.map((s) => (
            <div key={s.income} className="rounded-lg border border-border bg-[color:var(--surface-elevated)] p-4">
              <div className="text-xs text-muted-foreground tabular">{formatRub(s.income)} / мес</div>
              <div className="mt-2 font-display text-2xl tabular text-[color:var(--gold)]">
                +{formatRub(s.surplus)}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground tabular">
                {formatMillions(s.yearly)} в год · покрытие {s.coverage.toFixed(1)}×
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Next steps */}
      <div className="grid md:grid-cols-2 gap-4">
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
            <div className="mt-2"><ProgressBar value={nextTarget.saved} max={nextTarget.estimatedCost || 1} accent="green" /></div>
            <Link to="/targets" className="inline-flex mt-5 text-xs text-[color:var(--gold)] items-center gap-1 hover:underline">
              Все целевые активы <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--gold)]">Главные цели периода {currentStage.period}</div>
          <div className="mt-3 font-display text-xl">{currentStage.focus}</div>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {currentStage.goals.slice(0, 4).map((g, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="text-[color:var(--gold)] mt-1">·</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
          <Link to="/life-map" className="inline-flex mt-5 text-xs text-[color:var(--gold)] items-center gap-1 hover:underline">
            Карта жизни <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}
