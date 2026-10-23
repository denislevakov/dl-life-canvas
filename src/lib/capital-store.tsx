import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth";
import { cloudValuesEqual, mergeCloudState } from "@/lib/cloud-state-sync";
import {
  createFinanceAssistantRule,
  type FinanceAssistantRule,
} from "@/lib/finance-categorization";
import { localMonthKey } from "@/lib/local-date";
import { supabase } from "@/lib/supabase";

export type { FinanceAssistantRule } from "@/lib/finance-categorization";

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

export type LifeGoalStatus = "active" | "done" | "backlog";

export interface LifeGoal {
  id: string;
  title: string;
  period: string;
  deadline: string;
  progress: number;
  status: LifeGoalStatus;
  budget: number;
  note: string;
}

export type LifeAreaKind = "project" | "skill" | "hobby" | "health";
export type LifeAreaStatus = "active" | "done" | "backlog";
export type LifeAreaSkillType = "hard" | "soft";

export interface LifeAreaAction {
  id: string;
  title: string;
  deadline: string;
  status: "active" | "done";
  note: string;
}

export interface LifeArea {
  id: string;
  kind: LifeAreaKind;
  skillType?: LifeAreaSkillType;
  title: string;
  description: string;
  horizon: string;
  status: LifeAreaStatus;
  actions: LifeAreaAction[];
}

export interface Expense {
  id: string;
  name: string;
  amount: number;
}

export type CashAccountKind = "card" | "cash" | "safety";

export interface CashAccount {
  id: string;
  name: string;
  kind: CashAccountKind;
  balance: number;
}

export interface TransactionCategory {
  id: string;
  name: string;
}

export type MoneyTransactionType = "income" | "expense";
export type MoneyTransactionSource = "manual" | "pdf";

export interface MoneyTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: MoneyTransactionType;
  categoryId: string;
  accountId?: string;
  source: MoneyTransactionSource;
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

export type ChangeScope = "asset" | "expense" | "target" | "life_goal" | "life_area" | "cash_account" | "transaction" | "transaction_category" | "income" | "state";
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
  routineChecks?: Record<string, Record<string, boolean>>;
  cashBaselineVersion?: string;
  cardCashExpenseBaseline?: number;
  cardCashExpenseBaselineMonth?: string;
  cardCashExpenseBaselineVersion?: string;
  assets: Asset[];
  targets: TargetAsset[];
  lifeGoals: LifeGoal[];
  lifeAreas: LifeArea[];
  expenses: Expense[];
  cashAccounts: CashAccount[];
  transactionCategories: TransactionCategory[];
  transactions: MoneyTransaction[];
  financeAssistantRules: FinanceAssistantRule[];
  incomeSources: IncomeSource[];
  stages: LifeStage[];
  incomeScenarios: number[];
  currentStageId: string;
  freedomTarget: { min: number; max: number };
  minIncome: number;
  minExpense: number;
  changeLog: ChangeEntry[];
}

// IMPORTANT: do NOT bump STORAGE_KEY on future deploys — bumping it
// abandons the user's data. If the shape changes, add a migration inside
// the load effect instead. New legacy keys go into LEGACY_STORAGE_KEYS
// only when we truly need to retire a key.
const STORAGE_KEY = "life-capital-v5";
const CLOUD_BASE_KEY = `${STORAGE_KEY}-cloud-base`;
const CLOUD_SAVE_DELAY_MS = 300;
const CLOUD_REFRESH_INTERVAL_MS = 15_000;
const MAX_CHANGE_LOG = 200;
const LEGACY_STORAGE_KEYS = ["life-capital-v4", "life-capital-v3"];
const LEGACY_META_KEYS = ["life-capital-v4-migrated-income-budget"];

// Forced reset token. Bump this string ONLY when you want every user's
// local storage to be wiped on next load (e.g. after a data-shape change
// or to clear stale demo values). After the wipe, the user's subsequent
// edits persist normally — the token is stored alongside the data and
// only triggers another reset if it changes again.
const RESET_TOKEN = "2026-07-03-full-restore-from-id4";
const RESET_TOKEN_KEY = "life-capital-reset-token";
const CASH_BASELINE_VERSION = "2026-07-12-balance-baseline-38000-650000";
const CARD_CASH_EXPENSE_BASELINE_VERSION = "2026-07-13-card-cash-current-after-existing-expenses";
const CARD_CASH_BASELINE = 38_000;
const SAFETY_BASELINE = 650_000;

// Target copy update token. Bump this to push new default names/descriptions
// into saved data without wiping user-entered numbers.
const DESC_VERSION = "v9-stage-income-ranges";
const LIFE_AREAS_VERSION = "v2-test-overview";

const defaultExpenses: Expense[] = [
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
];

export const REVIEW_CATEGORY_ID = "cat_review";
const REVIEW_CATEGORY_NAME = "Нужно распределить";

const transactionCategoryIdForExpense = (expenseId: string) => `cat_expense_${expenseId}`;
const isIncomeCategoryId = (categoryId: string) => categoryId.startsWith("cat_income_");
const defaultIncomeTransactionCategories: TransactionCategory[] = [
  { id: "cat_income_cult", name: "CULT" },
  { id: "cat_income_misc", name: "Всяко-разно" },
];

const transactionCategoriesForExpenses = (expenses: Expense[], incomeCategories = defaultIncomeTransactionCategories): TransactionCategory[] => [
  ...expenses.map((expense) => ({ id: transactionCategoryIdForExpense(expense.id), name: expense.name })),
  ...incomeCategories,
  { id: REVIEW_CATEGORY_ID, name: REVIEW_CATEGORY_NAME },
];

const defaultTransactionCategories = transactionCategoriesForExpenses(defaultExpenses);

const legacyTransactionCategoryIds = [
  "cat_food",
  "cat_home",
  "cat_transport",
  "cat_health",
  "cat_family",
  "cat_subscriptions",
  "cat_travel",
  "cat_income",
  "cat_other",
];

const legacyTransactionCategoryMap: Record<string, string> = {
  cat_food: transactionCategoryIdForExpense("e3"),
  cat_home: REVIEW_CATEGORY_ID,
  cat_transport: REVIEW_CATEGORY_ID,
  cat_health: REVIEW_CATEGORY_ID,
  cat_family: transactionCategoryIdForExpense("e8"),
  cat_subscriptions: transactionCategoryIdForExpense("e7"),
  cat_travel: REVIEW_CATEGORY_ID,
  cat_income: "cat_income_misc",
  cat_other: REVIEW_CATEGORY_ID,
};

const normalizeCategoryName = (name: string) => name.trim().toLowerCase();

const syncTransactionCategoriesWithExpenses = (state: CapitalState): CapitalState => {
  const categories = state.transactionCategories ?? [];
  const savedIncomeCategories = categories.filter((category) => isIncomeCategoryId(category.id));
  const nextCategories = transactionCategoriesForExpenses(
    state.expenses ?? [], savedIncomeCategories.length ? savedIncomeCategories : defaultIncomeTransactionCategories);
  const nextIds = new Set(nextCategories.map((category) => category.id));
  const remap: Record<string, string> = { ...legacyTransactionCategoryMap };

  categories.forEach((category) => {
    const categoryId = category.id;
    if (nextIds.has(categoryId) || remap[categoryId]) return;
    const match = nextCategories.find((nextCategory) => normalizeCategoryName(nextCategory.name) === normalizeCategoryName(category.name));
    if (match) remap[categoryId] = match.id;
  });

  return {
    ...state,
    transactionCategories: nextCategories,
    transactions: (state.transactions ?? []).map((transaction) => {
      const categoryId = remap[transaction.categoryId] ?? (nextIds.has(transaction.categoryId) ? transaction.categoryId : REVIEW_CATEGORY_ID);
      return categoryId === transaction.categoryId ? transaction : { ...transaction, categoryId };
    }),
    financeAssistantRules: (state.financeAssistantRules ?? [])
      .map((rule) => ({ ...rule, categoryId: remap[rule.categoryId] ?? rule.categoryId }))
      .filter((rule) => nextIds.has(rule.categoryId)),
  };
};

const normalizeTransactionDescription = (description: string) =>
  description
    .toLowerCase()
    .replace(/[ё]/g, "е")
    .replace(/[^a-zа-я0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const transactionAmountKey = (amount: number) => String(Math.round(Math.abs(amount) * 100));
const transactionExactKey = (transaction: MoneyTransaction) =>
  [
    transaction.date,
    transaction.type,
    transactionAmountKey(transaction.amount),
    normalizeTransactionDescription(transaction.description),
  ].join("|");
const transactionLooseKey = (transaction: MoneyTransaction) =>
  [transaction.date, transaction.type, transactionAmountKey(transaction.amount)].join("|");

const isReviewTransaction = (transaction: MoneyTransaction) => transaction.categoryId === REVIEW_CATEGORY_ID;

const preferTransaction = (current: MoneyTransaction, candidate: MoneyTransaction) => {
  if (isReviewTransaction(current) && !isReviewTransaction(candidate)) return candidate;
  if (current.source === "pdf" && candidate.source === "manual") return candidate;
  return current;
};

const descriptionsLikelyMatch = (a: MoneyTransaction, b: MoneyTransaction) => {
  const left = normalizeTransactionDescription(a.description);
  const right = normalizeTransactionDescription(b.description);
  if (!left || !right) return true;
  if (left === right) return true;
  return left.includes(right) || right.includes(left);
};

const dedupeTransactions = (transactions: MoneyTransaction[]) => {
  const byExact = new Map<string, MoneyTransaction>();
  transactions.forEach((transaction) => {
    const key = transactionExactKey(transaction);
    const existing = byExact.get(key);
    byExact.set(key, existing ? preferTransaction(existing, transaction) : transaction);
  });
  return Array.from(byExact.values());
};
const DESC_VERSION_KEY = "life-capital-desc-version";
const LIFE_AREAS_VERSION_KEY = "life-capital-life-areas-version";

const defaultState: CapitalState = {
  cashBaselineVersion: CASH_BASELINE_VERSION,
  cardCashExpenseBaseline: 0,
  cardCashExpenseBaselineVersion: CARD_CASH_EXPENSE_BASELINE_VERSION,
  assets: [
    { id: "a1", name: "Квартира в Санкт-Петербурге", type: "real_estate", min: 10_500_000, estimated: 11_000_000, max: 11_500_000, status: "owned" },
    { id: "a2", name: "Коллекция LEGO", type: "collection", min: 1_200_000, estimated: 1_350_000, max: 1_500_000, status: "owned", identity: true },
    { id: "a3", name: "Коллекция видеоигр для PlayStation", type: "collection", min: 400_000, estimated: 450_000, max: 500_000, status: "owned", identity: true },
    { id: "a4", name: "Коллекция Funko POP", type: "collection", min: 400_000, estimated: 450_000, max: 500_000, status: "owned", identity: true },
  ],
  targets: [
    { id: "t1", name: "Квартира в Москве", meaning: "Основное жильё для моей семьи, расположенное в благостном районе Москвы. 100+ квадратных метров красивого свежего пространства с кабинетом для работы над моими проектами и домашним кинотеатром для кино и видеоигр. И обязательно с подземной парковой.", horizon: "37–40", status: "planned", estimatedCost: 35_000_000, saved: 0, nextStep: "Сформировать первый взнос и определить район" },
    { id: "t2", name: "Дом на природе", meaning: "Два этажа аскетичности из природных материалов с баскетбольной площадкой и гаражом в нескольких часах езды от Москвы. В доме есть библиотека, пространство для хранения всех моих коллекций, а также комната для ретрогейминга и медитации с LEGO.", horizon: "40–50", status: "idea", estimatedCost: 35_000_000, saved: 0, nextStep: "Определить требования к локации и площади" },
    { id: "t3", name: "Дом во Флориде", meaning: "Место, чтобы провести старость и забыть о существовании зимы.", horizon: "50+", status: "idea", estimatedCost: 30_000_000, saved: 0, nextStep: "Исследовать рынок southwest Florida" },
    { id: "t4", name: "Квартира в Питере", meaning: "Точка опоры.", horizon: "сейчас", status: "purchased", estimatedCost: 11_000_000, saved: 11_000_000, nextStep: "Поддерживать состояние" },
  ],
  lifeGoals: [
    {
      id: "g1",
      title: "Купить робот-пылесос",
      period: "2026",
      deadline: "2026-03-31",
      progress: 25,
      status: "active",
      budget: 35_000,
      note: "Выбрать модель и дождаться хорошей цены",
    },
    {
      id: "g2",
      title: "Съездить в Казахстан",
      period: "2026",
      deadline: "2026-08-31",
      progress: 10,
      status: "active",
      budget: 180_000,
      note: "Определить города, даты и маршрут",
    },
    {
      id: "g3",
      title: "Переехать в новую квартиру",
      period: "2026",
      deadline: "2026-12-31",
      progress: 15,
      status: "active",
      budget: 250_000,
      note: "Сформировать требования к району и бюджету",
    },
    {
      id: "g4",
      title: "Собрать идеи для следующих целей",
      period: "",
      deadline: "",
      progress: 0,
      status: "backlog",
      budget: 0,
      note: "",
    },
  ],
  lifeAreas: [
    {
      id: "la_project_1",
      kind: "project",
      title: "DL Life Canvas",
      description: "Личный дашборд жизни: цели, капитал, расходы, привычки и следующие шаги.",
      horizon: "июль 2026",
      status: "active",
      actions: [
        { id: "laa_project_1_1", title: "Довести блок доходов и расходов", deadline: "2026-07-15", status: "active", note: "" },
        { id: "laa_project_1_2", title: "Собрать обзор из проектов, целей и личных блоков", deadline: "2026-07-06", status: "active", note: "" },
        { id: "laa_project_1_3", title: "Задеплоить стабильную версию на сервер", deadline: "2026-07-07", status: "active", note: "" },
      ],
    },
    {
      id: "la_project_2",
      kind: "project",
      title: "CULT AI production system",
      description: "Система для упаковки AI-подходов, продакшн-логики и рабочих процессов CULT.",
      horizon: "2026",
      status: "backlog",
      actions: [{ id: "laa_project_2_1", title: "Собрать список модулей", deadline: "", status: "active", note: "" }],
    },
    {
      id: "la_project_3",
      kind: "project",
      title: "Новый сайт для второго домена",
      description: "Подготовить структуру, репозиторий и будущий деплой на этот же VPS.",
      horizon: "июль-август 2026",
      status: "active",
      actions: [
        { id: "laa_project_3_1", title: "Определить домен и назначение сайта", deadline: "2026-07-20", status: "active", note: "" },
        { id: "laa_project_3_2", title: "Создать репозиторий и базовый проект", deadline: "2026-07-25", status: "active", note: "" },
      ],
    },
    {
      id: "la_skill_1",
      kind: "skill",
      skillType: "hard",
      title: "AI / вайбкодинг",
      description: "Быстро собирать рабочие продукты, проверять гипотезы и доводить их до деплоя.",
      horizon: "2026",
      status: "active",
      actions: [{ id: "laa_skill_1_1", title: "Собрать личный стек шаблонов", deadline: "2026-08-31", status: "active", note: "" }],
    },
    {
      id: "la_skill_2",
      kind: "skill",
      skillType: "soft",
      title: "Системное мышление",
      description: "Лучше раскладывать задачи, решения, риски и следующий шаг.",
      horizon: "постоянно",
      status: "active",
      actions: [{ id: "laa_skill_2_1", title: "Раз в неделю фиксировать выводы по проектам", deadline: "", status: "active", note: "" }],
    },
    {
      id: "la_skill_3",
      kind: "skill",
      skillType: "hard",
      title: "DevOps база",
      description: "Понимать домены, серверы, SSL, Docker, деплой и диагностику без паники.",
      horizon: "2026",
      status: "active",
      actions: [{ id: "laa_skill_3_1", title: "Собрать личную памятку по деплою", deadline: "2026-07-31", status: "active", note: "" }],
    },
    {
      id: "la_hobby_1",
      kind: "hobby",
      title: "Коллекционирование LEGO",
      description: "Развивать коллекцию, хранение, учет наборов и планы покупок.",
      horizon: "2026",
      status: "active",
      actions: [
        { id: "laa_hobby_1_1", title: "Собрать список желаемых наборов", deadline: "", status: "active", note: "" },
        { id: "laa_hobby_1_2", title: "Разобрать хранение и учет коллекции", deadline: "2026-08-15", status: "active", note: "" },
      ],
    },
    {
      id: "la_hobby_2",
      kind: "hobby",
      title: "Ретрогейминг",
      description: "Собрать спокойный список игр, консолей и покупок без хаоса.",
      horizon: "2026",
      status: "backlog",
      actions: [{ id: "laa_hobby_2_1", title: "Составить короткий wishlist", deadline: "", status: "active", note: "" }],
    },
    {
      id: "la_health_1",
      kind: "health",
      title: "Базовая форма",
      description: "Сон, движение, питание и регулярность без лишнего микроменеджмента.",
      horizon: "2026",
      status: "active",
      actions: [
        { id: "laa_health_1_1", title: "Определить простой недельный режим", deadline: "", status: "active", note: "" },
        { id: "laa_health_1_2", title: "Вернуть регулярные тренировки", deadline: "2026-07-21", status: "active", note: "" },
      ],
    },
    {
      id: "la_health_2",
      kind: "health",
      title: "Чекапы",
      description: "Плановые проверки здоровья, стоматология и базовые анализы.",
      horizon: "осень 2026",
      status: "backlog",
      actions: [{ id: "laa_health_2_1", title: "Собрать список врачей и анализов", deadline: "", status: "active", note: "" }],
    },
  ],
  expenses: defaultExpenses,
  cashAccounts: [
    { id: "ca1", name: "Карта / наличные", kind: "card", balance: 38_000 },
    { id: "ca3", name: "Подушка безопасности", kind: "safety", balance: 650_000 },
  ],
  transactionCategories: defaultTransactionCategories,
  transactions: [],
  financeAssistantRules: [],
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
        "Квартира в Москве",
      ],
      desiredIncome: "500 000 – 1 000 000 ₽",
      targetAssets: ["Авто", "Квартира в Москве"],
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
        "Доход 1,5M–2,5M ₽/мес",
        "Масштабировать дополнительные источники дохода",
        "Дом на природе",
        "Дом во Флориде",
      ],
      desiredIncome: "1 500 000 – 2 500 000 ₽",
      targetAssets: ["Дом на природе", "Дом во Флориде"],
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
      desiredIncome: "2 500 000 ₽ и выше",
      targetAssets: ["Дом во Флориде", "Дом на природе"],
      role: "Инвестор, наблюдатель, автор",
      lifeType: "Свободный, между странами, творческий",
      focus: "Наследие и качество жизни",
    },
  ],
  incomeScenarios: [400_000, 500_000, 1_000_000, 2_000_000],
  currentStageId: "s1",
  freedomTarget: { min: 1_000_000, max: 2_000_000 },
  minIncome: 400_000,
  minExpense: defaultExpenses.reduce((sum, expense) => sum + expense.amount, 0),
  changeLog: [],
};

const arrayStateKeys = [
  "assets",
  "targets",
  "lifeGoals",
  "lifeAreas",
  "expenses",
  "cashAccounts",
  "transactionCategories",
  "transactions",
  "financeAssistantRules",
  "incomeSources",
  "stages",
  "incomeScenarios",
  "changeLog",
] as const;

const applyCashBaseline = (state: CapitalState): CapitalState => {
  const sourceAccounts = Array.isArray(state.cashAccounts) ? state.cashAccounts : [];
  let accounts = [...sourceAccounts];

  const primaryCardCashIndex = accounts.findIndex((account) => account.kind === "card" || account.kind === "cash");

  if (primaryCardCashIndex >= 0) {
    accounts = accounts.map((account, index) => {
      if (index === primaryCardCashIndex) {
        return { ...account, name: "Карта / наличные", kind: "card", balance: CARD_CASH_BASELINE };
      }
      if (account.kind === "card" || account.kind === "cash") return { ...account, balance: 0 };
      return account;
    });
  } else {
    accounts = [{ id: "ca1", name: "Карта / наличные", kind: "card", balance: CARD_CASH_BASELINE }, ...accounts];
  }

  const primarySafetyIndex = accounts.findIndex((account) => account.kind === "safety");
  if (primarySafetyIndex >= 0) {
    accounts = accounts.map((account, index) => {
      if (index === primarySafetyIndex) return { ...account, name: "Подушка безопасности", kind: "safety", balance: SAFETY_BASELINE };
      if (account.kind === "safety") return { ...account, balance: 0 };
      return account;
    });
  } else {
    accounts = [...accounts, { id: "ca3", name: "Подушка безопасности", kind: "safety", balance: SAFETY_BASELINE }];
  }

  return { ...state, cashAccounts: accounts, cashBaselineVersion: CASH_BASELINE_VERSION };
};

const expenseTotalForMonth = (state: Pick<CapitalState, "transactions">, monthKey: string) => {
  return (state.transactions ?? [])
    .filter((transaction) => transaction.date.startsWith(monthKey) && transaction.type === "expense")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
};

const applyCardCashExpenseBaseline = (state: CapitalState): CapitalState => ({
  ...state,
  cardCashExpenseBaseline: expenseTotalForMonth(state, localMonthKey()),
  cardCashExpenseBaselineMonth: localMonthKey(),
  cardCashExpenseBaselineVersion: CARD_CASH_EXPENSE_BASELINE_VERSION,
});

const closePreviousExpenseMonth = (state: CapitalState, nextMonthKey: string): CapitalState => {
  const baselineMonth = state.cardCashExpenseBaselineMonth;
  if (!baselineMonth) return { ...state, cardCashExpenseBaselineMonth: nextMonthKey };
  if (baselineMonth === nextMonthKey) return state;

  const expenseTotal = expenseTotalForMonth(state, baselineMonth);
  const baseline = Math.max(0, state.cardCashExpenseBaseline ?? 0);
  const expenseDelta = Math.max(0, expenseTotal - baseline);
  let deltaLeft = expenseDelta;

  const cashAccounts = (state.cashAccounts ?? []).map((account) => {
    if (deltaLeft <= 0 || (account.kind !== "card" && account.kind !== "cash")) return account;
    const nextBalance = account.balance - deltaLeft;
    deltaLeft = 0;
    return { ...account, balance: Math.round(nextBalance * 100) / 100 };
  });

  return {
    ...state,
    cashAccounts,
    cardCashExpenseBaseline: 0,
    cardCashExpenseBaselineMonth: nextMonthKey,
  };
};

const normalizeCapitalState = (saved: Partial<CapitalState> | null | undefined): CapitalState => {
  const shouldApplyCashBaseline = saved?.cashBaselineVersion !== CASH_BASELINE_VERSION;
  const shouldApplyCardCashExpenseBaseline = saved?.cardCashExpenseBaselineVersion !== CARD_CASH_EXPENSE_BASELINE_VERSION;
  let merged = { ...defaultState, ...(saved ?? {}) } as CapitalState;

  for (const key of arrayStateKeys) {
    if (!Array.isArray(merged[key])) {
      merged = { ...merged, [key]: defaultState[key] };
    }
  }

  if (typeof saved?.cardCashExpenseBaselineMonth !== "string") {
    const currentMonth = localMonthKey();
    const latestTransactionMonth = (merged.transactions ?? [])
      .map((transaction) => transaction.date.slice(0, 7))
      .filter((monthKey) => /^\d{4}-\d{2}$/.test(monthKey) && monthKey <= currentMonth)
      .sort((a, b) => b.localeCompare(a))[0];
    merged.cardCashExpenseBaselineMonth = latestTransactionMonth ?? currentMonth;
  }

  if (typeof merged.minIncome !== "number" || !isFinite(merged.minIncome) || merged.minIncome <= 0) {
    merged.minIncome = defaultState.minIncome;
  }
  if (typeof merged.minExpense !== "number" || !isFinite(merged.minExpense) || merged.minExpense < 0) {
    const legacyExpenseTotal = (merged.expenses ?? []).reduce((sum, expense) => sum + (typeof expense.amount === "number" ? expense.amount : 0), 0);
    merged.minExpense = legacyExpenseTotal || defaultState.minExpense;
  }
  if (!merged.freedomTarget || typeof merged.freedomTarget.min !== "number" || typeof merged.freedomTarget.max !== "number") {
    merged.freedomTarget = defaultState.freedomTarget;
  }
  if (typeof merged.currentStageId !== "string") {
    merged.currentStageId = defaultState.currentStageId;
  }
  if (shouldApplyCashBaseline) {
    merged = applyCashBaseline(merged);
  }
  if (shouldApplyCardCashExpenseBaseline) {
    merged = applyCardCashExpenseBaseline(merged);
  }

  return syncTransactionCategoriesWithExpenses(merged);
};

const stateFingerprint = (state: CapitalState) => JSON.stringify({ ...state, changeLog: [] });

const isDefaultLikeCapitalState = (state: CapitalState) =>
  stateFingerprint(normalizeCapitalState(state)) === stateFingerprint(normalizeCapitalState(defaultState));

const readStoredCapitalState = (key: string): Partial<CapitalState> | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<CapitalState>) : null;
  } catch {
    return null;
  }
};

export type CloudSyncStatus = "loading" | "saved" | "saving" | "offline" | "error";

interface StoredCloudBase {
  state: CapitalState;
  updatedAt: string;
}

const cloudBaseStorageKey = (userId: string) => `${CLOUD_BASE_KEY}:${userId}`;

const readStoredCloudBase = (userId: string): StoredCloudBase | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(cloudBaseStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredCloudBase>;
    if (!parsed.state || typeof parsed.updatedAt !== "string") return null;
    return { state: normalizeCapitalState(parsed.state), updatedAt: parsed.updatedAt };
  } catch {
    return null;
  }
};

const latestChangeTimestamp = (state: CapitalState) =>
  (state.changeLog ?? []).reduce((latest, entry) => Math.max(latest, entry.ts || 0), 0);

const normalizeSyncedCapitalState = (saved: Partial<CapitalState> | null | undefined) => {
  const normalized = normalizeCapitalState(saved);
  return {
    ...normalized,
    changeLog: [...(normalized.changeLog ?? [])]
      .sort((a, b) => b.ts - a.ts)
      .slice(0, MAX_CHANGE_LOG),
  };
};

const collectionStateKeyByScope: Partial<Record<ChangeScope, keyof CapitalState>> = {
  asset: "assets",
  expense: "expenses",
  target: "targets",
  life_goal: "lifeGoals",
  life_area: "lifeAreas",
  cash_account: "cashAccounts",
  transaction: "transactions",
  transaction_category: "transactionCategories",
  income: "incomeSources",
};

const recoverNewerLocalChanges = (
  remoteState: CapitalState,
  localState: CapitalState,
  remoteUpdatedAt: string,
) => {
  const cutoff = Date.parse(remoteUpdatedAt);
  const recentChanges = (localState.changeLog ?? [])
    .filter((entry) => entry.ts > cutoff)
    .sort((a, b) => a.ts - b.ts);
  if (!recentChanges.length) return remoteState;

  const next = { ...remoteState } as CapitalState;
  const nextRecord = next as unknown as Record<string, unknown>;
  const localRecord = localState as unknown as Record<string, unknown>;

  recentChanges.forEach((entry) => {
    if (entry.scope === "state" && entry.field) {
      nextRecord[entry.field] = mergeCloudState(
        entry.before,
        entry.after !== undefined ? entry.after : localRecord[entry.field],
        nextRecord[entry.field],
      );
      return;
    }

    const stateKey = collectionStateKeyByScope[entry.scope];
    if (!stateKey) return;
    const remoteItems = Array.isArray(next[stateKey])
      ? ([...(next[stateKey] as unknown[])] as Array<Record<string, unknown>>)
      : [];
    const localItems = Array.isArray(localState[stateKey])
      ? (localState[stateKey] as unknown as Array<Record<string, unknown>>)
      : [];

    if (!entry.entityId) {
      if (entry.action === "add") {
        const knownIds = new Set(
          remoteItems.map((item) => item.id).filter((id): id is string => typeof id === "string"),
        );
        const additions = localItems.filter(
          (item) => typeof item.id === "string" && !knownIds.has(item.id),
        );
        nextRecord[stateKey] = [...additions, ...remoteItems];
      }
      return;
    }

    const remoteIndex = remoteItems.findIndex((item) => item.id === entry.entityId);
    const localItem = localItems.find((item) => item.id === entry.entityId);
    if (entry.action === "remove") {
      nextRecord[stateKey] = remoteItems.filter((item) => item.id !== entry.entityId);
      return;
    }
    if (!localItem) return;

    if (remoteIndex < 0) {
      remoteItems.push(localItem);
    } else if (entry.action === "add") {
      remoteItems[remoteIndex] = mergeCloudState({}, localItem, remoteItems[remoteIndex]);
    } else if (entry.field) {
      remoteItems[remoteIndex] = {
        ...remoteItems[remoteIndex],
        [entry.field]: mergeCloudState(
          entry.before,
          entry.after !== undefined ? entry.after : localItem[entry.field],
          remoteItems[remoteIndex][entry.field],
        ),
      };
    } else {
      remoteItems[remoteIndex] = localItem;
    }
    nextRecord[stateKey] = remoteItems;
  });

  next.changeLog = mergeCloudState(
    { entries: [] as ChangeEntry[] },
    { entries: recentChanges },
    { entries: remoteState.changeLog ?? [] },
  ).entries;
  return normalizeSyncedCapitalState(next);
};

const isSettledIncomeTransaction = (transaction: MoneyTransaction) =>
  transaction.type === "income" && transaction.categoryId !== REVIEW_CATEGORY_ID;

const defaultIncomeAccountId = (state: CapitalState) =>
  (state.cashAccounts ?? []).find((account) => account.kind === "card" || account.kind === "cash")?.id ??
  (state.cashAccounts ?? [])[0]?.id ??
  "";

const incomeAccountId = (state: CapitalState, transaction: MoneyTransaction) =>
  transaction.accountId || defaultIncomeAccountId(state);

const applyAccountDelta = (state: CapitalState, accountId: string, delta: number): CapitalState => {
  if (!accountId || delta === 0) return state;
  const accounts = state.cashAccounts ?? [];
  if (!accounts.some((account) => account.id === accountId)) return state;
  return {
    ...state,
    cashAccounts: accounts.map((account) =>
      account.id === accountId ? { ...account, balance: Math.round((account.balance + delta) * 100) / 100 } : account,
    ),
  };
};

interface Ctx {
  state: CapitalState;
  syncStatus: CloudSyncStatus;
  update: (patch: Partial<CapitalState>) => void;
  updateAsset: (id: string, patch: Partial<Asset>) => void;
  addAsset: (a: Asset) => void;
  removeAsset: (id: string) => void;
  updateExpense: (id: string, patch: Partial<Expense>) => void;
  addExpense: (e: Expense) => void;
  removeExpense: (id: string) => void;
  updateCashAccount: (id: string, patch: Partial<CashAccount>) => void;
  transferCashAccountBalance: (fromId: string, toId: string, amount: number) => void;
  addCashAccount: (account: CashAccount) => void;
  removeCashAccount: (id: string) => void;
  addTransactionCategory: (category: TransactionCategory) => void;
  updateTransactionCategory: (id: string, patch: Partial<TransactionCategory>) => void;
  removeTransactionCategory: (id: string) => void;
  addTransaction: (transaction: MoneyTransaction) => void;
  importTransactions: (transactions: MoneyTransaction[]) => void;
  updateTransaction: (id: string, patch: Partial<MoneyTransaction>) => void;
  removeTransaction: (id: string) => void;
  updateTarget: (id: string, patch: Partial<TargetAsset>) => void;
  addTarget: (target: TargetAsset) => void;
  removeTarget: (id: string) => void;
  addLifeGoal: (goal: LifeGoal) => void;
  updateLifeGoal: (id: string, patch: Partial<LifeGoal>) => void;
  removeLifeGoal: (id: string) => void;
  addLifeArea: (area: LifeArea) => void;
  updateLifeArea: (id: string, patch: Partial<LifeArea>) => void;
  removeLifeArea: (id: string) => void;
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
    minIncomeSurplus: number;
    activeIncome: number;
    passiveIncome: number;
    currentBalance: number;
    cardCashBaseBalance: number;
    cardCashBalance: number;
    safetyBalance: number;
    monthExpenseTotal: number;
    monthIncomeTotal: number;
  };
}

const CapitalContext = createContext<Ctx | null>(null);

export function CapitalProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<CapitalState>(defaultState);
  const [localReady, setLocalReady] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>("loading");
  const [calendarMonthKey, setCalendarMonthKey] = useState(localMonthKey);
  const stateRef = useRef(state);
  const cloudBaseRef = useRef<CapitalState | null>(null);
  const cloudUpdatedAtRef = useRef<string | null>(null);
  const cloudReadyRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const saveQueuedRef = useRef(false);
  const resetInFlightRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const saveCloudStateRef = useRef<() => Promise<void>>(async () => {});

  const persistLocalState = useCallback((next: CapitalState) => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
    } catch {
      // The in-memory state remains valid when browser storage is unavailable.
    }
  }, []);

  const replaceState = useCallback(
    (next: CapitalState) => {
      const normalized = normalizeSyncedCapitalState(next);
      stateRef.current = normalized;
      persistLocalState(normalized);
      setState(normalized);
    },
    [persistLocalState],
  );

  const rememberCloudBase = useCallback((next: CapitalState, updatedAt: string, userId: string) => {
    const normalized = normalizeSyncedCapitalState(next);
    cloudBaseRef.current = normalized;
    cloudUpdatedAtRef.current = updatedAt;
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          cloudBaseStorageKey(userId),
          JSON.stringify({ state: normalized, updatedAt } satisfies StoredCloudBase),
        );
      }
    } catch {
      // Cloud synchronization still works when this cache cannot be written.
    }
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCalendarMonthKey(localMonthKey());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Load saved state once on mount (client only). Older storage keys are
  // intentionally ignored so stale published values cannot override the
  // current defaults after a deploy.
  useEffect(() => {
    try {
      // Forced reset: if the stored token differs from the current one,
      // wipe all known keys and fall through to defaults.
      const storedToken =
        typeof window !== "undefined" ? window.localStorage.getItem(RESET_TOKEN_KEY) : null;
      if (storedToken !== RESET_TOKEN) {
        try {
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(STORAGE_KEY);
            LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
            LEGACY_META_KEYS.forEach((key) => window.localStorage.removeItem(key));
            window.localStorage.setItem(RESET_TOKEN_KEY, RESET_TOKEN);
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultState));
          }
        } catch {}
        setState(defaultState);
        return;
      }

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

          let merged = normalizeCapitalState(saved);
          const storedLifeAreasVersion =
            typeof window !== "undefined" ? window.localStorage.getItem(LIFE_AREAS_VERSION_KEY) : null;
          if (storedLifeAreasVersion !== LIFE_AREAS_VERSION) {
            const defaultIds = new Set(defaultState.lifeAreas.map((area) => area.id));
            const customAreas = (merged.lifeAreas ?? []).filter((area) => !defaultIds.has(area.id));
            merged.lifeAreas = [...defaultState.lifeAreas, ...customAreas];
            try {
              if (typeof window !== "undefined") {
                window.localStorage.setItem(LIFE_AREAS_VERSION_KEY, LIFE_AREAS_VERSION);
              }
            } catch {}
          }
          merged = normalizeCapitalState(merged);

          // Patch target copy from current defaults when copy version changes,
          // so users get updated names/descriptions without losing numbers.
          const storedDescVersion =
            typeof window !== "undefined" ? window.localStorage.getItem(DESC_VERSION_KEY) : null;
          if (storedDescVersion !== DESC_VERSION) {
            if (Array.isArray(merged.targets)) {
              const defaultTargets = new Map(defaultState.targets.map((t) => [t.id, t]));
              merged.targets = merged.targets.map((t) => {
                const targetCopy = defaultTargets.get(t.id);
                return targetCopy ? { ...t, name: targetCopy.name, meaning: targetCopy.meaning } : t;
              });
            }
            // Refresh stage copy that references target asset names so renamed
            // targets propagate into stage goals / targetAssets lists.
            if (Array.isArray(merged.stages)) {
              const defaultStages = new Map(defaultState.stages.map((st) => [st.id, st]));
              merged.stages = merged.stages.map((st) => {
                const stageCopy = defaultStages.get(st.id);
                return stageCopy
                  ? { ...st, goals: stageCopy.goals, targetAssets: stageCopy.targetAssets, desiredIncome: stageCopy.desiredIncome }
                  : st;
              });
            }
            try {
              if (typeof window !== "undefined") {
                window.localStorage.setItem(DESC_VERSION_KEY, DESC_VERSION);
              }
            } catch {}
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
    } catch {
    } finally {
      setLocalReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const performCloudSave = useCallback(async () => {
    const userId = user?.id;
    if (!supabase || !userId || !cloudReadyRef.current || resetInFlightRef.current) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      saveQueuedRef.current = true;
      setSyncStatus("offline");
      return;
    }

    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      return;
    }

    saveInFlightRef.current = true;
    saveQueuedRef.current = false;
    setSyncStatus("saving");
    let localSnapshot = normalizeSyncedCapitalState(stateRef.current);

    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const expectedUpdatedAt = cloudUpdatedAtRef.current;
        const knownBase = cloudBaseRef.current;

        if (knownBase && cloudValuesEqual(localSnapshot, knownBase)) {
          setSyncStatus("saved");
          return;
        }
        if (!expectedUpdatedAt && isDefaultLikeCapitalState(localSnapshot)) {
          setSyncStatus("saved");
          return;
        }

        const nextUpdatedAt = new Date().toISOString();
        let savedRow: { state: unknown; updated_at: string } | null = null;
        let saveError: { code?: string; message?: string } | null = null;

        if (expectedUpdatedAt) {
          const result = await supabase
            .from("capital_states")
            .update({ state: localSnapshot, updated_at: nextUpdatedAt })
            .eq("user_id", userId)
            .eq("updated_at", expectedUpdatedAt)
            .select("state, updated_at")
            .maybeSingle();
          savedRow = result.data;
          saveError = result.error;
        } else {
          const result = await supabase
            .from("capital_states")
            .insert({ user_id: userId, state: localSnapshot, updated_at: nextUpdatedAt })
            .select("state, updated_at")
            .maybeSingle();
          savedRow = result.data;
          saveError = result.error;
        }

        const insertConflict = !expectedUpdatedAt && saveError?.code === "23505";
        if (saveError && !insertConflict) throw saveError;

        if (savedRow?.state && savedRow.updated_at) {
          const savedState = normalizeSyncedCapitalState(savedRow.state as Partial<CapitalState>);
          rememberCloudBase(savedState, savedRow.updated_at, userId);

          const current = normalizeSyncedCapitalState(stateRef.current);
          const nextCurrent = cloudValuesEqual(current, localSnapshot)
            ? savedState
            : normalizeSyncedCapitalState(mergeCloudState(localSnapshot, current, savedState));
          if (!cloudValuesEqual(current, nextCurrent)) replaceState(nextCurrent);

          if (!cloudValuesEqual(nextCurrent, savedState)) {
            saveQueuedRef.current = true;
          } else {
            setSyncStatus("saved");
          }
          return;
        }

        const { data: remoteRow, error: remoteError } = await supabase
          .from("capital_states")
          .select("state, updated_at")
          .eq("user_id", userId)
          .maybeSingle();
        if (remoteError) throw remoteError;

        const current = normalizeSyncedCapitalState(stateRef.current);
        if (!remoteRow?.state || !remoteRow.updated_at) {
          cloudBaseRef.current = null;
          cloudUpdatedAtRef.current = null;
          localSnapshot = current;
          continue;
        }

        const remoteState = normalizeSyncedCapitalState(remoteRow.state as Partial<CapitalState>);
        const mergeBase = knownBase ?? normalizeSyncedCapitalState(defaultState);
        localSnapshot = normalizeSyncedCapitalState(
          mergeCloudState(mergeBase, current, remoteState),
        );
        rememberCloudBase(remoteState, remoteRow.updated_at, userId);
        if (!cloudValuesEqual(current, localSnapshot)) replaceState(localSnapshot);
      }

      throw new Error("Cloud state changed repeatedly while saving");
    } catch (error) {
      console.error("Unable to save cloud capital state", error);
      const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
      saveQueuedRef.current = isOffline;
      setSyncStatus(isOffline ? "offline" : "error");
    } finally {
      saveInFlightRef.current = false;
      if (saveQueuedRef.current && typeof window !== "undefined" && navigator.onLine) {
        window.setTimeout(() => void saveCloudStateRef.current(), 0);
      }
    }
  }, [rememberCloudBase, replaceState, user?.id]);

  saveCloudStateRef.current = performCloudSave;

  useEffect(() => {
    if (!localReady || !user?.id || !supabase) {
      cloudReadyRef.current = false;
      setCloudReady(false);
      setSyncStatus(user?.id ? "loading" : "saved");
      return;
    }

    const userId = user.id;
    const client = supabase;
    let cancelled = false;
    saveQueuedRef.current = false;
    cloudReadyRef.current = false;
    setCloudReady(false);
    setSyncStatus("loading");

    const loadCloudState = async () => {
      const storedBase = readStoredCloudBase(userId);
      const { data, error } = await client
        .from("capital_states")
        .select("state, updated_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Unable to load cloud capital state", error);
        cloudReadyRef.current = true;
        setCloudReady(true);
        setSyncStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
        return;
      }

      const localState = normalizeSyncedCapitalState(stateRef.current);
      if (data?.state && data.updated_at) {
        const remoteState = normalizeSyncedCapitalState(data.state as Partial<CapitalState>);
        let next = remoteState;

        if (storedBase) {
          next = normalizeSyncedCapitalState(
            mergeCloudState(storedBase.state, localState, remoteState),
          );
        } else if (latestChangeTimestamp(localState) > Date.parse(data.updated_at)) {
          // Older versions did not store a common base. If this browser has a
          // newer local edit, replay only those newer edits over the cloud copy.
          next = recoverNewerLocalChanges(remoteState, localState, data.updated_at);
        }

        rememberCloudBase(remoteState, data.updated_at, userId);
        if (!cloudValuesEqual(localState, next)) replaceState(next);
        if (!cloudValuesEqual(next, remoteState)) saveQueuedRef.current = true;
      } else {
        cloudBaseRef.current = null;
        cloudUpdatedAtRef.current = null;
        if (storedBase) {
          replaceState(defaultState);
          try {
            window.localStorage.removeItem(cloudBaseStorageKey(userId));
          } catch {
            // The in-memory reset still applies when the cache cannot be removed.
          }
        } else if (!isDefaultLikeCapitalState(localState)) {
          saveQueuedRef.current = true;
        }
      }

      cloudReadyRef.current = true;
      setCloudReady(true);
      setSyncStatus(saveQueuedRef.current ? "saving" : "saved");
      if (saveQueuedRef.current) void saveCloudStateRef.current();
    };

    void loadCloudState();

    return () => {
      cancelled = true;
      cloudReadyRef.current = false;
    };
  }, [localReady, rememberCloudBase, replaceState, user?.id]);

  const refreshCloudState = useCallback(async () => {
    const userId = user?.id;
    if (
      !supabase ||
      !userId ||
      !cloudReadyRef.current ||
      saveInFlightRef.current ||
      resetInFlightRef.current
    ) {
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSyncStatus("offline");
      return;
    }

    const { data: versionRow, error: versionError } = await supabase
      .from("capital_states")
      .select("updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (versionError) {
      console.error("Unable to refresh cloud capital state", versionError);
      setSyncStatus("error");
      return;
    }

    const localState = normalizeSyncedCapitalState(stateRef.current);
    if (!versionRow?.updated_at) {
      const hadCloudBase = cloudBaseRef.current !== null;
      cloudBaseRef.current = null;
      cloudUpdatedAtRef.current = null;
      if (hadCloudBase) {
        replaceState(defaultState);
        try {
          window.localStorage.removeItem(cloudBaseStorageKey(userId));
        } catch {
          // The in-memory reset still applies when the cache cannot be removed.
        }
        setSyncStatus("saved");
      } else if (!isDefaultLikeCapitalState(localState)) {
        saveQueuedRef.current = true;
        void saveCloudStateRef.current();
      } else {
        setSyncStatus("saved");
      }
      return;
    }

    if (versionRow.updated_at === cloudUpdatedAtRef.current) {
      if (cloudBaseRef.current && cloudValuesEqual(localState, cloudBaseRef.current)) {
        setSyncStatus("saved");
      } else {
        saveQueuedRef.current = true;
        setSyncStatus("saving");
        void saveCloudStateRef.current();
      }
      return;
    }

    const { data, error } = await supabase
      .from("capital_states")
      .select("state, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Unable to load refreshed cloud capital state", error);
      setSyncStatus("error");
      return;
    }
    if (!data?.state || !data.updated_at) {
      cloudBaseRef.current = null;
      cloudUpdatedAtRef.current = null;
      replaceState(defaultState);
      setSyncStatus("saved");
      return;
    }

    const currentState = normalizeSyncedCapitalState(stateRef.current);
    const remoteState = normalizeSyncedCapitalState(data.state as Partial<CapitalState>);
    const mergeBase = cloudBaseRef.current ?? remoteState;
    const next = normalizeSyncedCapitalState(mergeCloudState(mergeBase, currentState, remoteState));
    rememberCloudBase(remoteState, data.updated_at, userId);
    if (!cloudValuesEqual(currentState, next)) replaceState(next);

    if (!cloudValuesEqual(next, remoteState)) {
      saveQueuedRef.current = true;
      void saveCloudStateRef.current();
    } else {
      setSyncStatus("saved");
    }
  }, [rememberCloudBase, replaceState, user?.id]);

  useEffect(() => {
    if (!cloudReady || !user?.id) return;

    const refresh = () => void refreshCloudState();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
      } else {
        if (saveTimerRef.current !== null) {
          window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        void saveCloudStateRef.current();
      }
    };
    const handlePageHide = () => void saveCloudStateRef.current();
    const handleOnline = () => {
      refresh();
      void saveCloudStateRef.current();
    };
    const handleOffline = () => setSyncStatus("offline");

    const interval = window.setInterval(refresh, CLOUD_REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [cloudReady, refreshCloudState, user?.id]);

  useEffect(() => {
    if (!cloudReady || !user?.id || !supabase) return;

    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    const next = normalizeSyncedCapitalState(state);
    if (cloudBaseRef.current && cloudValuesEqual(next, cloudBaseRef.current)) {
      setSyncStatus("saved");
      return;
    }
    if (!cloudBaseRef.current && isDefaultLikeCapitalState(next)) {
      setSyncStatus("saved");
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      saveQueuedRef.current = true;
      setSyncStatus("offline");
      return;
    }

    saveQueuedRef.current = true;
    setSyncStatus("saving");
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void saveCloudStateRef.current();
    }, CLOUD_SAVE_DELAY_MS);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [cloudReady, state, user?.id]);

  useEffect(() => {
    if (!localReady || (user?.id && supabase && !cloudReady)) return;

    setState((current) => {
      const next = closePreviousExpenseMonth(current, calendarMonthKey);
      if (next === current) return current;
      stateRef.current = next;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // The in-memory state remains valid when browser storage is unavailable.
      }
      return next;
    });
  }, [calendarMonthKey, cloudReady, localReady, user?.id]);

  // Helper that updates React state AND writes localStorage in one shot,
  // using the freshly computed next state so we never persist a stale value.
  const commit = (updater: (s: CapitalState) => CapitalState) => {
    setState((s) => {
      const next = updater(s);
      stateRef.current = next;
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
      } catch {}
      return next;
    });
  };

  const pushLog = (s: CapitalState, entries: Omit<ChangeEntry, "id" | "ts">[]): CapitalState => {
    if (!entries.length) return s;
    const now = Date.now();
    const fresh: ChangeEntry[] = entries.map((e, idx) => ({
      ...e,
      id: `c${now}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
      ts: now,
    }));
    const log = [...fresh, ...(s.changeLog ?? [])].slice(0, MAX_CHANGE_LOG);
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
      const next = syncTransactionCategoriesWithExpenses({ ...s, expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
      return pushLog(next, diffs.map((d) => ({ scope: "expense", action: "update", entityId: id, entityName: cur.name, ...d })));
    });
  const addExpense = (e: Expense) =>
    commit((s) =>
      pushLog(
        syncTransactionCategoriesWithExpenses({ ...s, expenses: [...s.expenses, e] }),
        [{ scope: "expense", action: "add", entityId: e.id, entityName: e.name }],
      ),
    );
  const removeExpense = (id: string) =>
    commit((s) => {
      const cur = s.expenses.find((e) => e.id === id);
      return pushLog(
        syncTransactionCategoriesWithExpenses({ ...s, expenses: s.expenses.filter((e) => e.id !== id) }),
        [{ scope: "expense", action: "remove", entityId: id, entityName: cur?.name }],
      );
    });

  const updateCashAccount = (id: string, patch: Partial<CashAccount>) =>
    commit((s) => {
      const accounts = s.cashAccounts ?? [];
      const cur = accounts.find((account) => account.id === id);
      if (!cur) return s;
      const diffs = diffPatch(cur as unknown as Record<string, unknown>, patch as Partial<Record<string, unknown>>);
      const next = { ...s, cashAccounts: accounts.map((account) => (account.id === id ? { ...account, ...patch } : account)) };
      return pushLog(next, diffs.map((d) => ({ scope: "cash_account", action: "update", entityId: id, entityName: cur.name, ...d })));
    });
  const transferCashAccountBalance = (fromId: string, toId: string, amount: number) =>
    commit((s) => {
      const transferAmount = Math.round(Math.abs(Number(amount) || 0) * 100) / 100;
      const accounts = s.cashAccounts ?? [];
      const from = accounts.find((account) => account.id === fromId);
      const to = accounts.find((account) => account.id === toId);
      if (!from || !to || from.id === to.id || transferAmount <= 0 || from.balance < transferAmount) return s;

      const next = {
        ...s,
        cashAccounts: accounts.map((account) => {
          if (account.id === from.id) return { ...account, balance: account.balance - transferAmount };
          if (account.id === to.id) return { ...account, balance: account.balance + transferAmount };
          return account;
        }),
      };

      return pushLog(next, [
        {
          scope: "cash_account",
          action: "update",
          entityId: from.id,
          entityName: from.name,
          field: "balance",
          before: from.balance,
          after: from.balance - transferAmount,
        },
        {
          scope: "cash_account",
          action: "update",
          entityId: to.id,
          entityName: to.name,
          field: "balance",
          before: to.balance,
          after: to.balance + transferAmount,
        },
      ]);
    });
  const addCashAccount = (account: CashAccount) =>
    commit((s) =>
      pushLog(
        { ...s, cashAccounts: [...(s.cashAccounts ?? []), account] },
        [{ scope: "cash_account", action: "add", entityId: account.id, entityName: account.name }],
      ),
    );
  const removeCashAccount = (id: string) =>
    commit((s) => {
      const accounts = s.cashAccounts ?? [];
      const cur = accounts.find((account) => account.id === id);
      return pushLog(
        { ...s, cashAccounts: accounts.filter((account) => account.id !== id) },
        [{ scope: "cash_account", action: "remove", entityId: id, entityName: cur?.name }],
      );
    });

  const addTransactionCategory = (category: TransactionCategory) =>
    commit((s) =>
      pushLog(
        { ...s, transactionCategories: [...(s.transactionCategories ?? []), category] },
        [{ scope: "transaction_category", action: "add", entityId: category.id, entityName: category.name }],
      ),
    );
  const updateTransactionCategory = (id: string, patch: Partial<TransactionCategory>) =>
    commit((s) => {
      const categories = s.transactionCategories ?? [];
      const cur = categories.find((category) => category.id === id);
      if (!cur) return s;
      const diffs = diffPatch(cur as unknown as Record<string, unknown>, patch as Partial<Record<string, unknown>>);
      const next = { ...s, transactionCategories: categories.map((category) => (category.id === id ? { ...category, ...patch } : category)) };
      return pushLog(next, diffs.map((d) => ({ scope: "transaction_category", action: "update", entityId: id, entityName: cur.name, ...d })));
    });
  const removeTransactionCategory = (id: string) =>
    commit((s) => {
      const categories = s.transactionCategories ?? [];
      const cur = categories.find((category) => category.id === id);
      const fallback = (s.transactionCategories ?? []).find((category) => category.id === REVIEW_CATEGORY_ID)?.id ?? "";
      return pushLog(
        {
          ...s,
          transactionCategories: categories.filter((category) => category.id !== id),
          transactions: (s.transactions ?? []).map((transaction) =>
            transaction.categoryId === id ? { ...transaction, categoryId: fallback } : transaction,
          ),
        },
        [{ scope: "transaction_category", action: "remove", entityId: id, entityName: cur?.name }],
      );
    });

  const addTransaction = (transaction: MoneyTransaction) =>
    commit((s) => {
      const accountId = isSettledIncomeTransaction(transaction) ? incomeAccountId(s, transaction) : transaction.accountId;
      const nextTransaction = accountId ? { ...transaction, accountId } : transaction;
      const next = { ...s, transactions: [nextTransaction, ...(s.transactions ?? [])] };
      const withBalance = isSettledIncomeTransaction(nextTransaction) ? applyAccountDelta(next, accountId || "", nextTransaction.amount) : next;

      return pushLog(
        withBalance,
        [{ scope: "transaction", action: "add", entityId: nextTransaction.id, entityName: nextTransaction.description }],
      );
    });
  const importTransactions = (transactions: MoneyTransaction[]) =>
    commit((s) => {
      if (!transactions.length) return s;
      const existingTransactions = dedupeTransactions(s.transactions ?? []);
      const existingExact = new Map(existingTransactions.map((transaction) => [transactionExactKey(transaction), transaction]));
      const existingLoose = new Map(existingTransactions.map((transaction) => [transactionLooseKey(transaction), transaction]));
      const fresh: MoneyTransaction[] = [];

      transactions.forEach((transaction) => {
        const exactDuplicate = existingExact.get(transactionExactKey(transaction));
        const looseDuplicate = existingLoose.get(transactionLooseKey(transaction));
        if (exactDuplicate || (looseDuplicate && descriptionsLikelyMatch(looseDuplicate, transaction))) return;
        fresh.push(transaction);
        existingExact.set(transactionExactKey(transaction), transaction);
        existingLoose.set(transactionLooseKey(transaction), transaction);
      });

      if (!fresh.length && existingTransactions.length === (s.transactions ?? []).length) return s;
      return pushLog(
        { ...s, transactions: [...fresh, ...existingTransactions] },
        fresh.length ? [{ scope: "transaction", action: "add", entityName: `Импортировано ${fresh.length}` }] : [],
      );
    });
  const updateTransaction = (id: string, patch: Partial<MoneyTransaction>) =>
    commit((s) => {
      const transactions = s.transactions ?? [];
      const cur = transactions.find((transaction) => transaction.id === id);
      if (!cur) return s;
      const diffs = diffPatch(cur as unknown as Record<string, unknown>, patch as Partial<Record<string, unknown>>);
      const nextDraft = { ...cur, ...patch };
      const nextAccountId = isSettledIncomeTransaction(nextDraft) ? incomeAccountId(s, nextDraft) : nextDraft.accountId;
      const nextTransaction = nextAccountId ? { ...nextDraft, accountId: nextAccountId } : nextDraft;
      const category = (s.transactionCategories ?? []).find((candidate) => candidate.id === nextTransaction.categoryId);
      const learnedRule =
        nextTransaction.source === "pdf" &&
        nextTransaction.type === "expense" &&
        nextTransaction.categoryId !== REVIEW_CATEGORY_ID &&
        nextTransaction.categoryId !== cur.categoryId &&
        category
          ? createFinanceAssistantRule(nextTransaction.description, nextTransaction.type, category)
          : null;
      const financeAssistantRules = learnedRule
        ? [
            learnedRule,
            ...(s.financeAssistantRules ?? []).filter(
              (rule) => !(rule.match === "fingerprint" && rule.type === learnedRule.type && rule.pattern === learnedRule.pattern),
            ),
          ].slice(0, 500)
        : (s.financeAssistantRules ?? []);
      let next: CapitalState = {
        ...s,
        financeAssistantRules,
        transactions: transactions.map((transaction) => (transaction.id === id ? nextTransaction : transaction)),
      };

      if (isSettledIncomeTransaction(cur)) {
        next = applyAccountDelta(next, incomeAccountId(s, cur), -cur.amount);
      }
      if (isSettledIncomeTransaction(nextTransaction)) {
        next = applyAccountDelta(next, incomeAccountId(next, nextTransaction), nextTransaction.amount);
      }

      return pushLog(next, diffs.map((d) => ({ scope: "transaction", action: "update", entityId: id, entityName: cur.description, ...d })));
    });
  const removeTransaction = (id: string) =>
    commit((s) => {
      const transactions = s.transactions ?? [];
      const cur = transactions.find((transaction) => transaction.id === id);
      let next: CapitalState = { ...s, transactions: transactions.filter((transaction) => transaction.id !== id) };
      if (cur && isSettledIncomeTransaction(cur)) {
        next = applyAccountDelta(next, incomeAccountId(s, cur), -cur.amount);
      }
      return pushLog(
        next,
        [{ scope: "transaction", action: "remove", entityId: id, entityName: cur?.description }],
      );
    });

  const updateTarget = (id: string, patch: Partial<TargetAsset>) =>
    commit((s) => {
      const cur = s.targets.find((t) => t.id === id);
      if (!cur) return s;
      const diffs = diffPatch(cur as unknown as Record<string, unknown>, patch as Partial<Record<string, unknown>>);
      const next = { ...s, targets: s.targets.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
      return pushLog(next, diffs.map((d) => ({ scope: "target", action: "update", entityId: id, entityName: cur.name, ...d })));
    });
  const addTarget = (target: TargetAsset) =>
    commit((s) =>
      pushLog(
        { ...s, targets: [...s.targets, target] },
        [{ scope: "target", action: "add", entityId: target.id, entityName: target.name }],
      ),
    );
  const removeTarget = (id: string) =>
    commit((s) => {
      const cur = s.targets.find((target) => target.id === id);
      return pushLog(
        { ...s, targets: s.targets.filter((target) => target.id !== id) },
        [{ scope: "target", action: "remove", entityId: id, entityName: cur?.name }],
      );
    });

  const addLifeGoal = (goal: LifeGoal) =>
    commit((s) =>
      pushLog(
        { ...s, lifeGoals: [...(s.lifeGoals ?? []), goal] },
        [{ scope: "life_goal", action: "add", entityId: goal.id, entityName: goal.title }],
      ),
    );
  const updateLifeGoal = (id: string, patch: Partial<LifeGoal>) =>
    commit((s) => {
      const goals = s.lifeGoals ?? [];
      const cur = goals.find((g) => g.id === id);
      if (!cur) return s;
      const diffs = diffPatch(cur as unknown as Record<string, unknown>, patch as Partial<Record<string, unknown>>);
      const next = { ...s, lifeGoals: goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) };
      return pushLog(next, diffs.map((d) => ({ scope: "life_goal", action: "update", entityId: id, entityName: cur.title, ...d })));
    });
  const removeLifeGoal = (id: string) =>
    commit((s) => {
      const goals = s.lifeGoals ?? [];
      const cur = goals.find((g) => g.id === id);
      return pushLog(
        { ...s, lifeGoals: goals.filter((g) => g.id !== id) },
        [{ scope: "life_goal", action: "remove", entityId: id, entityName: cur?.title }],
      );
    });

  const addLifeArea = (area: LifeArea) =>
    commit((s) =>
      pushLog(
        { ...s, lifeAreas: [...(s.lifeAreas ?? []), area] },
        [{ scope: "life_area", action: "add", entityId: area.id, entityName: area.title }],
      ),
    );
  const updateLifeArea = (id: string, patch: Partial<LifeArea>) =>
    commit((s) => {
      const areas = s.lifeAreas ?? [];
      const cur = areas.find((area) => area.id === id);
      if (!cur) return s;
      const diffs = diffPatch(cur as unknown as Record<string, unknown>, patch as Partial<Record<string, unknown>>);
      const next = { ...s, lifeAreas: areas.map((area) => (area.id === id ? { ...area, ...patch } : area)) };
      return pushLog(next, diffs.map((d) => ({ scope: "life_area", action: "update", entityId: id, entityName: cur.title, ...d })));
    });
  const removeLifeArea = (id: string) =>
    commit((s) => {
      const areas = s.lifeAreas ?? [];
      const cur = areas.find((area) => area.id === id);
      return pushLog(
        { ...s, lifeAreas: areas.filter((area) => area.id !== id) },
        [{ scope: "life_area", action: "remove", entityId: id, entityName: cur?.title }],
      );
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
    resetInFlightRef.current = true;
    saveQueuedRef.current = false;
    cloudBaseRef.current = null;
    cloudUpdatedAtRef.current = null;
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setSyncStatus("saving");
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultState));
        LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
        LEGACY_META_KEYS.forEach((key) => localStorage.removeItem(key));
        localStorage.setItem(RESET_TOKEN_KEY, RESET_TOKEN);
        if (user?.id) localStorage.removeItem(cloudBaseStorageKey(user.id));
      }
    } catch {}
    if (supabase && user?.id) {
      const userId = user.id;
      const updatedAt = new Date().toISOString();
      void supabase
        .from("capital_states")
        .upsert(
          { user_id: userId, state: defaultState, updated_at: updatedAt },
          { onConflict: "user_id" },
        )
        .select("state, updated_at")
        .single()
        .then(({ data, error }) => {
          resetInFlightRef.current = false;
          if (error) {
            console.error("Unable to reset cloud capital state", error);
            setSyncStatus("error");
          } else {
            rememberCloudBase(
              normalizeSyncedCapitalState(data.state as Partial<CapitalState>),
              data.updated_at,
              userId,
            );
            setSyncStatus("saved");
          }
        });
    } else {
      resetInFlightRef.current = false;
      setSyncStatus("saved");
    }
    stateRef.current = defaultState;
    setState(defaultState);
  };

  const minCapital = state.assets.reduce((s, a) => s + a.min, 0);
  const estimatedCapital = state.assets.reduce((s, a) => s + a.estimated, 0);
  const maxCapital = state.assets.reduce((s, a) => s + a.max, 0);
  const monthlyMinimum = state.minExpense;
  const minIncome = state.minIncome;
  const minIncomeSurplus = minIncome - monthlyMinimum;
  const activeIncome = state.incomeSources.filter((i) => i.status === "active" && i.kind === "active").reduce((s, i) => s + i.monthly, 0);
  const passiveIncome = state.incomeSources.filter((i) => i.status === "active" && i.kind === "passive").reduce((s, i) => s + i.monthly, 0);
  const cashAccounts = state.cashAccounts ?? [];
  const transactions = state.transactions ?? [];
  const monthKey = calendarMonthKey;
  const monthTransactions = transactions.filter((transaction) => transaction.date.startsWith(monthKey));
  const monthExpenseTotal = monthTransactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((s, transaction) => s + transaction.amount, 0);
  const monthIncomeTotal = monthTransactions
    .filter((transaction) => transaction.type === "income" && transaction.categoryId !== REVIEW_CATEGORY_ID)
    .reduce((s, transaction) => s + transaction.amount, 0);
  const cardCashBaseBalance = cashAccounts
    .filter((account) => account.kind === "card" || account.kind === "cash")
    .reduce((s, account) => s + account.balance, 0);
  const cardCashExpenseBaseline = Math.max(0, state.cardCashExpenseBaseline ?? 0);
  const balanceMonthKey = state.cardCashExpenseBaselineMonth ?? monthKey;
  const balanceMonthExpenseTotal = balanceMonthKey === monthKey
    ? monthExpenseTotal
    : expenseTotalForMonth(state, balanceMonthKey);
  const cardCashExpenseDelta = Math.max(0, balanceMonthExpenseTotal - cardCashExpenseBaseline);
  const cardCashBalance = cardCashBaseBalance - cardCashExpenseDelta;
  const safetyBalance = cashAccounts.filter((account) => account.kind === "safety").reduce((s, account) => s + account.balance, 0);
  const currentBalance = cardCashBalance + safetyBalance;

  return (
    <CapitalContext.Provider
      value={{
        state,
        syncStatus,
        update,
        updateAsset,
        addAsset,
        removeAsset,
        updateExpense,
        addExpense,
        removeExpense,
        updateCashAccount,
        transferCashAccountBalance,
        addCashAccount,
        removeCashAccount,
        addTransactionCategory,
        updateTransactionCategory,
        removeTransactionCategory,
        addTransaction,
        importTransactions,
        updateTransaction,
        removeTransaction,
        updateTarget,
        addTarget,
        removeTarget,
        addLifeGoal,
        updateLifeGoal,
        removeLifeGoal,
        addLifeArea,
        updateLifeArea,
        removeLifeArea,
        addIncome,
        updateIncome,
        removeIncome,
        reset,
        clearChangeLog,
        totals: {
          minCapital,
          estimatedCapital,
          maxCapital,
          monthlyMinimum,
          minIncome,
          minIncomeSurplus,
          activeIncome,
          passiveIncome,
          currentBalance,
          cardCashBaseBalance,
          cardCashBalance,
          safetyBalance,
          monthExpenseTotal,
          monthIncomeTotal,
        },
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
