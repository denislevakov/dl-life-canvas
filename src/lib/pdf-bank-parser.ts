import { REVIEW_CATEGORY_ID, type MoneyTransaction, type TransactionCategory } from "@/lib/capital-store";

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc =
  typeof window === "undefined" ? "pdfjs-dist/legacy/build/pdf.worker.mjs" : pdfWorker;

interface ParsedPdfResult {
  transactions: MoneyTransaction[];
  textPreview: string;
}

type TextContentItem = { str?: string; transform?: number[] };

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

const categoryForText = (text: string, categories: TransactionCategory[]) => {
  const lower = text.toLowerCase();
  const findById = (id: string) => {
    for (let index = 0; index < categories.length; index += 1) {
      if (categories[index].id === id) return categories[index].id;
    }
    return undefined;
  };
  const findByName = (pattern: RegExp) => {
    for (let index = 0; index < categories.length; index += 1) {
      if (pattern.test(categories[index].name.toLowerCase())) return categories[index].id;
    }
    return undefined;
  };
  const find = (id: string, pattern: RegExp) => findById(id) || findByName(pattern);

  if (/аренд|rent/.test(lower)) return find("cat_expense_e1", /аренд/);
  if (/квартплат|жкх|коммунал|utility|utilities/.test(lower)) return find("cat_expense_e2", /квартплат|жкх|коммунал/);
  if (/пят[её]р|перекрест|вкусвилл|магнит|самокат|лавк|lavka|restaurant|ресторан|cafe|кафе|кофе|kofe|еда|продукт|delivery|доставка/.test(lower)) {
    return find("cat_expense_e3", /питание|ресторан|еда|продукт/);
  }
  if (/мобильн|телефон|tele2|mts|мтс|beeline|билайн|megafon|мегафон/.test(lower)) return find("cat_expense_e4", /мобильн|телефон/);
  if (/интернет|internet|провайдер|rostelecom|ростелеком/.test(lower)) return find("cat_expense_e5", /интернет/);
  if (/стриж|барбер|barber|парикмах/.test(lower)) return find("cat_expense_e6", /стриж|барбер|парикмах/);
  if (/комисс|подпис|spotify|apple|google|yandex plus|netflix|kinopoisk|service fee/.test(lower)) {
    return find("cat_expense_e7", /комисс|карт|подпис/);
  }
  if (/мама|маме|mother/.test(lower)) return find("cat_expense_e8", /мама/);
  if (/склад|storage|хранени/.test(lower)) return find("cat_expense_e9", /склад|хранени/);
  if (/фитнес|fitness|gym|спортзал|зал/.test(lower)) return find("cat_expense_e10", /фитнес|спортзал/);
  if (/клининг|cleaning|уборк/.test(lower)) return find("cat_expense_e11", /клининг|уборк/);
  if (/зачисление|поступление|salary|зарплат|перевод от|income/.test(lower)) return findById("cat_income") || findByName(/доход/);
  return findById(REVIEW_CATEGORY_ID) || (categories[0] ? categories[0].id : "") || "";
};

const isIncomeLine = (line: string, amountText: string) => {
  const lower = line.toLowerCase();
  if (/перевод клиенту|перевод по номеру|перевод другому|перевод на|списание|выдача наличных/.test(lower)) return false;
  if (/зачисление|поступление|salary|зарплат|возврат|cashback|кэшбэк|перевод от|внесение наличных|пополнение/.test(lower)) return true;
  return amountText.trim().charAt(0) === "+";
};

const descriptionFromNextLine = (line: string) =>
  line
    .replace(/\d{2}[./-]\d{2}[./-]\d{2,4}/, "")
    .replace(/^\s*\d+\s*/, "")
    .replace(/\*{2,}\d+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

const parseSberStatementLines = (lines: string[], categories: TransactionCategory[]) => {
  const parsed: MoneyTransaction[] = [];
  const datePattern = /(\d{2}[./-]\d{2}[./-]\d{2,4})/;
  const timePattern = /\b\d{2}:\d{2}\b/;
  const amountPattern = /([+-]?\s?\d{1,3}(?:[\s.]\d{3})*(?:[,.]\d{2})|[+-]?\s?\d+[,.]\d{2})/g;

  lines.forEach((line, index) => {
    const dateMatch = line.match(datePattern);
    const timeMatch = line.match(timePattern);
    if (!dateMatch || !timeMatch) return;

    const tail = line.replace(dateMatch[1], "").replace(timeMatch[0], "").replace(/\s+/g, " ").trim();
    const amounts = collectMatches(tail, amountPattern);
    if (!amounts.length) return;

    // Sber rows usually have operation amount and account balance.
    // The balance is the rightmost amount, so operation amount is before it.
    const amountText = amounts.length > 1 ? amounts[amounts.length - 2] : amounts[0];
    const amount = normalizeAmount(amountText);
    const date = normalizeDate(dateMatch[1]);
    if (!amount || !date) return;

    const balanceText = amounts.length ? amounts[amounts.length - 1] : "";
    const categoryText = tail.replace(amountText, "").replace(balanceText, "").replace(/\s+/g, " ").trim();
    const nextDescription = descriptionFromNextLine(lines[index + 1] || "");
    const combinedText = [categoryText, nextDescription].filter(Boolean).join(" · ");
    const description = combinedText || "Операция из PDF";
    const type = isIncomeLine(combinedText, amountText) ? "income" : "expense";

    parsed.push({
      id: `tx_pdf_${Date.now()}_${index}`,
      date,
      description,
      amount,
      type,
      categoryId: type === "income" ? REVIEW_CATEGORY_ID : categoryForText(combinedText, categories),
      source: "pdf",
    });
  });

  return parsed;
};

const parseTransactionsFromText = (text: string, categories: TransactionCategory[]) => {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const sberRows = parseSberStatementLines(lines, categories);
  if (sberRows.length) return sberRows;

  const parsed: MoneyTransaction[] = [];
  const datePattern = /(\d{2}[./-]\d{2}[./-]\d{2,4})/;
  const amountPattern = /([+-]?\s?\d{1,3}(?:[\s.]\d{3})*(?:[,.]\d{2})|[+-]?\s?\d+[,.]\d{2})/g;

  lines.forEach((line, index) => {
    const dateMatch = line.match(datePattern);
    if (!dateMatch) return;

    const amounts = collectMatches(line, amountPattern);
    const amountText = amounts.length ? amounts[amounts.length - 1] : undefined;
    if (!amountText) return;

    const amount = normalizeAmount(amountText);
    if (!amount) return;

    const date = normalizeDate(dateMatch[1]);
    if (!date) return;

    const description = line
      .replace(dateMatch[1], "")
      .replace(amountText, "")
      .replace(/\s+/g, " ")
      .trim() || "Операция из PDF";

    const type = isIncomeLine(line, amountText) ? "income" : "expense";
    parsed.push({
      id: `tx_pdf_${Date.now()}_${index}`,
      date,
      description,
      amount,
      type,
      categoryId: type === "income" ? REVIEW_CATEGORY_ID : categoryForText(line, categories),
      source: "pdf",
    });
  });

  return parsed;
};

const linesFromPdfItems = (items: TextContentItem[]) => {
  const positioned = items
    .map((item) => ({
      text: (item.str || "").trim(),
      x: item.transform ? item.transform[4] || 0 : 0,
      y: item.transform ? item.transform[5] || 0 : 0,
    }))
    .filter((item) => item.text);

  const rows: { y: number; items: typeof positioned }[] = [];
  positioned.forEach((item) => {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= 3);
    if (row) {
      row.items.push(item);
      row.y = (row.y + item.y) / 2;
      return;
    }
    rows.push({ y: item.y, items: [item] });
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

export async function parseBankPdf(file: File, categories: TransactionCategory[]): Promise<ParsedPdfResult> {
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    pageTexts.push(linesFromPdfItems(content.items as TextContentItem[]).join("\n"));
  }

  const text = pageTexts.join("\n");
  return {
    transactions: parseTransactionsFromText(text, categories),
    textPreview: text.slice(0, 2000),
  };
}
