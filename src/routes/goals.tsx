import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, GripVertical, Lightbulb, Pencil, PlayCircle, Plus, Trash2, WalletCards } from "lucide-react";

import { EditableNumber } from "@/components/EditableNumber";
import { MetricCard, PageContainer, PageHeader } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { formatRub } from "@/lib/format";
import { useCapital, type LifeGoal, type LifeGoalStatus } from "@/lib/capital-store";

export const Route = createFileRoute("/goals")({
  head: () => ({
    meta: [
      { title: "Цели и задачи · LIFE IS GOOD" },
      { name: "description", content: "Бытовые и годовые цели и задачи, сроки и бюджет." },
    ],
  }),
  component: GoalsPage,
});

type Filter = "all" | "active" | "done";

const statusControls: { value: LifeGoalStatus; label: string; icon: typeof PlayCircle }[] = [
  { value: "active", label: "В работе", icon: PlayCircle },
  { value: "done", label: "Выполнено", icon: CheckCircle2 },
];

const todayIso = () => new Date().toISOString().slice(0, 10);
const currentYear = () => String(new Date().getFullYear());
const formatGoalDeadline = (value: string) => {
  if (!value) return "без срока";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(date);
};

const goalDeadlineKey = (goal: Pick<LifeGoal, "deadline" | "title">) => goal.deadline || "9999-12-31";

const compareGoalsByDeadline = (a: Pick<LifeGoal, "deadline" | "title">, b: Pick<LifeGoal, "deadline" | "title">) => {
  const byDeadline = goalDeadlineKey(a).localeCompare(goalDeadlineKey(b));
  if (byDeadline !== 0) return byDeadline;
  return a.title.localeCompare(b.title, "ru");
};

const insertGoalByDeadline = (items: LifeGoal[], goal: LifeGoal) => {
  const next = [...items];
  let targetIndex = next.findIndex((item) => item.status !== "backlog" && compareGoalsByDeadline(goal, item) < 0);
  if (targetIndex < 0) targetIndex = next.findIndex((item) => item.status === "backlog");
  next.splice(targetIndex < 0 ? next.length : targetIndex, 0, goal);
  return next;
};

function EmptyState({ onQuickAdd }: { onQuickAdd: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md border border-border bg-[color:var(--surface-elevated)] text-[color:var(--gold)]">
        <CheckCircle2 className="h-5 w-5" />
      </div>
      <div className="mt-4 font-display text-xl text-foreground">Целей и задач пока нет</div>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Добавь бытовые, годовые или сезонные цели и задачи, чтобы держать их рядом с главным обзором.
      </p>
      <button
        onClick={onQuickAdd}
        className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Plus className="h-4 w-4" />
        Добавить задачу
      </button>
    </div>
  );
}

function GoalsPage() {
  const { state, update, addLifeGoal, updateLifeGoal, removeLifeGoal } = useCapital();
  const goals = state.lifeGoals ?? [];
  const [filter, setFilter] = useState<Filter>("all");
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [draggedGoalId, setDraggedGoalId] = useState<string | null>(null);
  const [backlogTitle, setBacklogTitle] = useState("");
  const [draft, setDraft] = useState({
    title: "",
    period: currentYear(),
    deadline: todayIso(),
    budget: 0,
  });

  const stats = useMemo(() => {
    const plannedGoals = goals.filter((g) => g.status !== "backlog");
    const active = plannedGoals.filter((g) => g.status === "active");
    const done = plannedGoals.filter((g) => g.status === "done");
    const backlog = goals.filter((g) => g.status === "backlog");
    return { active: active.length, done: done.length, backlog: backlog.length, total: plannedGoals.length };
  }, [goals]);

  const visibleGoals = useMemo(() => {
    return goals
      .filter((goal) => goal.status !== "backlog")
      .filter((goal) => (filter === "all" ? true : goal.status === filter));
  }, [filter, goals]);

  const backlogGoals = useMemo(
    () => goals.filter((goal) => goal.status === "backlog").slice().sort((a, b) => a.title.localeCompare(b.title, "ru")),
    [goals],
  );

  const addGoal = () => {
    const title = draft.title.trim();
    if (!title) return;
    const goal: LifeGoal = {
      id: `g${Date.now()}`,
      title,
      period: draft.period.trim() || currentYear(),
      deadline: draft.deadline,
      progress: 0,
      status: "active",
      budget: draft.budget,
      note: "",
    };
    update({ lifeGoals: insertGoalByDeadline(goals, goal) });
    setDraft({ title: "", period: currentYear(), deadline: todayIso(), budget: 0 });
    setFilter("active");
  };

  const addBacklogGoal = () => {
    const title = backlogTitle.trim();
    if (!title) return;
    addLifeGoal({
      id: `g${Date.now()}`,
      title,
      period: "",
      deadline: "",
      progress: 0,
      status: "backlog",
      budget: 0,
      note: "",
    });
    setBacklogTitle("");
  };

  const quickAdd = () => {
    setDraft({
      title: "Новая задача",
      period: currentYear(),
      deadline: todayIso(),
      budget: 0,
    });
  };

  const reorderGoals = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const allGoals = [...(state.lifeGoals ?? [])];
    const sourceIndex = allGoals.findIndex((goal) => goal.id === sourceId);
    const targetIndex = allGoals.findIndex((goal) => goal.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || allGoals[sourceIndex].status === "backlog" || allGoals[targetIndex].status === "backlog") return;
    const [moved] = allGoals.splice(sourceIndex, 1);
    allGoals.splice(targetIndex, 0, moved);
    update({ lifeGoals: allGoals });
    setDraggedGoalId(null);
  };

  const sortGoalsByDeadline = () => {
    const plannedGoals = goals.filter((goal) => goal.status !== "backlog").slice().sort(compareGoalsByDeadline);
    const backlog = goals.filter((goal) => goal.status === "backlog");
    update({ lifeGoals: [...plannedGoals, ...backlog] });
  };

  const activateBacklogGoal = (id: string) => {
    const current = goals.find((goal) => goal.id === id);
    if (!current) return;
    const activated: LifeGoal = { ...current, status: "active", period: currentYear(), deadline: todayIso() };
    update({ lifeGoals: insertGoalByDeadline(goals.filter((goal) => goal.id !== id), activated) });
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Годовые и бытовые цели и задачи"
        title="Цели и задачи"
        description="Сюда попадают вещи, которые важны для жизни прямо сейчас: покупки, поездки, переезды, привычки и небольшие проекты."
      />

      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <MetricCard label="Всего" value={stats.total} sublabel="оформленные цели и задачи" />
        <MetricCard label="Активные" value={stats.active} sublabel="в работе сейчас" accent="gold" />
        <MetricCard label="Выполнено" value={stats.done} sublabel="закрытые цели и задачи" accent="green" />
        <MetricCard label="Бэклог" value={stats.backlog} sublabel="идеи без срока" />
      </div>

      <div className="mb-6 rounded-xl border border-border bg-card p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_120px_160px_150px_auto] lg:items-end">
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Новая цель или задача</span>
            <input
              value={draft.title}
              onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === "Enter") addGoal();
              }}
              placeholder="Например: купить робот-пылесос"
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Год</span>
            <input
              value={draft.period}
              onChange={(event) => setDraft((value) => ({ ...value, period: event.target.value }))}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none"
            />
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Срок</span>
            <input
              type="date"
              value={draft.deadline}
              onChange={(event) => setDraft((value) => ({ ...value, deadline: event.target.value }))}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none"
            />
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Бюджет</span>
            <input
              type="number"
              min={0}
              value={draft.budget}
              onChange={(event) => setDraft((value) => ({ ...value, budget: Number(event.target.value) || 0 }))}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none"
            />
          </label>

          <button
            onClick={addGoal}
            disabled={!draft.title.trim()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Добавить
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {[
          { value: "all", label: "Все" },
          { value: "active", label: "В работе" },
          { value: "done", label: "Выполнено" },
        ].map((item) => (
          <button
            key={item.value}
            onClick={() => setFilter(item.value as Filter)}
            className={
              "rounded-md border px-3 py-1.5 text-xs transition-colors " +
              (filter === item.value
                ? "border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 text-[color:var(--gold)]"
                : "border-border text-muted-foreground hover:bg-[color:var(--surface-elevated)] hover:text-foreground")
            }
          >
            {item.label}
          </button>
        ))}
        <button
          onClick={sortGoalsByDeadline}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-[color:var(--surface-elevated)] hover:text-foreground"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          По сроку
        </button>
      </div>

      {visibleGoals.length === 0 ? (
        <EmptyState onQuickAdd={quickAdd} />
      ) : (
        <div className="space-y-3">
          {visibleGoals.map((goal) => {
            const isEditing = editingGoalId === goal.id;
            return (
              <div
                key={goal.id}
                onDragOver={(event) => {
                  if (draggedGoalId && draggedGoalId !== goal.id && !isEditing) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const sourceId = draggedGoalId ?? event.dataTransfer.getData("text/plain");
                  if (sourceId) reorderGoals(sourceId, goal.id);
                }}
                onDragEnd={() => setDraggedGoalId(null)}
                className={
                  "rounded-xl border border-border bg-card p-5 transition-opacity " +
                  (draggedGoalId === goal.id ? "opacity-50" : "")
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <input
                        value={goal.title}
                        onChange={(event) => updateLifeGoal(goal.id, { title: event.target.value })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 font-display text-xl text-foreground outline-none"
                      />
                    ) : (
                      <div className="font-display text-xl text-foreground">{goal.title}</div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <StatusBadge status={goal.status} />
                      <span>{goal.period || "без периода"}</span>
                      <span>{formatGoalDeadline(goal.deadline)}</span>
                      <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 tabular">
                        <WalletCards className="h-3.5 w-3.5 text-[color:var(--gold)]" />
                        {goal.budget > 0 ? formatRub(goal.budget) : "Бюджет не задан"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditing ? (
                      <div className="flex overflow-hidden rounded-md border border-border">
                        {statusControls.map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.value}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={() => updateLifeGoal(goal.id, { status: item.value })}
                              className={
                                "inline-flex h-9 items-center gap-1.5 px-2.5 text-xs transition-colors " +
                                (goal.status === item.value
                                  ? "bg-[color:var(--gold)]/10 text-[color:var(--gold)]"
                                  : "text-muted-foreground hover:bg-[color:var(--surface-elevated)] hover:text-foreground")
                              }
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                    {!isEditing ? (
                      <div
                        draggable
                        onDragStart={(event) => {
                          setDraggedGoalId(goal.id);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", goal.id);
                        }}
                        onDragEnd={() => setDraggedGoalId(null)}
                        className="inline-flex h-9 w-9 cursor-grab items-center justify-center rounded-md border border-border text-muted-foreground active:cursor-grabbing"
                        title="Перетащить"
                      >
                        <GripVertical className="h-4 w-4" />
                      </div>
                    ) : null}
                    <button
                      onClick={() => setEditingGoalId(isEditing ? null : goal.id)}
                      className={
                        "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors " +
                        (isEditing
                          ? "border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 text-[color:var(--gold)]"
                          : "border-border text-muted-foreground hover:bg-[color:var(--surface-elevated)] hover:text-foreground")
                      }
                    >
                      {isEditing ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                      {isEditing ? "Готово" : "Редактировать"}
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <>
                    <textarea
                      value={goal.note}
                      onChange={(event) => updateLifeGoal(goal.id, { note: event.target.value })}
                      placeholder="Заметка или следующий шаг"
                      className="mt-4 min-h-32 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 text-muted-foreground outline-none placeholder:text-muted-foreground/70"
                    />

                    <div className="mt-4 rounded-lg border border-border bg-[color:var(--surface-elevated)]/40 p-4">
                      <div className="grid gap-4 md:grid-cols-[120px_160px_140px_minmax(180px,1fr)_auto] md:items-end">
                        <label className="block">
                          <span className="flex min-h-4 items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            <CalendarDays className="h-3.5 w-3.5 opacity-0" /> Год
                          </span>
                          <input
                            value={goal.period}
                            onChange={(event) => updateLifeGoal(goal.id, { period: event.target.value })}
                            className="mt-2 w-full rounded-md border border-input bg-background px-2 py-2 text-xs text-foreground outline-none"
                          />
                        </label>

                        <label className="block">
                          <span className="flex min-h-4 items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            <CalendarDays className="h-3.5 w-3.5" /> Срок
                          </span>
                          <input
                            type="date"
                            value={goal.deadline}
                            onChange={(event) => updateLifeGoal(goal.id, { deadline: event.target.value })}
                            className="mt-2 w-full rounded-md border border-input bg-background px-2 py-2 text-xs text-foreground outline-none"
                          />
                        </label>

                        <div>
                          <div className="flex min-h-4 items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            <WalletCards className="h-3.5 w-3.5" /> Бюджет
                          </div>
                          <EditableNumber value={goal.budget} onChange={(value) => updateLifeGoal(goal.id, { budget: value })} className="mt-2 text-sm" />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {statusControls.map((item) => {
                            const Icon = item.icon;
                            return (
                              <button
                                key={item.value}
                                onClick={() =>
                                  updateLifeGoal(goal.id, {
                                    status: item.value,
                                  })
                                }
                                className={
                                  "flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors " +
                                  (goal.status === item.value
                                    ? "border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 text-[color:var(--gold)]"
                                    : "border-border text-muted-foreground hover:bg-background hover:text-foreground")
                                }
                              >
                                <Icon className="h-3.5 w-3.5" />
                                {item.label}
                              </button>
                            );
                          })}
                        </div>

                        <button
                          onClick={() => removeLifeGoal(goal.id)}
                          className="inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Удалить
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="mt-3 text-sm leading-6 text-muted-foreground">
                    {goal.note || "Заметка не добавлена"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[color:var(--gold)]">
              <Lightbulb className="h-3.5 w-3.5" /> Бэклог целей
            </div>
            <div className="mt-1 font-display text-xl">Идеи идей</div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_auto]">
          <input
            value={backlogTitle}
            onChange={(event) => setBacklogTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addBacklogGoal();
            }}
            placeholder="Например: съездить на Байкал"
            className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={addBacklogGoal}
            disabled={!backlogTitle.trim()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-4 text-sm text-foreground transition-colors hover:bg-[color:var(--surface-elevated)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            В бэклог
          </button>
        </div>

        {backlogGoals.length ? (
          <div className="mt-4 grid gap-2">
            {backlogGoals.map((goal) => (
              <div key={goal.id} className="flex flex-col gap-3 rounded-lg border border-border bg-[color:var(--surface-elevated)]/40 p-3 md:flex-row md:items-center md:justify-between">
                <input
                  value={goal.title}
                  onChange={(event) => updateLifeGoal(goal.id, { title: event.target.value })}
                  className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => activateBacklogGoal(goal.id)}
                    className="inline-flex items-center gap-2 rounded-md border border-[color:var(--gold)]/40 px-3 py-2 text-xs text-[color:var(--gold)] transition-colors hover:bg-[color:var(--gold)]/10"
                  >
                    <PlayCircle className="h-3.5 w-3.5" />
                    В работу
                  </button>
                  <button
                    onClick={() => removeLifeGoal(goal.id)}
                    className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            Пока пусто. Сюда можно быстро складывать идеи, не превращая их в план.
          </div>
        )}
      </div>
    </PageContainer>
  );
}
