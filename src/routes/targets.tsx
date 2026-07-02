import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";

import { EditableNumber } from "@/components/EditableNumber";
import { PageContainer, PageHeader } from "@/components/MetricCard";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge } from "@/components/StatusBadge";
import { useCapital, type TargetAsset } from "@/lib/capital-store";
import { formatMillions } from "@/lib/format";

export const Route = createFileRoute("/targets")({
  head: () => ({ meta: [{ title: "Целевые активы · LIFE IS GOOD" }, { name: "description", content: "Карта будущих активов." }] }),
  component: TargetsPage,
});

const statusOptions = [
  { value: "idea", label: "Идея" },
  { value: "planned", label: "Планируется" },
  { value: "in_progress", label: "В работе" },
  { value: "purchased", label: "Куплено" },
] as const;

const textInputClass = "w-full bg-transparent outline-none transition-colors placeholder:text-muted-foreground focus:text-[color:var(--gold)]";
const textAreaClass = `${textInputClass} resize-none leading-relaxed`;

function TargetsPage() {
  const { state, updateTarget, addTarget, removeTarget } = useCapital();

  const addNewTarget = () => {
    const target: TargetAsset = {
      id: `t_${Date.now()}`,
      name: "Новый целевой актив",
      meaning: "Коротко опиши, зачем тебе этот актив и какую роль он играет в жизни.",
      horizon: "2026",
      status: "idea",
      estimatedCost: 0,
      saved: 0,
      nextStep: "Определить стоимость и первый шаг",
    };
    addTarget(target);
  };

  return (
    <PageContainer>
      <PageHeader eyebrow="Стратегия" title="Целевые активы" description="Будущие крупные покупки и активы, которые хочется довести до реальности." />

      <div className="mb-4 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Общая стоимость всех желаемых активов</div>
            <div className="mt-1.5 font-display text-2xl tabular">{formatMillions(state.targets.reduce((sum, t) => sum + (t.estimatedCost || 0), 0))}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Накоплено всего</div>
            <div className="mt-1.5 font-display text-2xl tabular text-[color:var(--gold)]">{formatMillions(state.targets.reduce((sum, t) => sum + (t.saved || 0), 0))}</div>
          </div>
        </div>
        <div className="mt-3">
          <ProgressBar
            value={state.targets.reduce((sum, t) => sum + (t.saved || 0), 0)}
            max={state.targets.reduce((sum, t) => sum + (t.estimatedCost || 0), 0) || 1}
            accent="gold"
          />
        </div>
      </div>

      <button
        onClick={addNewTarget}
        className="mb-4 inline-flex items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-[color:var(--gold)]/50 hover:text-[color:var(--gold)]"
      >
        <Plus className="h-4 w-4" />
        Добавить актив
      </button>

      <div className="grid gap-4 md:grid-cols-2">
        {state.targets.map((target) => {
          const pct = target.estimatedCost ? (target.saved / target.estimatedCost) * 100 : 0;
          return (
            <div key={target.id} className="flex flex-col rounded-xl border border-border bg-card p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    <span>Горизонт</span>
                    <input
                      value={target.horizon}
                      onChange={(event) => updateTarget(target.id, { horizon: event.target.value })}
                      className="min-w-0 flex-1 bg-transparent uppercase tracking-[0.18em] outline-none transition-colors focus:text-[color:var(--gold)]"
                      placeholder="2026"
                    />
                  </div>
                  <input
                    value={target.name}
                    onChange={(event) => updateTarget(target.id, { name: event.target.value })}
                    className={`mt-1.5 font-display text-xl ${textInputClass}`}
                    placeholder="Название актива"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={target.status} />
                  <button
                    onClick={() => removeTarget(target.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Удалить актив"
                    title="Удалить актив"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <textarea
                value={target.meaning}
                onChange={(event) => updateTarget(target.id, { meaning: event.target.value })}
                className={`mt-3 min-h-24 text-sm text-muted-foreground ${textAreaClass}`}
                placeholder="Описание и смысл актива"
              />

              <div className="mt-5 flex items-baseline justify-between text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Стоимость</div>
                  <EditableNumber value={target.estimatedCost} onChange={(value) => updateTarget(target.id, { estimatedCost: value })} className="text-base tabular" />
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Накоплено</div>
                  <EditableNumber value={target.saved} onChange={(value) => updateTarget(target.id, { saved: value })} className="text-base tabular text-[color:var(--gold)]" />
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[11px] tabular text-muted-foreground">
                  <span>{pct.toFixed(0)}% · {formatMillions(target.saved)}</span>
                  <span>{formatMillions(target.estimatedCost)}</span>
                </div>
                <ProgressBar value={target.saved} max={target.estimatedCost || 1} accent={target.status === "purchased" ? "green" : "gold"} />
              </div>

              <div className="mt-5 border-t border-border pt-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Следующий шаг</div>
                <textarea
                  value={target.nextStep}
                  onChange={(event) => updateTarget(target.id, { nextStep: event.target.value })}
                  className={`mt-1.5 min-h-14 text-sm text-foreground ${textAreaClass}`}
                  placeholder="Что сделать дальше"
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => updateTarget(target.id, { status: option.value })}
                    className={
                      "rounded border px-2.5 py-1 text-[11px] transition-colors " +
                      (target.status === option.value
                        ? "border-[color:var(--gold)]/50 bg-[color:var(--gold)]/5 text-[color:var(--gold)]"
                        : "border-border text-muted-foreground hover:text-foreground")
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </PageContainer>
  );
}
