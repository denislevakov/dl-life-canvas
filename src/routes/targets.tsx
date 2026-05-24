import { createFileRoute } from "@tanstack/react-router";
import { useCapital } from "@/lib/capital-store";
import { PageContainer, PageHeader } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { ProgressBar } from "@/components/ProgressBar";
import { EditableNumber } from "@/components/EditableNumber";
import { formatMillions } from "@/lib/format";

export const Route = createFileRoute("/targets")({
  head: () => ({ meta: [{ title: "Целевые активы · Life Capital" }, { name: "description", content: "Карта будущих активов: Москва, Япония, Флорида." }] }),
  component: TargetsPage,
});

const statusOptions = [
  { value: "idea", label: "Идея" },
  { value: "planned", label: "Планируется" },
  { value: "in_progress", label: "В работе" },
  { value: "purchased", label: "Куплено" },
] as const;

function TargetsPage() {
  const { state, updateTarget } = useCapital();

  return (
    <PageContainer>
      <PageHeader eyebrow="Стратегия" title="Целевые активы" description="Берлога в Москве, семейная квартира, дом отшельника в Японии и старость во Флориде." />

      <div className="grid md:grid-cols-2 gap-4">
        {state.targets.map((t) => {
          const pct = t.estimatedCost ? (t.saved / t.estimatedCost) * 100 : 0;
          return (
            <div key={t.id} className="rounded-xl border border-border bg-card p-6 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Горизонт {t.horizon}</div>
                  <h3 className="font-display text-xl mt-1.5">{t.name}</h3>
                </div>
                <StatusBadge status={t.status} />
              </div>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{t.meaning}</p>

              <div className="mt-5 flex items-baseline justify-between text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Стоимость</div>
                  <EditableNumber value={t.estimatedCost} onChange={(n) => updateTarget(t.id, { estimatedCost: n })} className="text-base tabular" />
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Накоплено</div>
                  <EditableNumber value={t.saved} onChange={(n) => updateTarget(t.id, { saved: n })} className="text-base tabular text-[color:var(--gold)]" />
                </div>
              </div>

              <div className="mt-3">
                <div className="flex justify-between text-[11px] text-muted-foreground mb-1 tabular">
                  <span>{pct.toFixed(0)}% · {formatMillions(t.saved)}</span>
                  <span>{formatMillions(t.estimatedCost)}</span>
                </div>
                <ProgressBar value={t.saved} max={t.estimatedCost || 1} accent={t.status === "purchased" ? "green" : "gold"} />
              </div>

              <div className="mt-5 pt-4 border-t border-border">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Следующий шаг</div>
                <div className="mt-1.5 text-sm">{t.nextStep}</div>
              </div>

              <div className="mt-4 flex gap-1.5 flex-wrap">
                {statusOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateTarget(t.id, { status: opt.value })}
                    className={
                      "px-2.5 py-1 rounded text-[11px] border transition-colors " +
                      (t.status === opt.value
                        ? "border-[color:var(--gold)]/50 text-[color:var(--gold)] bg-[color:var(--gold)]/5"
                        : "border-border text-muted-foreground hover:text-foreground")
                    }
                  >
                    {opt.label}
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