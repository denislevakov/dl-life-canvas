import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, ChevronDown, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";

import { MetricCard, PageContainer, PageHeader } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useCapital, type LifeArea, type LifeAreaAction, type LifeAreaKind, type LifeAreaSkillType, type LifeAreaStatus } from "@/lib/capital-store";

type Filter = "all" | LifeAreaStatus;
type SkillFilter = "all" | LifeAreaSkillType;

interface LifeAreaPageProps {
  kind: LifeAreaKind;
  eyebrow: string;
  title: string;
  description: string;
  placeholder: string;
  emptyTitle: string;
}

const statusOptions: { value: LifeAreaStatus; label: string }[] = [
  { value: "active", label: "В работе" },
  { value: "backlog", label: "Бэклог" },
  { value: "done", label: "Выполнено" },
];

const filterOptions: { value: Filter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "active", label: "В работе" },
  { value: "backlog", label: "Бэклог" },
  { value: "done", label: "Выполнено" },
];

const skillFilterOptions: { value: SkillFilter; label: string }[] = [
  { value: "all", label: "Все скилы" },
  { value: "hard", label: "Hard" },
  { value: "soft", label: "Soft" },
];

const skillTypeOptions: { value: LifeAreaSkillType; label: string }[] = [
  { value: "hard", label: "Hard skill" },
  { value: "soft", label: "Soft skill" },
];

const formatDeadline = (value: string) => {
  if (!value) return "без срока";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(date);
};

const inferSkillType = (area: LifeArea): LifeAreaSkillType => {
  if (area.skillType) return area.skillType;
  const text = `${area.title} ${area.description}`.toLowerCase();
  if (/систем|переговор|коммуникац|лидер|мышлен|презентац|эмпати|управлен|стратег/.test(text)) return "soft";
  return "hard";
};

const orderActionsByStatus = (actions: LifeAreaAction[]) => [
  ...actions.filter((action) => action.status !== "done"),
  ...actions.filter((action) => action.status === "done"),
];

const getActionDeadlineTime = (action: LifeAreaAction) => {
  if (!action.deadline) return Number.POSITIVE_INFINITY;
  const time = new Date(`${action.deadline}T00:00:00`).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
};

const orderActionsAfterStatusToggle = (actions: LifeAreaAction[], actionId: string, wasDone: boolean) => {
  const activeActions = actions.filter((action) => action.status !== "done");
  const doneActions = actions.filter((action) => action.status === "done");

  if (wasDone) {
    const sortedActiveActions = activeActions
      .map((action, index) => ({ action, index }))
      .sort((left, right) => getActionDeadlineTime(left.action) - getActionDeadlineTime(right.action) || left.index - right.index)
      .map(({ action }) => action);
    return [...sortedActiveActions, ...doneActions];
  }

  const toggledAction = doneActions.find((action) => action.id === actionId);
  return [
    ...activeActions,
    ...doneActions.filter((action) => action.id !== actionId),
    ...(toggledAction ? [toggledAction] : []),
  ];
};

export function LifeAreaPage({ kind, eyebrow, title, description, placeholder, emptyTitle }: LifeAreaPageProps) {
  const { state, update, addLifeArea, updateLifeArea, removeLifeArea } = useCapital();
  const [filter, setFilter] = useState<Filter>("all");
  const [skillFilter, setSkillFilter] = useState<SkillFilter>("all");
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [expandedActionAreaIds, setExpandedActionAreaIds] = useState<string[]>([]);
  const [draggedAreaId, setDraggedAreaId] = useState<string | null>(null);
  const [draggedAction, setDraggedAction] = useState<{ areaId: string; actionId: string } | null>(null);
  const [draft, setDraft] = useState({ title: "", horizon: String(new Date().getFullYear()), description: "", skillType: "hard" as LifeAreaSkillType });

  useEffect(() => {
    if (!draggedAction) return;
    const stopDragging = () => setDraggedAction(null);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
    return () => {
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, [draggedAction]);

  const areas = useMemo(() => (state.lifeAreas ?? []).filter((area) => area.kind === kind), [kind, state.lifeAreas]);

  const stats = useMemo(() => {
    const active = areas.filter((area) => area.status === "active").length;
    const done = areas.filter((area) => area.status === "done").length;
    const backlog = areas.filter((area) => area.status === "backlog").length;
    const openActions = areas.flatMap((area) => area.actions ?? []).filter((action) => action.status === "active").length;
    return { total: areas.length, active, done, backlog, openActions };
  }, [areas]);

  const visibleAreas = useMemo(() => {
    return areas.filter((area) => {
      const matchesStatus = filter === "all" ? true : area.status === filter;
      const matchesSkillType = kind !== "skill" || skillFilter === "all" ? true : inferSkillType(area) === skillFilter;
      return matchesStatus && matchesSkillType;
    });
  }, [areas, filter, kind, skillFilter]);

  const addArea = () => {
    const areaTitle = draft.title.trim();
    if (!areaTitle) return;
    const area: LifeArea = {
      id: `la_${kind}_${Date.now()}`,
      kind,
      title: areaTitle,
      horizon: draft.horizon.trim() || String(new Date().getFullYear()),
      description: draft.description.trim(),
      status: "active",
      actions: [],
    };
    if (kind === "skill") {
      area.skillType = skillFilter === "all" ? draft.skillType : skillFilter;
    }
    addLifeArea(area);
    setDraft({ title: "", horizon: String(new Date().getFullYear()), description: "", skillType: draft.skillType });
    setEditingAreaId(area.id);
    setFilter("active");
  };

  const updateAction = (area: LifeArea, actionId: string, patch: Partial<LifeAreaAction>) => {
    updateLifeArea(area.id, {
      actions: (area.actions ?? []).map((action) => (action.id === actionId ? { ...action, ...patch } : action)),
    });
  };

  const addAction = (area: LifeArea) => {
    updateLifeArea(area.id, {
      actions: [
        ...(area.actions ?? []),
        {
          id: `laa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title: "Новый шаг",
          deadline: "",
          status: "active",
          note: "",
        },
      ],
    });
    setEditingAreaId(area.id);
  };

  const removeAction = (area: LifeArea, actionId: string) => {
    updateLifeArea(area.id, { actions: (area.actions ?? []).filter((action) => action.id !== actionId) });
  };

  const toggleActionStatus = (area: LifeArea, actionId: string) => {
    const currentActions = area.actions ?? [];
    const wasDone = currentActions.find((action) => action.id === actionId)?.status === "done";
    const actions = currentActions.map((action) =>
      action.id === actionId ? { ...action, status: action.status === "done" ? "active" : "done" } : action,
    );
    updateLifeArea(area.id, { actions: orderActionsAfterStatusToggle(actions, actionId, wasDone) });
  };

  const toggleActionList = (areaId: string) => {
    setExpandedActionAreaIds((ids) => (ids.includes(areaId) ? ids.filter((id) => id !== areaId) : [...ids, areaId]));
  };

  const reorderActions = (area: LifeArea, sourceId: string, targetId: string, options?: { keepDragging?: boolean }) => {
    if (sourceId === targetId) return;
    const actions = [...(area.actions ?? [])];
    const sourceIndex = actions.findIndex((action) => action.id === sourceId);
    const targetIndex = actions.findIndex((action) => action.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [moved] = actions.splice(sourceIndex, 1);
    actions.splice(targetIndex, 0, moved);
    updateLifeArea(area.id, { actions });
    if (!options?.keepDragging) setDraggedAction(null);
  };

  const reorderActionOnEnter = (area: LifeArea, targetId: string) => {
    if (!draggedAction || draggedAction.areaId !== area.id || draggedAction.actionId === targetId) return;
    reorderActions(area, draggedAction.actionId, targetId, { keepDragging: true });
  };

  const reorderAreas = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const allAreas = [...(state.lifeAreas ?? [])];
    const sourceIndex = allAreas.findIndex((area) => area.id === sourceId);
    const targetIndex = allAreas.findIndex((area) => area.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || allAreas[sourceIndex].kind !== kind || allAreas[targetIndex].kind !== kind) return;
    const [moved] = allAreas.splice(sourceIndex, 1);
    allAreas.splice(targetIndex, 0, moved);
    update({ lifeAreas: allAreas });
    setDraggedAreaId(null);
  };

  return (
    <PageContainer>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />

      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <MetricCard label="Всего" value={stats.total} sublabel="в разделе" />
        <MetricCard label="В работе" value={stats.active} sublabel="активные блоки" accent="gold" />
        <MetricCard label="Действия" value={stats.openActions} sublabel="открытые шаги" />
        <MetricCard label="Выполнено" value={stats.done} sublabel={`бэклог: ${stats.backlog}`} accent="green" />
      </div>

      <div className="mb-6 rounded-xl border border-border bg-card p-5">
        <div
          className={
            "grid gap-3 lg:items-end " +
            (kind === "skill"
              ? "lg:grid-cols-[minmax(220px,1fr)_120px_130px_minmax(220px,1fr)_auto]"
              : "lg:grid-cols-[minmax(240px,1fr)_150px_minmax(240px,1fr)_auto]")
          }
        >
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Название</span>
            <input
              value={draft.title}
              onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === "Enter") addArea();
              }}
              placeholder={placeholder}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Срок</span>
            <input
              value={draft.horizon}
              onChange={(event) => setDraft((value) => ({ ...value, horizon: event.target.value }))}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none"
            />
          </label>

          {kind === "skill" ? (
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Тип</span>
              <select
                value={draft.skillType}
                onChange={(event) => setDraft((value) => ({ ...value, skillType: event.target.value as LifeAreaSkillType }))}
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none"
              >
                {skillTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Описание</span>
            <input
              value={draft.description}
              onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))}
              placeholder="Коротко, что это и зачем"
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>

          <button
            onClick={addArea}
            disabled={!draft.title.trim()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Добавить
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {filterOptions.map((item) => (
          <button
            key={item.value}
            onClick={() => setFilter(item.value)}
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
      </div>

      {kind === "skill" ? (
        <div className="mb-5 flex flex-wrap gap-2">
          {skillFilterOptions.map((item) => (
            <button
              key={item.value}
              onClick={() => setSkillFilter(item.value)}
              className={
                "rounded-md border px-3 py-1.5 text-xs transition-colors " +
                (skillFilter === item.value
                  ? "border-[color:var(--gold)]/50 bg-[color:var(--gold)]/10 text-[color:var(--gold)]"
                  : "border-border text-muted-foreground hover:bg-[color:var(--surface-elevated)] hover:text-foreground")
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {visibleAreas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <div className="font-display text-xl text-foreground">{emptyTitle}</div>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visibleAreas.map((area) => {
            const isEditing = editingAreaId === area.id;
            const openActions = (area.actions ?? []).filter((action) => action.status === "active").length;
            const orderedActions = orderActionsByStatus(area.actions ?? []);
            const isActionListExpanded = expandedActionAreaIds.includes(area.id);
            const visibleActions = isActionListExpanded ? orderedActions : orderedActions.slice(0, 4);
            const hiddenActionsCount = Math.max(orderedActions.length - visibleActions.length, 0);

            return (
              <article
                key={area.id}
                onDragOver={(event) => {
                  if (draggedAreaId && draggedAreaId !== area.id && !isEditing) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const sourceId = draggedAreaId ?? event.dataTransfer.getData("text/plain");
                  if (sourceId) reorderAreas(sourceId, area.id);
                }}
                onDragEnd={() => setDraggedAreaId(null)}
                className={
                  "rounded-xl border border-border bg-card p-5 transition-opacity " +
                  (!isEditing ? "cursor-grab active:cursor-grabbing " : "") +
                  (draggedAreaId === area.id ? "opacity-50" : "")
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <input
                        value={area.title}
                        onChange={(event) => updateLifeArea(area.id, { title: event.target.value })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 font-display text-xl text-foreground outline-none"
                      />
                    ) : (
                      <div className="font-display text-xl text-foreground">{area.title}</div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <StatusBadge status={area.status} />
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {area.horizon || "без срока"}
                      </span>
                      {kind === "skill" ? <span>{inferSkillType(area) === "hard" ? "Hard" : "Soft"}</span> : null}
                      <span>{openActions} в работе</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isEditing ? (
                      <div
                        draggable
                        onDragStart={(event) => {
                          setDraggedAreaId(area.id);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", area.id);
                        }}
                        onDragEnd={() => setDraggedAreaId(null)}
                        className="inline-flex h-9 w-9 cursor-grab items-center justify-center rounded-md border border-border text-muted-foreground active:cursor-grabbing"
                        title="Перетащить"
                      >
                        <GripVertical className="h-4 w-4" />
                      </div>
                    ) : null}
                    <button
                      onClick={() => setEditingAreaId(isEditing ? null : area.id)}
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
                    <div className={"mt-4 grid gap-3 " + (kind === "skill" ? "md:grid-cols-[minmax(140px,1fr)_140px_160px]" : "md:grid-cols-[minmax(140px,1fr)_160px]")}>
                      <label className="block">
                        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Срок</span>
                        <input
                          value={area.horizon}
                          onChange={(event) => updateLifeArea(area.id, { horizon: event.target.value })}
                          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none"
                        />
                      </label>

                      {kind === "skill" ? (
                        <label className="block">
                          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Тип</span>
                          <select
                            value={inferSkillType(area)}
                            onChange={(event) => updateLifeArea(area.id, { skillType: event.target.value as LifeAreaSkillType })}
                            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none"
                          >
                            {skillTypeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}

                      <label className="block">
                        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Статус</span>
                        <select
                          value={area.status}
                          onChange={(event) => updateLifeArea(area.id, { status: event.target.value as LifeAreaStatus })}
                          className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none"
                        >
                          {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <textarea
                      value={area.description}
                      onChange={(event) => updateLifeArea(area.id, { description: event.target.value })}
                      placeholder="Описание"
                      className="mt-4 min-h-36 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 text-muted-foreground outline-none placeholder:text-muted-foreground"
                    />

                    <div className="mt-5 space-y-2">
                      {(area.actions ?? []).map((action) => (
                        <div
                          key={action.id}
                          onPointerEnter={() => reorderActionOnEnter(area, action.id)}
                          className={
                            "rounded-lg border border-border bg-background/55 p-3 transition-opacity " +
                            (draggedAction?.actionId === action.id ? "opacity-50" : "")
                          }
                        >
                          <div className="grid gap-2 sm:grid-cols-[40px_minmax(0,1fr)_40px] sm:items-center">
                            <div
                              onPointerDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setDraggedAction({ areaId: area.id, actionId: action.id });
                              }}
                              className="inline-flex h-10 w-10 cursor-grab touch-none select-none items-center justify-center rounded-md border border-border text-muted-foreground active:cursor-grabbing"
                              title="Перетащить действие"
                            >
                              <GripVertical className="h-4 w-4" />
                            </div>
                            <input
                              value={action.title}
                              onChange={(event) => updateAction(area, action.id, { title: event.target.value })}
                              className="min-w-0 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none"
                            />
                            <button
                              onClick={() => removeAction(area, action.id)}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                              aria-label="Удалить действие"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-2 grid gap-2 sm:grid-cols-[160px_140px]">
                            <input
                              type="date"
                              value={action.deadline}
                              onChange={(event) => updateAction(area, action.id, { deadline: event.target.value })}
                              className="h-10 min-w-0 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none"
                            />
                            <button
                              onClick={() =>
                                updateAction(area, action.id, {
                                  status: action.status === "done" ? "active" : "done",
                                })
                              }
                              className={
                                "inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-md border px-3 text-xs transition-colors " +
                                (action.status === "done"
                                  ? "border-[color:oklch(0.4_0.06_160)] bg-[color:oklch(0.3_0.06_160)] text-[color:oklch(0.85_0.1_160)]"
                                  : "border-border text-muted-foreground hover:text-foreground")
                              }
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {action.status === "done" ? "Готово" : "В работе"}
                            </button>
                          </div>

                          <textarea
                            value={action.note}
                            onChange={(event) => updateAction(area, action.id, { note: event.target.value })}
                            placeholder="Комментарий"
                            className="mt-2 min-h-24 min-w-0 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 text-muted-foreground outline-none placeholder:text-muted-foreground"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => addAction(area)}
                        className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-[color:var(--surface-elevated)] hover:text-foreground"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Добавить действие
                      </button>
                      <button
                        onClick={() => removeLifeArea(area.id)}
                        className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Удалить карточку
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-4 text-sm leading-6 text-muted-foreground">{area.description || "Описание не добавлено"}</div>
                    {orderedActions.length ? (
                      <div className="mt-5 space-y-2">
                        {visibleActions.map((action) => {
                          const isExpanded = expandedActionId === action.id;
                          const isDone = action.status === "done";
                          return (
                            <div
                              key={action.id}
                              onPointerEnter={() => reorderActionOnEnter(area, action.id)}
                              className={
                                "rounded-lg border border-border bg-background/55 transition-opacity " +
                                (draggedAction?.actionId === action.id ? "opacity-50" : "")
                              }
                            >
                              <div className="flex items-stretch">
                                <div
                                  onPointerDown={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setDraggedAction({ areaId: area.id, actionId: action.id });
                                  }}
                                  onClick={(event) => event.stopPropagation()}
                                  className="inline-flex w-10 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-[color:var(--surface-elevated)]/60 hover:text-foreground active:cursor-grabbing"
                                  title="Перетащить действие"
                                >
                                  <GripVertical className="h-4 w-4" />
                                </div>
                                <div className="flex min-h-11 flex-1 flex-wrap items-center justify-between gap-2 px-3 py-2 transition-colors hover:bg-[color:var(--surface-elevated)]/60">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedActionId(isExpanded ? null : action.id)}
                                    className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 text-left"
                                  >
                                    <div className="min-w-0 flex-1 text-sm text-foreground">{action.title}</div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <span>{formatDeadline(action.deadline)}</span>
                                      <ChevronDown className={"h-3.5 w-3.5 transition-transform " + (isExpanded ? "rotate-180 text-[color:var(--gold)]" : "")} />
                                    </div>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      toggleActionStatus(area, action.id);
                                    }}
                                    className={
                                      "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors " +
                                      (isDone
                                        ? "border-[color:oklch(0.4_0.06_160)] bg-[color:oklch(0.3_0.06_160)] text-[color:oklch(0.85_0.1_160)]"
                                        : "border-border text-muted-foreground hover:border-[color:var(--gold)]/60 hover:text-[color:var(--gold)]")
                                    }
                                    title={isDone ? "Вернуть в работу" : "Отметить выполненным"}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    {isDone ? "Выполнено" : "В работе"}
                                  </button>
                                </div>
                              </div>
                              {isExpanded ? (
                                <div className="border-t border-border px-3 py-3">
                                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Комментарий</div>
                                  <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                                    {action.note || "Комментарий не добавлен"}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                        {orderedActions.length > 4 ? (
                          <button
                            type="button"
                            onClick={() => toggleActionList(area.id)}
                            className="w-full rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-[color:var(--gold)]/60 hover:text-[color:var(--gold)]"
                          >
                            {isActionListExpanded ? "Свернуть" : `Показать еще ${hiddenActionsCount}`}
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-5 rounded-lg border border-dashed border-border py-5 text-center text-sm text-muted-foreground">
                        Действий пока нет
                      </div>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
