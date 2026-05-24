import { createFileRoute } from "@tanstack/react-router";
import { useCapital, type AssetType } from "@/lib/capital-store";
import { PageContainer, PageHeader, MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { EditableNumber } from "@/components/EditableNumber";
import { formatMillions, formatRange } from "@/lib/format";
import { Plus, Trash2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/assets")({
  head: () => ({ meta: [{ title: "Активы · Life Capital" }, { name: "description", content: "Структура текущих активов и долей в общем капитале." }] }),
  component: AssetsPage,
});

const typeLabels: Record<AssetType, string> = {
  real_estate: "Недвижимость",
  collection: "Коллекция",
  vehicle: "Транспорт",
  cash: "Кэш",
  other: "Другое",
};

function AssetsPage() {
  const { state, totals, updateAsset, addAsset, removeAsset } = useCapital();

  return (
    <PageContainer>
      <PageHeader eyebrow="Капитал" title="Активы" description="Структура того, что уже принадлежит: недвижимость, коллекции, идентичность. Все значения редактируются." />

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <MetricCard label="Капитал — диапазон" value={formatRange(totals.minCapital, totals.maxCapital)} sublabel={`средняя ${formatMillions(totals.estimatedCapital)}`} accent="gold" />
        <MetricCard label="Объекты" value={state.assets.length} sublabel={`${state.assets.filter((a) => a.identity).length} активов идентичности`} />
        <MetricCard label="Доля недвижимости" value={`${Math.round((state.assets.filter((a) => a.type === "real_estate").reduce((s, a) => s + a.estimated, 0) / (totals.estimatedCapital || 1)) * 100)}%`} sublabel="от средней оценки" accent="green" />
      </div>

      <div className="space-y-3">
        {state.assets.map((a) => {
          const share = (a.estimated / (totals.estimatedCapital || 1)) * 100;
          return (
            <div key={a.id} className="rounded-lg border border-border bg-card p-5">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-display text-lg text-foreground">{a.name}</div>
                    <StatusBadge status={a.status} />
                    {a.identity && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider border border-[color:var(--gold)]/40 text-[color:var(--gold)]">
                        <Sparkles className="h-3 w-3" /> идентичность
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground uppercase tracking-wider">{typeLabels[a.type]}</div>
                  <div className="mt-4 grid grid-cols-3 gap-4 max-w-lg">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Мин</div>
                      <EditableNumber value={a.min} onChange={(n) => updateAsset(a.id, { min: n })} className="text-sm mt-1" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[color:var(--gold)]">Оценка</div>
                      <EditableNumber value={a.estimated} onChange={(n) => updateAsset(a.id, { estimated: n })} className="text-sm mt-1 text-[color:var(--gold)]" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Макс</div>
                      <EditableNumber value={a.max} onChange={(n) => updateAsset(a.id, { max: n })} className="text-sm mt-1" />
                    </div>
                  </div>
                </div>
                <div className="md:text-right md:min-w-[180px]">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Доля в капитале</div>
                  <div className="font-display text-2xl tabular mt-1">{share.toFixed(1)}%</div>
                  <div className="mt-2 h-1 w-full md:w-32 md:ml-auto rounded-full bg-[color:var(--surface-elevated)] overflow-hidden">
                    <div className="h-full" style={{ width: `${share}%`, background: "var(--gradient-gold)" }} />
                  </div>
                  <button
                    onClick={() => removeAsset(a.id)}
                    className="mt-3 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" /> удалить
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        <button
          onClick={() =>
            addAsset({
              id: "a" + Date.now(),
              name: "Новый актив",
              type: "other",
              min: 0,
              estimated: 0,
              max: 0,
              status: "owned",
            })
          }
          className="w-full rounded-lg border border-dashed border-border py-4 text-sm text-muted-foreground hover:text-[color:var(--gold)] hover:border-[color:var(--gold)]/40 transition-colors inline-flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" /> Добавить актив
        </button>
      </div>
    </PageContainer>
  );
}