import { createFileRoute } from "@tanstack/react-router";
import { useCapital } from "@/lib/capital-store";
import { PageContainer, PageHeader } from "@/components/MetricCard";

export const Route = createFileRoute("/life-map")({
  head: () => ({ meta: [{ title: "Карта жизни · LIFE IS GOOD" }, { name: "description", content: "Стратегическая дорожная карта на 37-50+ лет." }] }),
  component: LifeMap,
});

function LifeMap() {
  const { state, update } = useCapital();

  return (
    <PageContainer>
      <PageHeader eyebrow="Стратегия" title="Карта жизни" description="Не календарь задач, а дорожная карта эпох. От фундамента к свободе и наследию." />

      <div className="relative">
        <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-border" />
        <div className="space-y-10">
          {state.stages.map((stage, idx) => {
            const isActive = stage.id === state.currentStageId;
            const side = idx % 2 === 0 ? "md:pr-[52%] md:text-right" : "md:pl-[52%]";
            return (
              <div key={stage.id} className="relative pl-12 md:pl-0">
                <div
                  className={
                    "absolute left-2.5 md:left-1/2 top-3 -translate-x-1/2 h-4 w-4 rounded-full border-2 " +
                    (isActive ? "border-[color:var(--gold)] bg-[color:var(--gold)]" : "border-border bg-background")
                  }
                />
                <div className={side}>
                  <div className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--gold)]">Период {stage.period}</div>
                  <h3 className="font-display text-2xl md:text-3xl mt-2 text-foreground">{stage.title}</h3>
                  <div className="mt-1 text-xs text-muted-foreground italic">{stage.lifeType}</div>

                  <div className={"mt-5 inline-block rounded-xl border border-border bg-card p-5 text-left max-w-xl " + (isActive ? "ring-1 ring-[color:var(--gold)]/30" : "")}>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Желаемый доход</div>
                        <div className="font-display text-base mt-1 tabular text-[color:var(--gold)]">{stage.desiredIncome}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Роль</div>
                        <div className="text-sm mt-1">{stage.role}</div>
                      </div>
                    </div>

                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Главные цели и задачи</div>
                    <ul className="mt-2 space-y-1.5">
                      {stage.goals.map((g, i) => (
                        <li key={i} className="text-sm text-foreground flex gap-2">
                          <span className="text-[color:var(--gold)] mt-0.5">·</span>
                          <span className="text-muted-foreground">{g}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Целевые активы</div>
                      <div className="mt-2 flex gap-1.5 flex-wrap">
                        {stage.targetAssets.map((a) => (
                          <span key={a} className="px-2 py-0.5 rounded text-[11px] border border-border text-foreground bg-[color:var(--surface-elevated)]">
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Ключевой фокус</div>
                      <div className="mt-1.5 text-sm text-foreground">{stage.focus}</div>
                    </div>

                    {!isActive && (
                      <button
                        onClick={() => update({ currentStageId: stage.id })}
                        className="mt-4 text-[11px] text-muted-foreground hover:text-[color:var(--gold)]"
                      >
                        Сделать текущим этапом →
                      </button>
                    )}
                    {isActive && (
                      <div className="mt-4 text-[11px] text-[color:var(--gold)] uppercase tracking-wider">● текущий этап</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PageContainer>
  );
}
