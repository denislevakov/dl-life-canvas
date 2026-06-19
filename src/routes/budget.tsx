import { createFileRoute } from "@tanstack/react-router";
import { useCapital } from "@/lib/capital-store";
import { PageContainer, PageHeader, MetricCard } from "@/components/MetricCard";
import { EditableNumber } from "@/components/EditableNumber";
import { formatMillions, formatRub } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/budget")({
  head: () => ({ meta: [{ title: "Доход и расходы · Life Capital" }, { name: "description", content: "Расходы, прожиточный минимум и доходные сценарии." }] }),
  component: BudgetPage,
});

function BudgetPage() {
  const { state, totals, updateExpense, addExpense, removeExpense } = useCapital();
  const { monthlyMinimum, minIncome } = totals;

  const scenarios = state.incomeScenarios.map((income) => {
    const surplus = income - monthlyMinimum;
    return {
      income,
      surplus,
      yearly: surplus * 12,
      coverage: monthlyMinimum ? income / monthlyMinimum : 0,
      savingsRate: income ? (surplus / income) * 100 : 0,
    };
  });

  return (
    <PageContainer>
      <PageHeader eyebrow="Поток" title="Доход и расходы" description="Прожиточный минимум, диапазон свободы и автоматический расчёт остатка при разных сценариях дохода." />

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <MetricCard label="Прожиточный минимум" value={formatRub(monthlyMinimum)} sublabel="в месяц" accent="gold" />
        <MetricCard label="Минимальный доход" value={formatRub(minIncome)} sublabel="минимум для жизни" />
        <MetricCard label="Диапазон свободы" value={`${(state.freedomTarget.min / 1000).toFixed(0)}k – ${(state.freedomTarget.max / 1_000_000).toFixed(0)}M`} sublabel="комфортный коридор" accent="green" />
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Структура</div>
              <div className="font-display text-xl mt-1">Расходы в месяц</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Итого</div>
              <div className="font-display text-xl text-[color:var(--gold)] tabular">{formatRub(monthlyMinimum)}</div>
            </div>
          </div>
          <div className="divide-y divide-border">
            {state.expenses.map((e) => {
              const share = (e.amount / (monthlyMinimum || 1)) * 100;
              return (
                <div key={e.id} className="py-3 flex items-center gap-3">
                  <input
                    value={e.name}
                    onChange={(ev) => updateExpense(e.id, { name: ev.target.value })}
                    className="flex-1 bg-transparent text-sm focus:outline-none focus:text-[color:var(--gold)]"
                  />
                  <div className="w-24 text-right text-[11px] text-muted-foreground tabular">{share.toFixed(1)}%</div>
                  <div className="w-36 text-right">
                    <EditableNumber value={e.amount} onChange={(n) => updateExpense(e.id, { amount: n })} className="text-sm" />
                  </div>
                  <button onClick={() => removeExpense(e.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => addExpense({ id: "e" + Date.now(), name: "Новая статья", amount: 0 })}
            className="mt-4 w-full rounded-md border border-dashed border-border py-2.5 text-xs text-muted-foreground hover:text-[color:var(--gold)] inline-flex items-center justify-center gap-2"
          >
            <Plus className="h-3.5 w-3.5" /> Добавить статью
          </button>
        </div>

        <div className="lg:col-span-2 space-y-3">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Сценарии дохода</div>
          {scenarios.map((s) => (
            <div key={s.income} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="font-display text-lg tabular">{formatRub(s.income)}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.coverage.toFixed(1)}× покрытие</div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Остаток</div>
                  <div className="text-sm tabular text-[color:var(--gold)] mt-0.5">{formatRub(s.surplus)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider">В год</div>
                  <div className="text-sm tabular mt-0.5">{formatMillions(s.yearly)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Норма</div>
                  <div className="text-sm tabular mt-0.5">{s.savingsRate.toFixed(0)}%</div>
                </div>
              </div>
              <div className="mt-3 h-1 w-full bg-[color:var(--surface-elevated)] rounded-full overflow-hidden">
                <div className="h-full" style={{ width: `${Math.min(100, s.savingsRate)}%`, background: "var(--gradient-gold)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}