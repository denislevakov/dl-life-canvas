import { createFileRoute } from "@tanstack/react-router";
import { useCapital, type IncomeSource } from "@/lib/capital-store";
import { PageContainer, PageHeader, MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { EditableNumber } from "@/components/EditableNumber";
import { formatRub } from "@/lib/format";
import { Plus, Trash2, Globe, User, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/income-sources")({
  head: () => ({ meta: [{ title: "Источники дохода · Life Capital" }, { name: "description", content: "Текущие и будущие источники дохода, независимость и география." }] }),
  component: IncomePage,
});

function IncomePage() {
  const { state, totals, addIncome, updateIncome, removeIncome } = useCapital();
  const sources = state.incomeSources;
  const total = sources.filter((s) => s.status === "active").reduce((a, s) => a + s.monthly, 0);
  const freeFromCountry = sources.filter((s) => !s.countryBound && s.status === "active").reduce((a, s) => a + s.monthly, 0);
  const selfDependent = sources.filter((s) => s.selfDependent && s.status === "active").reduce((a, s) => a + s.monthly, 0);

  const addNew = () => {
    const s: IncomeSource = {
      id: "i" + Date.now(),
      name: "Новый источник",
      type: "Проект",
      geography: "Глобально",
      monthly: 0,
      growth: "medium",
      selfDependent: true,
      countryBound: false,
      status: "planned",
    };
    addIncome(s);
  };

  return (
    <PageContainer>
      <PageHeader eyebrow="Поток" title="Источники дохода" description="Что приносит деньги сегодня и что должно приносить завтра. Подсвечены источники, не привязанные к стране и зависящие только от вас." />

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <MetricCard label="Активный доход" value={formatRub(total)} sublabel={`${sources.filter((s) => s.status === "active").length} активных источников`} accent="gold" />
        <MetricCard label="Независимо от страны" value={formatRub(freeFromCountry)} sublabel="не привязано к географии" accent="green" />
        <MetricCard label="Зависит только от меня" value={formatRub(selfDependent)} sublabel="контроль 100%" />
      </div>

      {sources.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-12 text-center">
          <div className="font-display text-lg text-foreground">Источников пока нет</div>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Добавьте первый источник дохода, чтобы видеть структуру потоков и зависимость от страны.
          </p>
          <button onClick={addNew} className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[color:var(--gold)] text-[color:var(--accent-foreground)] text-sm">
            <Plus className="h-4 w-4" /> Добавить источник
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map((s) => (
            <div key={s.id} className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <input
                    value={s.name}
                    onChange={(e) => updateIncome(s.id, { name: e.target.value })}
                    className="bg-transparent font-display text-lg focus:outline-none focus:text-[color:var(--gold)] w-full"
                  />
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <input value={s.type} onChange={(e) => updateIncome(s.id, { type: e.target.value })} className="bg-transparent focus:outline-none focus:text-foreground" />
                    <span>·</span>
                    <input value={s.geography} onChange={(e) => updateIncome(s.id, { geography: e.target.value })} className="bg-transparent focus:outline-none focus:text-foreground" />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">В месяц</div>
                  <EditableNumber value={s.monthly} onChange={(n) => updateIncome(s.id, { monthly: n })} className="text-lg text-[color:var(--gold)]" />
                </div>
                <StatusBadge status={s.status} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => updateIncome(s.id, { selfDependent: !s.selfDependent })}
                  className={"inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] border " +
                    (s.selfDependent ? "border-[color:var(--gold)]/40 text-[color:var(--gold)]" : "border-border text-muted-foreground")}
                >
                  <User className="h-3 w-3" /> {s.selfDependent ? "Зависит от меня" : "Внешняя зависимость"}
                </button>
                <button
                  onClick={() => updateIncome(s.id, { countryBound: !s.countryBound })}
                  className={"inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] border " +
                    (!s.countryBound ? "border-[color:oklch(0.5_0.08_160)] text-[color:oklch(0.75_0.1_160)]" : "border-border text-muted-foreground")}
                >
                  <Globe className="h-3 w-3" /> {s.countryBound ? "Привязан к стране" : "Без привязки"}
                </button>
                <select
                  value={s.growth}
                  onChange={(e) => updateIncome(s.id, { growth: e.target.value as IncomeSource["growth"] })}
                  className="bg-input border border-border rounded px-2 py-1 text-[11px] text-muted-foreground"
                >
                  <option value="low">рост: низкий</option>
                  <option value="medium">рост: средний</option>
                  <option value="high">рост: высокий</option>
                </select>
                <select
                  value={s.status}
                  onChange={(e) => updateIncome(s.id, { status: e.target.value as IncomeSource["status"] })}
                  className="bg-input border border-border rounded px-2 py-1 text-[11px] text-muted-foreground"
                >
                  <option value="active">активен</option>
                  <option value="planned">планируется</option>
                  <option value="paused">на паузе</option>
                </select>
                <button onClick={() => removeIncome(s.id)} className="ml-auto text-muted-foreground hover:text-destructive inline-flex items-center gap-1 text-[11px]">
                  <Trash2 className="h-3 w-3" /> удалить
                </button>
              </div>
            </div>
          ))}
          <button onClick={addNew} className="w-full rounded-lg border border-dashed border-border py-3 text-sm text-muted-foreground hover:text-[color:var(--gold)] inline-flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" /> Добавить источник
          </button>
        </div>
      )}

      <div className="mt-10 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[color:var(--gold)]">
          <TrendingUp className="h-3.5 w-3.5" /> Принцип
        </div>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-3xl">
          Главные источники — те, что <span className="text-foreground">зависят только от вас</span>, дают <span className="text-foreground">стабильный ежемесячный доход</span> и <span className="text-foreground">не привязаны к стране</span>. Всё, что выше прожиточного минимума, направляется на инвестиции в себя, накопления и покупку целевых активов.
        </p>
      </div>
    </PageContainer>
  );
}