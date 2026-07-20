import {
  REVIEW_CATEGORY_ID,
  type MoneyTransaction,
  type TransactionCategory,
} from "@/lib/capital-store";
import {
  classifyFinanceDescription,
  type FinanceAssistantRule,
  type FinanceClassificationReason,
  type FinanceTransactionExample,
  type FinanceTransactionType,
} from "@/lib/finance-categorization";

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc =
  typeof window === "undefined" ? "pdfjs-dist/legacy/build/pdf.worker.mjs" : pdfWorker;

export interface ParsedPdfResult {
  transactions: MoneyTransaction[];
  textPreview: string;
  classification: {
    autoClassified: number;
    ruleMatches: number;
    historyMatches: number;
    keywordMatches: number;
    needsReview: number;
  };
}

export interface BankPdfClassificationContext {
  examples?: FinanceTransactionExample[];
  rules?: FinanceAssistantRule[];
}

type TextContentItem = { str?: string; transform?: number[] };
type Categorize = (description: string, type: FinanceTransactionType) => string;

const collectMatches = (text: string, pattern: RegExp) => {
  const matches: string[] = [];
  const source = pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
  source.lastIndex = 0;
  let match = source.exec(text);
  while (match) {
    if (match[1]) matches.push(match[1]);
    if (match.index === source.lastIndex) source.lastIndex += 1;
    match = source.exec(text);
  }
  return matches;
};

const normalizeAmount = (value: string) => {
  const clean = value.replace(/\s/g, "").replace(",", ".");
  const number = Number(clean);
  return isFinite(number) ? Math.abs(number) : 0;
};

const normalizeDate = (value: string) => {
  const [day, month, yearRaw] = value.split(/[./-]/);
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  if (!day || !month || !year) return "";
  return `${year.padStart(4, "20")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

const isIncomeLine = (line: string, amountText: string) => {
  const lower = line.toLowerCase();
  if (
    /перевод клиенту|перевод по номеру|перевод другому|перевод на|списание|выдача наличных/.test(
      lower,
    )
  )
    return false;
  if (
    /зачисление|поступление|salary|зарплат|возврат|cashback|кэшбэк|перевод от|внесение наличных|пополнение/.test(
      lower,
    )
  )
    return true;
  return amountText.trim().charAt(0) === "+";
};

const descriptionFromNextLine = (line: string) =>
  line
    .replace(/\d{2}[./-]\d{2}[./-]\d{2,4}/, "")
    .replace(/^\s*\d+\s*/, "")
    .replace(/\*{2,}\d+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

const parseSberStatementLines = (lines: string[], categorize: Categorize) => {
  const parsed: MoneyTransaction[] = [];
  const datePattern = /(\d{2}[./-]\d{2}[./-]\d{2,4})/;
  const timePattern = /\b\d{2}:\d{2}\b/;
  const amountPattern = /([+-]?\s?\d{1,3}(?:[\s.]\d{3})*(?:[,.]\d{2})|[+-]?\s?\d+[,.]\d{2})/g;

  lines.forEach((line, index) => {
    const dateMatch = line.match(datePattern);
    const timeMatch = line.match(timePattern);
    if (!dateMatch || !timeMatch) return;
    const tail = line
      .replace(dateMatch[1], "")
      .replace(timeMatch[0], "")
      .replace(/\s+/g, " ")
      .trim();
    const amounts = collectMatches(tail, amountPattern);
    if (!amounts.length) return;
    const amountText = amounts.length > 1 ? amounts[amounts.length - 2] : amounts[0];
    const amount = normalizeAmount(amountText);
    const date = normalizeDate(dateMatch[1]);
    if (!amount || !date) return;
    const balanceText = amounts[amounts.length - 1] ?? "";
    const categoryText = tail
      .replace(amountText, "")
      .replace(balanceText, "")
      .replace(/\s+/g, " ")
      .trim();
    const nextDescription = descriptionFromNextLine(lines[index + 1] || "");
    const description =
      [categoryText, nextDescription].filter(Boolean).join(" · ") || "Операция из PDF";
    const type = isIncomeLine(description, amountText) ? "income" : "expense";
    parsed.push({
      id: `tx_pdf_${Date.now()}_${index}`,
      date,
      description,
      amount,
      type,
      categoryId: categorize(description, type),
      source: "pdf",
    });
  });
  return parsed;
};

const parseTransactionsFromText = (text: string, categorize: Categorize) => {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const sberRows = parseSberStatementLines(lines, categorize);
  if (sberRows.length) return sberRows;
  const parsed: MoneyTransaction[] = [];
  const datePattern = /(\d{2}[./-]\d{2}[./-]\d{2,4})/;
  const amountPattern = /([+-]?\s?\d{1,3}(?:[\s.]\d{3})*(?:[,.]\d{2})|[+-]?\s?\d+[,.]\d{2})/g;

  lines.forEach((line, index) => {
    const dateMatch = line.match(datePattern);
    if (!dateMatch) return;
    const amounts = collectMatches(line, amountPattern);
    const amountText = amounts[amounts.length - 1];
    if (!amountText) return;
    const amount = normalizeAmount(amountText);
    const date = normalizeDate(dateMatch[1]);
    if (!amount || !date) return;
    const description =
      line.replace(dateMatch[1], "").replace(amountText, "").replace(/\s+/g, " ").trim() ||
      "Операция из PDF";
    const type = isIncomeLine(line, amountText) ? "income" : "expense";
    parsed.push({
      id: `tx_pdf_${Date.now()}_${index}`,
      date,
      description,
      amount,
      type,
      categoryId: categorize(description, type),
      source: "pdf",
    });
  });
  return parsed;
};

const linesFromPdfItems = (items: TextContentItem[]) => {
  const positioned = items
    .map((item) => ({
      text: (item.str || "").trim(),
      x: item.transform?.[4] || 0,
      y: item.transform?.[5] || 0,
    }))
    .filter((item) => item.text);
  const rows: { y: number; items: typeof positioned }[] = [];
  positioned.forEach((item) => {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= 3);
    if (row) {
      row.items.push(item);
      row.y = (row.y + item.y) / 2;
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  });
  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) =>
      row.items
        .sort((a, b) => a.x - b.x)
        .map((item) => item.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
};

export async function parseBankPdf(
  file: File,
  categories: TransactionCategory[],
  context: BankPdfClassificationContext = {},
): Promise<ParsedPdfResult> {
  const counts: Record<FinanceClassificationReason, number> = {
    rule: 0,
    history: 0,
    keyword: 0,
    review: 0,
  };
  const categorize: Categorize = (description, type) => {
    // Income always needs an account choice, even when the source is recognizable.
    if (type === "income") {
      counts.review += 1;
      return REVIEW_CATEGORY_ID;
    }
    const result = classifyFinanceDescription({
      description,
      type,
      categories,
      rules: context.rules,
      examples: context.examples,
    });
    counts[result.reason] += 1;
    return result.categoryId || REVIEW_CATEGORY_ID;
  };

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pageTexts: string[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    pageTexts.push(linesFromPdfItems(content.items as TextContentItem[]).join("\n"));
  }
  const text = pageTexts.join("\n");
  const transactions = parseTransactionsFromText(text, categorize);
  return {
    transactions,
    textPreview: text.slice(0, 2000),
    classification: {
      autoClassified: counts.rule + counts.history + counts.keyword,
      ruleMatches: counts.rule,
      historyMatches: counts.history,
      keywordMatches: counts.keyword,
      needsReview: counts.review,
    },
  };
}
