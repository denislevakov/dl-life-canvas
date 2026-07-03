import { createFileRoute } from "@tanstack/react-router";
import { useCapital, type IncomeSource } from "@/lib/capital-store";
import { PageContainer, PageHeader, MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { EditableNumber } from "@/components/EditableNumber";
import { formatRub } from "@/lib/format";
import { Plus, Trash2, Globe, User, TrendingUp, Zap, Leaf } from "lucide-react";

export const Route = createFileRoute("/income-sources")({
  head: () => ({ meta: [{ title: "Источники дохода · LIFE IS GOOD" }, { name: "description", content: "Текущие и будущие источники дохода, независимость и география." }] }),
  component: IncomePage,
});

function IncomePage() {
  const { state, addIncome, updateIncome, removeIncome } = useCapital();
  const sources = state.incomeSources;
  const active = sources.filter((s) => s.status === "active");
  const total = active.reduce((a, s) => a + s.monthly, 0);
  const activeKind = active.filter((s) => s.kind === "active").reduce((a, s) => a + s.monthly, 0);
  const passiveKind = active.filter((s) => s.kind === "passive").reduce((a, s) => a + s.monthly, 0);
  const passiveShare = total ? (passiveKind / total) * 100 : 0;

  const addNew = (kind: "active" | "passive" = "active") => {
    const s: IncomeSource = {
      id: "i" + Date.now(),
      name: kind === "passive" ? "Новый пассивный источник" : "Новый активный источник",
      type: kind === "passive" ? "Инвестиции" : "Проект",
      geography: "Глобально",
      monthly: 0,
      growth: "medium",
      selfDependent: kind === "active",
      countryBound: false,
      status: "planned",
      kind,
    };
    addIncome(s);
  };

  const renderSource = (s: IncomeSource) => (
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
          onClick={() => updateIncome(s.id, { kind: s.kind === "active" ? "passive" : "active" })}
          className={"inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] border " +
            (s.kind === "passive" ? "border-[color:oklch(0.5_0.08_160)] text-[color:oklch(0.75_0.1_160)]" : "border-[color:var(--gold)]/40 text-[color:var(--gold)]")}
        >
          {s.kind === "passive" ? <Leaf className="h-3 w-3" /> : <Zap className="h-3 w-3" />} {s.kind === "passive" ? "Пассивный" : "Активный"}
        </button>
        <button
          onClick={() => updateIncome(s.id, { selfDependent: !s.selfDependent })}
          className={"inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] border " +
            (s.selfDependent ? "border-border text-foreground" : "border-border text-muted-foreground")}
        >
          <User className="h-3 w-3" /> {s.selfDependent ? "Зависит от меня" : "Внешняя зависимость"}
        </button>
        <button
          onClick={() => updateIncome(s.id, { countryBound: !s.countryBound })}
          className={"inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] border " +
            (!s.countryBound ? "border-border text-foreground" : "border-border text-muted-foreground")}
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
  );

  const activeSources = sources.filter((s) => s.kind === "active");
  const passiveSources = sources.filter((s) => s.kind === "passive");

  return (
    <PageContainer>
      <PageHeader eyebrow="Поток" title="Источники дохода" description="Активные и пассивные потоки. Доля пассивного дохода — ключевая метрика свободы." />

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <MetricCard label="Активный доход" value={formatRub(activeKind)} sublabel={`${activeSources.filter((s) => s.status === "active").length} источников`} accent="gold" />
        <MetricCard label="Пассивный доход" value={formatRub(passiveKind)} sublabel={`${passiveSources.filter((s) => s.status === "active").length} источников`} accent="green" />
        <MetricCard label="Доля пассивного" value={`${passiveShare.toFixed(0)}%`} sublabel={`из ${formatRub(total)} общего`} />
      </div>

      <div className="space-y-8">
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-[color:var(--gold)]" />
              <h2 className="font-display text-lg">Активные источники</h2>
              <span className="text-xs text-muted-foreground tabular">· {formatRub(activeKind)} / мес</span>
            </div>
          </div>
          <div className="space-y-3">
            {activeSources.map(renderSource)}
            <button onClick={() => addNew("active")} className="w-full rounded-lg border border-dashed border-border py-3 text-sm text-muted-foreground hover:text-[color:var(--gold)] inline-flex items-center justify-center gap-2">
              <Plus className="h-4 w-4" /> Добавить активный источник
            </button>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-[color:oklch(0.75_0.1_160)]" />
              <h2 className="font-display text-lg">Пассивные источники</h2>
              <span className="text-xs text-muted-foreground tabular">· {formatRub(passiveKind)} / мес</span>
            </div>
          </div>
          <div className="space-y-3">
            {passiveSources.map(renderSource)}
            <button onClick={() => addNew("passive")} className="w-full rounded-lg border border-dashed border-border py-3 text-sm text-muted-foreground hover:text-[color:oklch(0.75_0.1_160)] inline-flex items-center justify-center gap-2">
              <Plus className="h-4 w-4" /> Добавить пассивный источник
            </button>
          </div>
        </section>
      </div>

      <div className="mt-10 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[color:var(--gold)]">
          <TrendingUp className="h-3.5 w-3.5" /> Принцип
        </div>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-3xl">
          Цель — увеличивать <span className="text-foreground">долю пассивного дохода</span>, который поступает без операционной нагрузки: инвестиции, доли в бизнесе, аренда. На этапе свободы пассивные источники должны полностью покрывать жизнь.
        </p>
      </div>
    </PageContainer>
  );
}
