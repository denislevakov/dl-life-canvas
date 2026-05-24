import { createFileRoute } from "@tanstack/react-router";
import { useCapital } from "@/lib/capital-store";
import { PageContainer, PageHeader, MetricCard } from "@/components/MetricCard";
import { ProgressBar } from "@/components/ProgressBar";
import { formatMillions, formatRub } from "@/lib/format";

export const Route = createFileRoute("/freedom")({
  head: () => ({ meta: [{ title: "Свобода · Life Capital" }, { name: "description", content: "Шкала финансовой свободы: выживание → наследие." }] }),
  component: FreedomPage,
});

const stages = [
  { key: "survival", label: "Выживание", desc: "Покрытие базовых расходов" },
  { key: "stability", label: "Стабильность", desc: "Доход выше минимума, есть подушка" },
  { key: "freedom", label: "Свобода", desc: "Доход в комфортном диапазоне" },
  { key: "capital", label: "Капитал", desc: "Активы дают пассивный поток" },
  { key: "legacy", label: "Наследие", desc: "Выход из операционной деятельности" },
] as const;

function FreedomPage() {
  const { state, totals } = useCapital();
  const { monthlyMinimum, estimatedCapital, activeIncome, passiveIncome } = totals;

  const currentIncome = activeIncome + passiveIncome;
  const coverage = monthlyMinimum ? currentIncome / monthlyMinimum : 0;
  const passiveCoverage = monthlyMinimum ? passiveIncome / monthlyMinimum : 0;
  const offOperational = currentIncome ? (passiveIncome / currentIncome) * 100 : 0;
  const freedomTarget = state.freedomTarget.min;
  const freedomProgress = freedomTarget ? Math.min(100, (currentIncome / freedomTarget) * 100) : 0;

  // Determine current scale position
  let currentIndex = 0;
  if (coverage >= 1) currentIndex = 1;
  if (currentIncome >= state.freedomTarget.min) currentIndex = 2;
  if (passiveCoverage >= 1) currentIndex = 3;
  if (passiveCoverage >= 2 && offOperational > 70) currentIndex = 4;

  return (
    <PageContainer>
      <PageHeader eyebrow="Свобода" title="Близость к свободе" description="Шкала от выживания к наследию. Считается из ваших активов, доходов и расходов." />

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Покрытие минимума" value={`${coverage.toFixed(1)}×`} sublabel={`${formatRub(currentIncome)} / ${formatRub(monthlyMinimum)}`} accent="gold" />
        <MetricCard label="Запас прочности" value={`${(currentIncome - monthlyMinimum > 0 ? (currentIncome - monthlyMinimum) / monthlyMinimum : 0).toFixed(1)}×`} sublabel="сверх минимума" accent="green" />
        <MetricCard label="Общий капитал" value={formatMillions(estimatedCapital)} sublabel="средняя оценка" />
        <MetricCard label="Пассивный доход" value={formatRub(passiveIncome)} sublabel={`${offOperational.toFixed(0)}% вне операционки`} accent="gold" />
      </div>

      {/* Freedom scale */}
      <div className="rounded-xl border border-border bg-card p-6 md:p-8 mb-6">
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-5">Шкала свободы</div>
        <div className="relative">
          <div className="absolute top-3 left-0 right-0 h-px bg-border" />
          <div className="grid grid-cols-5 gap-2 relative">
            {stages.map((s, i) => {
              const active = i <= currentIndex;
              const current = i === currentIndex;
              return (
                <div key={s.key} className="text-center">
                  <div
                    className={
                      "mx-auto h-6 w-6 rounded-full border-2 flex items-center justify-center relative z-10 transition-colors " +
                      (current
                        ? "border-[color:var(--gold)] bg-[color:var(--gold)]"
                        : active
                          ? "border-[color:var(--gold)]/60 bg-[color:var(--gold)]/30"
                          : "border-border bg-background")
                    }
                  >
                    {current && <div className="h-2 w-2 rounded-full bg-background" />}
                  </div>
                  <div className={"mt-3 text-xs font-medium " + (current ? "text-[color:var(--gold)]" : active ? "text-foreground" : "text-muted-foreground")}>
                    {s.label}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground leading-snug hidden md:block">{s.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Прогресс к свободе</div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="font-display text-3xl tabular text-[color:var(--gold)]">{Math.round(freedomProgress)}%</div>
            <div className="text-xs text-muted-foreground tabular">{formatRub(currentIncome)} / {formatRub(freedomTarget)}</div>
          </div>
          <div className="mt-3"><ProgressBar value={freedomProgress} accent="gold" /></div>
          <div className="mt-4 text-sm text-muted-foreground">
            Целевой минимум для ощущения свободы — {formatRub(state.freedomTarget.min)} в месяц. Комфортный потолок — {formatRub(state.freedomTarget.max)}.
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Доля дохода вне операционки</div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="font-display text-3xl tabular text-[color:oklch(0.75_0.1_160)]">{offOperational.toFixed(0)}%</div>
            <div className="text-xs text-muted-foreground tabular">{formatRub(passiveIncome)} / {formatRub(currentIncome || 1)}</div>
          </div>
          <div className="mt-3"><ProgressBar value={offOperational} accent="green" /></div>
          <div className="mt-4 text-sm text-muted-foreground">
            Цель этапа 50+ — большая часть дохода поступает без операционной нагрузки: инвестиции, доли, аренда.
          </div>
        </div>
      </div>
    </PageContainer>
  );
}