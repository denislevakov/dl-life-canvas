import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type AssetType = "real_estate" | "collection" | "vehicle" | "cash" | "other";
export type AssetStatus = "owned" | "idea" | "planned" | "in_progress" | "purchased";

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  min: number;
  estimated: number;
  max: number;
  status: AssetStatus;
  identity?: boolean;
}

export interface TargetAsset {
  id: string;
  name: string;
  meaning: string;
  horizon: string;
  status: "idea" | "planned" | "in_progress" | "purchased";
  estimatedCost: number;
  saved: number;
  nextStep: string;
}

export interface Expense {
  id: string;
  name: string;
  amount: number;
}

export interface IncomeSource {
  id: string;
  name: string;
  type: string;
  geography: string;
  monthly: number;
  growth: "low" | "medium" | "high";
  selfDependent: boolean;
  countryBound: boolean;
  status: "active" | "planned" | "paused";
  kind: "active" | "passive";
}

export interface LifeStage {
  id: string;
  period: string;
  title: string;
  goals: string[];
  desiredIncome: string;
  targetAssets: string[];
  role: string;
  lifeType: string;
  focus: string;
}

export type ChangeScope = "asset" | "expense" | "target" | "income" | "state";
export type ChangeAction = "add" | "update" | "remove" | "reset";

export interface ChangeEntry {
  id: string;
  ts: number;
  scope: ChangeScope;
  action: ChangeAction;
  entityId?: string;
  entityName?: string;
  field?: string;
  before?: unknown;
  after?: unknown;
}

interface CapitalState {
  assets: Asset[];
  targets: TargetAsset[];
  expenses: Expense[];
  incomeSources: IncomeSource[];
  stages: LifeStage[];
  incomeScenarios: number[];
  currentStageId: string;
  freedomTarget: { min: number; max: number };
  minIncome: number;
  changeLog: ChangeEntry[];
}

const STORAGE_KEY = "life-capital-v5";
const LEGACY_STORAGE_KEYS = ["life-capital-v4", "life-capital-v3"];
const LEGACY_META_KEYS = ["life-capital-v4-migrated-income-budget"];

const defaultState: CapitalState = {
  assets: [
    { id: "a1", name: "Квартира в Санкт-Петербурге", type: "real_estate", min: 10_500_000, estimated: 11_000_000, max: 11_500_000, status: "owned" },
    { id: "a2", name: "Коллекция LEGO", type: "collection", min: 1_200_000, estimated: 1_350_000, max: 1_500_000, status: "owned", identity: true },
    { id: "a3", name: "Коллекция видеоигр для PlayStation", type: "collection", min: 400_000, estimated: 450_000, max: 500_000, status: "owned", identity: true },
    { id: "a4", name: "Коллекция Funko POP", type: "collection", min: 400_000, estimated: 450_000, max: 500_000, status: "owned", identity: true },
  ],
  targets: [
    { id: "t1", name: "Квартира для семьи в Москве", meaning: "Основное жильё для моей семьи. 100+ квадратных метров красивого свежего пространства с кабинетом для работы над моими проектами.", horizon: "37–40", status: "planned", estimatedCost: 35_000_000, saved: 0, nextStep: "Сформировать первый взнос и определить район" },
    { id: "t2", name: "Дом для семьи на природе", meaning: "Два этажа аскетичности из природных материалов с баскетбольной площадкой и гаражом в нескольких часах езды от Москвы. В доме есть пространство для хранения всех моих коллекций, а также комната для ретрогейминга и медитации с LEGO.", horizon: "40–50", status: "idea", estimatedCost: 35_000_000, saved: 0, nextStep: "Определить требования к локации и площади" },
    { id: "t3", name: "Дом во Флориде", meaning: "Место, чтобы провести старость и забыть о существовании зимы.", horizon: "50+", status: "idea", estimatedCost: 30_000_000, saved: 0, nextStep: "Исследовать рынок southwest Florida" },
    { id: "t4", name: "Квартира в СПб", meaning: "Уже существующий актив — точка опоры.", horizon: "сейчас", status: "purchased", estimatedCost: 11_000_000, saved: 11_000_000, nextStep: "Поддерживать состояние" },
  ],
  expenses: [
    { id: "e1", name: "Аренда квартиры", amount: 80_000 },
    { id: "e2", name: "Квартплата СПб", amount: 20_000 },
    { id: "e3", name: "Питание дома и рестораны", amount: 80_000 },
    { id: "e4", name: "Мобильный телефон", amount: 1_000 },
    { id: "e5", name: "Интернет", amount: 500 },
    { id: "e6", name: "Стрижка", amount: 4_000 },
    { id: "e7", name: "Комиссии, карты, подписки", amount: 1_500 },
    { id: "e8", name: "Мама", amount: 10_000 },
    { id: "e9", name: "Склад", amount: 4_700 },
    { id: "e10", name: "Фитнес", amount: 2_300 },
    { id: "e11", name: "Клининг", amount: 7_000 },
  ],
  incomeSources: [],
  stages: [
    {
      id: "s1",
      period: "37–40",
      title: "Создание фундамента",
      goals: [
        "Создать проекты с доходом 500k–1M ₽/мес",
        "Создать источники дохода вне привязки к стране",
        "Приобрести новый авто",
        "Квартира для семьи в Москве",
      ],
      desiredIncome: "500 000 – 1 000 000 ₽",
      targetAssets: ["Авто", "Квартира для семьи в Москве"],
      role: "Основатель проектов",
      lifeType: "Сфокусированный, рабочий, накопительный",
      focus: "Создание фундамента",
    },
    {
      id: "s2",
      period: "40–50",
      title: "Бизнес и семья",
      goals: [
        "Построить стабильный бизнес или войти в долю",
        "Доход 1M–2M ₽/мес",
        "Масштабировать дополнительные источники дохода",
        "Дом для семьи на природе",
        "Дом во Флориде",
      ],
      desiredIncome: "1 000 000 – 2 000 000 ₽",
      targetAssets: ["Дом для семьи на природе", "Дом во Флориде"],
      role: "Владелец / партнёр в бизнесе",
      lifeType: "Семья, бизнес, международная мобильность",
      focus: "Капитал и недвижимость за рубежом",
    },
    {
      id: "s3",
      period: "50+",
      title: "Свобода и наследие",
      goals: [
        "Выйти из операционной деятельности",
        "Жить на пассивный доход: инвестиции, доли, аренда",
        "Делать творческие проекты",
        "Не знать зимы",
      ],
      desiredIncome: "Пассивный 1.5M+ ₽",
      targetAssets: ["Дом во Флориде", "Дом для семьи на природе"],
      role: "Инвестор, наблюдатель, автор",
      lifeType: "Свободный, между странами, творческий",
      focus: "Наследие и качество жизни",
    },
  ],
  incomeScenarios: [400_000, 500_000, 1_000_000, 2_000_000],
  currentStageId: "s1",
  freedomTarget: { min: 1_000_000, max: 2_000_000 },
  minIncome: 400_000,
  changeLog: [],
};

const readStoredCapitalState = (key: string): Partial<CapitalState> | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<CapitalState>) : null;
  } catch {
    return null;
  }
};

interface Ctx {
  state: CapitalState;
  update: (patch: Partial<CapitalState>) => void;
  updateAsset: (id: string, patch: Partial<Asset>) => void;
  addAsset: (a: Asset) => void;
  removeAsset: (id: string) => void;
  updateExpense: (id: string, patch: Partial<Expense>) => void;
  addExpense: (e: Expense) => void;
  removeExpense: (id: string) => void;
  updateTarget: (id: string, patch: Partial<TargetAsset>) => void;
  addIncome: (s: IncomeSource) => void;
  updateIncome: (id: string, patch: Partial<IncomeSource>) => void;
  removeIncome: (id: string) => void;
  reset: () => void;
  clearChangeLog: () => void;
  totals: {
    minCapital: number;
    estimatedCapital: number;
    maxCapital: number;
    monthlyMinimum: number;
    minIncome: number;
    activeIncome: number;
    passiveIncome: number;
  };
}

const CapitalContext = createContext<Ctx | null>(null);

export function CapitalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CapitalState>(defaultState);

  // Load saved state once on mount (client only). Older storage keys are
  // intentionally ignored so stale published values cannot override the
  // current defaults after a deploy.
  useEffect(() => {
    try {
      let saved = readStoredCapitalState(STORAGE_KEY);
      let migratedFromLegacy = false;

      // One-time migration: if there's no v5 save yet, pull the user's
      // previous data from the most recent legacy key so values entered in
      // older deploys (incomes, expenses, assets, etc.) are preserved.
      if (!saved) {
        for (const legacyKey of LEGACY_STORAGE_KEYS) {
          const legacy = readStoredCapitalState(legacyKey);
          if (legacy && Object.keys(legacy).length > 0) {
            saved = legacy;
            migratedFromLegacy = true;
            break;
          }
        }
      }

      if (saved) {
        setState((cur) => {
          // If the user already mutated state before this load effect fired,
          // prefer current in-memory state to avoid clobbering unsaved edits.
          const isPristine = JSON.stringify(cur) === JSON.stringify(defaultState);
          if (!isPristine) return cur;

          const merged = { ...defaultState, ...saved } as CapitalState;
          // Guard numeric scalars: stale saves may store null/0/undefined which
          // would visibly wipe the default after hydration.
          if (typeof merged.minIncome !== "number" || !isFinite(merged.minIncome) || merged.minIncome <= 0) {
            merged.minIncome = defaultState.minIncome;
          }

          // Persist the merged state into the current storage key so future
          // loads are stable and we don't have to re-run migration.
          try {
            if (typeof window !== "undefined") {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
              if (migratedFromLegacy) {
                LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
                LEGACY_META_KEYS.forEach((key) => localStorage.removeItem(key));
              }
            }
          } catch {}

          return merged;
        });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper that updates React state AND writes localStorage in one shot,
  // using the freshly computed next state so we never persist a stale value.
  const commit = (updater: (s: CapitalState) => CapitalState) => {
    setState((s) => {
      const next = updater(s);
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
      } catch {}
      return next;
    });
  };

  const MAX_LOG = 200;
  const pushLog = (s: CapitalState, entries: Omit<ChangeEntry, "id" | "ts">[]): CapitalState => {
    if (!entries.length) return s;
    const now = Date.now();
    const fresh: ChangeEntry[] = entries.map((e, idx) => ({
      ...e,
      id: `c${now}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
      ts: now,
    }));
    const log = [...fresh, ...(s.changeLog ?? [])].slice(0, MAX_LOG);
    return { ...s, changeLog: log };
  };

  const diffPatch = <T extends Record<string, unknown>>(
    before: T,
    patch: Partial<T>,
  ): { field: string; before: unknown; after: unknown }[] => {
    const out: { field: string; before: unknown; after: unknown }[] = [];
    for (const k of Object.keys(patch)) {
      const b = (before as Record<string, unknown>)[k];
      const a = (patch as Record<string, unknown>)[k];
      if (JSON.stringify(b) !== JSON.stringify(a)) out.push({ field: k, before: b, after: a });
    }
    return out;
  };

  const update = (patch: Partial<CapitalState>) =>
    commit((s) => {
      const entries: Omit<ChangeEntry, "id" | "ts">[] = Object.keys(patch)
        .filter((k) => k !== "changeLog")
        .map((k) => ({
          scope: "state" as const,
          action: "update" as const,
          field: k,
          before: (s as unknown as Record<string, unknown>)[k],
          after: (patch as unknown as Record<string, unknown>)[k],
        }));
      return pushLog({ ...s, ...patch }, entries);
    });

  const updateAsset = (id: string, patch: Partial<Asset>) =>
    commit((s) => {
      const cur = s.assets.find((a) => a.id === id);
      if (!cur) return s;
      const diffs = diffPatch(cur as unknown as Record<string, unknown>, patch as Partial<Record<string, unknown>>);
      const next = { ...s, assets: s.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)) };
      return pushLog(next, diffs.map((d) => ({ scope: "asset", action: "update", entityId: id, entityName: cur.name, ...d })));
    });
  const addAsset = (a: Asset) =>
    commit((s) => pushLog({ ...s, assets: [...s.assets, a] }, [{ scope: "asset", action: "add", entityId: a.id, entityName: a.name }]));
  const removeAsset = (id: string) =>
    commit((s) => {
      const cur = s.assets.find((a) => a.id === id);
      return pushLog({ ...s, assets: s.assets.filter((a) => a.id !== id) }, [{ scope: "asset", action: "remove", entityId: id, entityName: cur?.name }]);
    });

  const updateExpense = (id: string, patch: Partial<Expense>) =>
    commit((s) => {
      const cur = s.expenses.find((e) => e.id === id);
      if (!cur) return s;
      const diffs = diffPatch(cur as unknown as Record<string, unknown>, patch as Partial<Record<string, unknown>>);
      const next = { ...s, expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)) };
      return pushLog(next, diffs.map((d) => ({ scope: "expense", action: "update", entityId: id, entityName: cur.name, ...d })));
    });
  const addExpense = (e: Expense) =>
    commit((s) => pushLog({ ...s, expenses: [...s.expenses, e] }, [{ scope: "expense", action: "add", entityId: e.id, entityName: e.name }]));
  const removeExpense = (id: string) =>
    commit((s) => {
      const cur = s.expenses.find((e) => e.id === id);
      return pushLog({ ...s, expenses: s.expenses.filter((e) => e.id !== id) }, [{ scope: "expense", action: "remove", entityId: id, entityName: cur?.name }]);
    });

  const updateTarget = (id: string, patch: Partial<TargetAsset>) =>
    commit((s) => {
      const cur = s.targets.find((t) => t.id === id);
      if (!cur) return s;
      const diffs = diffPatch(cur as unknown as Record<string, unknown>, patch as Partial<Record<string, unknown>>);
      const next = { ...s, targets: s.targets.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
      return pushLog(next, diffs.map((d) => ({ scope: "target", action: "update", entityId: id, entityName: cur.name, ...d })));
    });

  const addIncome = (src: IncomeSource) =>
    commit((s) => pushLog({ ...s, incomeSources: [...s.incomeSources, src] }, [{ scope: "income", action: "add", entityId: src.id, entityName: src.name }]));
  const updateIncome = (id: string, patch: Partial<IncomeSource>) =>
    commit((s) => {
      const cur = s.incomeSources.find((i) => i.id === id);
      if (!cur) return s;
      const diffs = diffPatch(cur as unknown as Record<string, unknown>, patch as Partial<Record<string, unknown>>);
      const next = { ...s, incomeSources: s.incomeSources.map((i) => (i.id === id ? { ...i, ...patch } : i)) };
      return pushLog(next, diffs.map((d) => ({ scope: "income", action: "update", entityId: id, entityName: cur.name, ...d })));
    });
  const removeIncome = (id: string) =>
    commit((s) => {
      const cur = s.incomeSources.find((i) => i.id === id);
      return pushLog({ ...s, incomeSources: s.incomeSources.filter((i) => i.id !== id) }, [{ scope: "income", action: "remove", entityId: id, entityName: cur?.name }]);
    });

  const clearChangeLog = () => commit((s) => ({ ...s, changeLog: [] }));

  const reset = () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
      LEGACY_META_KEYS.forEach((key) => localStorage.removeItem(key));
      }
    } catch {}
    setState(defaultState);
  };

  const minCapital = state.assets.reduce((s, a) => s + a.min, 0);
  const estimatedCapital = state.assets.reduce((s, a) => s + a.estimated, 0);
  const maxCapital = state.assets.reduce((s, a) => s + a.max, 0);
  const monthlyMinimum = state.expenses.reduce((s, e) => s + e.amount, 0);
  const minIncome = state.minIncome;
  const activeIncome = state.incomeSources.filter((i) => i.status === "active" && i.kind === "active").reduce((s, i) => s + i.monthly, 0);
  const passiveIncome = state.incomeSources.filter((i) => i.status === "active" && i.kind === "passive").reduce((s, i) => s + i.monthly, 0);

  return (
    <CapitalContext.Provider
      value={{
        state,
        update,
        updateAsset,
        addAsset,
        removeAsset,
        updateExpense,
        addExpense,
        removeExpense,
        updateTarget,
        addIncome,
        updateIncome,
        removeIncome,
        reset,
        clearChangeLog,
        totals: { minCapital, estimatedCapital, maxCapital, monthlyMinimum, minIncome, activeIncome, passiveIncome },
      }}
    >
      {children}
    </CapitalContext.Provider>
  );
}

export function useCapital() {
  const ctx = useContext(CapitalContext);
  if (!ctx) throw new Error("useCapital must be used inside CapitalProvider");
  return ctx;
}