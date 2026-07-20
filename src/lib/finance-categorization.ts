export type FinanceTransactionType = "income" | "expense";

export interface FinanceCategoryLike {
  id: string;
  name: string;
}

export interface FinanceTransactionExample {
  description: string;
  type: FinanceTransactionType;
  categoryId: string;
}

export interface FinanceAssistantRule {
  id: string;
  categoryId: string;
  categoryName?: string;
  type?: FinanceTransactionType;
  transactionTypes?: FinanceTransactionType[];
  pattern: string;
  patterns?: string[];
  match?: "fingerprint" | "contains";
  createdAt?: string;
  updatedAt?: string;
  source?: string;
  description?: string;
  treatment?: string;
  applyTo?: string;
}

export type FinanceClassificationReason = "rule" | "history" | "keyword" | "review";

export interface FinanceClassification {
  categoryId: string;
  reason: FinanceClassificationReason;
}

const REVIEW_CATEGORY_ID = "cat_review";

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[ё]/g, "е")
    .replace(/[^a-zа-я0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const NOISE_TOKENS = new Set([
  "операция",
  "операции",
  "карте",
  "карта",
  "карту",
  "карты",
  "счету",
  "счета",
  "счет",
  "перевод",
  "переводы",
  "покупка",
  "расход",
  "расходы",
  "прочие",
  "выдача",
  "наличных",
  "на",
  "по",
  "для",
  "из",
  "с",
  "ооо",
  "ип",
  "sbol",
  "moscow",
  "moskva",
  "spb",
  "russia",
  "rus",
]);

const GENERIC_FINGERPRINTS = new Set(["atm", "bank", "банк", "магазин", "терминал"]);
const USEFUL_MCC_CODES = new Set(["4121", "5411", "5814", "7512"]);

export const financeDescriptionFingerprint = (description: string) => {
  const meaningfulPart = description.includes("·")
    ? description.split("·").slice(1).join(" ")
    : description;
  const normalized = normalizeText(meaningfulPart)
    .replace(/операци[яи] по (?:банковской )?(?:карте|счету)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const keepMcc = /\byandex\b|\bsber\b/.test(normalized);
  const tokens = normalized.split(" ").filter((token) => {
    if (!token || NOISE_TOKENS.has(token)) return false;
    if (/^\d+$/.test(token)) return keepMcc && USEFUL_MCC_CODES.has(token);
    return true;
  });
  return tokens.join(" ");
};

export const isUsefulFinanceFingerprint = (fingerprint: string) =>
  fingerprint.length >= 4 &&
  !GENERIC_FINGERPRINTS.has(fingerprint) &&
  fingerprint.split(" ").some((token) => /[a-zа-я]/.test(token) && token.length >= 3);

export const createFinanceAssistantRule = (
  description: string,
  type: FinanceTransactionType,
  category: FinanceCategoryLike,
): FinanceAssistantRule | null => {
  const pattern = financeDescriptionFingerprint(description);
  if (!isUsefulFinanceFingerprint(pattern)) return null;
  const now = new Date().toISOString();
  return {
    id: `far_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    pattern,
    match: "fingerprint",
    categoryId: category.id,
    categoryName: category.name,
    type,
    createdAt: now,
    updatedAt: now,
    source: "manual_category_choice",
  };
};

const ruleAppliesToType = (rule: FinanceAssistantRule, type: FinanceTransactionType) => {
  if (rule.type && rule.type !== type) return false;
  if (rule.transactionTypes?.length && !rule.transactionTypes.includes(type)) return false;
  return true;
};

const ruleMatches = (rule: FinanceAssistantRule, description: string, fingerprint: string) => {
  if (rule.match === "fingerprint") return fingerprint === normalizeText(rule.pattern);
  const normalizedDescription = normalizeText(description);
  const patterns = rule.patterns?.length
    ? rule.patterns
    : rule.pattern && !["contains_any", "incoming_bank_credit"].includes(rule.pattern)
      ? [rule.pattern]
      : [];
  return patterns.some((pattern) => {
    const normalizedPattern = normalizeText(pattern);
    return Boolean(normalizedPattern && normalizedDescription.includes(normalizedPattern));
  });
};

const categoryByName = (categories: FinanceCategoryLike[], pattern: RegExp) =>
  categories.find((category) => pattern.test(normalizeText(category.name)))?.id;

const categoryFromKeywords = (description: string, categories: FinanceCategoryLike[]) => {
  const text = normalizeText(description);
  const find = (pattern: RegExp) => categoryByName(categories, pattern);

  if (/супермаркет|пятер|перекрест|вкусвилл|магнит|pyaterochka/.test(text)) {
    return find(/продукт|супермаркет|питание/);
  }
  if (/ресторан|кафе|кофе|restaurant|cafe|kofe|доставка|yandex 5814 eda/.test(text)) {
    return find(/ресторан|доставк|кафе|питание/);
  }
  if (/yandex 4121 go|citydrive|mos transport|такси|каршер|метро|транспорт/.test(text)) {
    return find(/такси|каршер|метро|транспорт/);
  }
  if (/tutu|путешеств|авиабилет|отел|hotel/.test(text)) return find(/путешеств/);
  if (
    /мобильн|телефон|tele2|mts|мтс|beeline|билайн|megafon|мегафон|интернет|rostelecom|ростелеком/.test(
      text,
    )
  ) {
    return find(/мобильн|телефон|интернет/);
  }
  if (
    /комисс|подпис|spotify|apple com|apple services|google play|google one|yandex plus|netflix|kinopoisk|service fee/.test(
      text,
    )
  ) {
    return find(/комисс|подпис/);
  }
  if (/стриж|барбер|barber|парикмах|клиник|стомат|здоров|красот/.test(text))
    return find(/красот|здоров|стриж/);
  if (/фитнес|fitness|gym|спортзал/.test(text)) return find(/спорт|фитнес/);
  if (/клининг|cleaning|уборк|хозтовар/.test(text)) return find(/клининг|хозтовар|уборк/);
  if (/мама|маме|mother/.test(text)) return find(/мам/);
  if (/склад|storage|хранени/.test(text)) return find(/склад|хранени/);
  if (/аренд/.test(text)) return find(/аренд.*квартир/);
  if (/квартплат|жкх|коммунал|utilities/.test(text)) return find(/квартир|квартплат|жкх|коммунал/);

  return categories.find((category) => {
    if (!category.id.startsWith("cat_expense_")) return false;
    const name = normalizeText(category.name);
    return name.length >= 5 && text.includes(name);
  })?.id;
};

const categoryFromHistory = (
  fingerprint: string,
  type: FinanceTransactionType,
  categories: FinanceCategoryLike[],
  examples: FinanceTransactionExample[],
) => {
  if (!isUsefulFinanceFingerprint(fingerprint)) return { categoryId: undefined, ambiguous: false };
  const validCategoryIds = new Set(categories.map((category) => category.id));
  const counts = new Map<string, number>();

  examples.forEach((example) => {
    if (
      example.type !== type ||
      example.categoryId === REVIEW_CATEGORY_ID ||
      !validCategoryIds.has(example.categoryId)
    )
      return;
    if (financeDescriptionFingerprint(example.description) !== fingerprint) return;
    counts.set(example.categoryId, (counts.get(example.categoryId) ?? 0) + 1);
  });

  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return { categoryId: undefined, ambiguous: false };
  const total = ranked.reduce((sum, [, count]) => sum + count, 0);
  const [categoryId, topCount] = ranked[0];
  if (total > 1 && (topCount < 2 || topCount / total < 0.67)) {
    return { categoryId: undefined, ambiguous: true };
  }
  return { categoryId, ambiguous: false };
};

export const classifyFinanceDescription = ({
  description,
  type,
  categories,
  rules = [],
  examples = [],
}: {
  description: string;
  type: FinanceTransactionType;
  categories: FinanceCategoryLike[];
  rules?: FinanceAssistantRule[];
  examples?: FinanceTransactionExample[];
}): FinanceClassification => {
  const validCategoryIds = new Set(categories.map((category) => category.id));
  const fingerprint = financeDescriptionFingerprint(description);

  const rule = rules.find(
    (candidate) =>
      validCategoryIds.has(candidate.categoryId) &&
      ruleAppliesToType(candidate, type) &&
      ruleMatches(candidate, description, fingerprint),
  );
  if (rule)
    return {
      categoryId: rule.categoryId,
      reason: rule.categoryId === REVIEW_CATEGORY_ID ? "review" : "rule",
    };

  const historical = categoryFromHistory(fingerprint, type, categories, examples);
  if (historical.categoryId) return { categoryId: historical.categoryId, reason: "history" };
  if (historical.ambiguous) {
    return {
      categoryId: validCategoryIds.has(REVIEW_CATEGORY_ID) ? REVIEW_CATEGORY_ID : "",
      reason: "review",
    };
  }

  const keywordCategory =
    type === "expense" ? categoryFromKeywords(description, categories) : undefined;
  if (keywordCategory) return { categoryId: keywordCategory, reason: "keyword" };

  return {
    categoryId: validCategoryIds.has(REVIEW_CATEGORY_ID) ? REVIEW_CATEGORY_ID : "",
    reason: "review",
  };
};
