import type { MoneyTransaction, TransactionCategory } from "@/lib/capital-store";

import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

interface ParsedPdfResult {
  transactions: MoneyTransaction[];
  textPreview: string;
}

const normalizeAmount = (value: string) => {
  const clean = value.replace(/\s/g, "").replace(",", ".");
  const number = Number(clean);
  return Number.isFinite(number) ? Math.abs(number) : 0;
};

const normalizeDate = (value: string) => {
  const [day, month, yearRaw] = value.split(/[./-]/);
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  if (!day || !month || !year) return "";
  return `${year.padStart(4, "20")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

const categoryForText = (text: string, categories: TransactionCategory[]) => {
  const lower = text.toLowerCase();
  const findById = (id: string) => categories.find((category) => category.id === id)?.id;
  const findByName = (pattern: RegExp) => categories.find((category) => pattern.test(category.name.toLowerCase()))?.id;
  const find = (id: string, pattern: RegExp) => findById(id) ?? findByName(pattern);

  if (/аренд|rent/.test(lower)) return find("cat_expense_e1", /аренд/);
  if (/квартплат|жкх|коммунал|utility|utilities/.test(lower)) return find("cat_expense_e2", /квартплат|жкх|коммунал/);
  if (/пят[её]р|перекрест|вкусвилл|магнит|самокат|лавк|restaurant|cafe|кофе|еда|продукт|delivery|доставка/.test(lower)) {
    return find("cat_expense_e3", /питание|ресторан|еда|продукт/);
  }
  if (/мобильн|телефон|tele2|mts|мтс|beeline|билайн|megafon|мегафон/.test(lower)) return find("cat_expense_e4", /мобильн|телефон/);
  if (/интернет|internet|провайдер|rostelecom|ростелеком/.test(lower)) return find("cat_expense_e5", /интернет/);
  if (/стриж|барбер|barber|парикмах/.test(lower)) return find("cat_expense_e6", /стриж|барбер|парикмах/);
  if (/комисс|карта|подпис|spotify|apple|google|yandex|netflix|kinopoisk|банк|service fee/.test(lower)) {
    return find("cat_expense_e7", /комисс|карт|подпис/);
  }
  if (/мама|маме|mother/.test(lower)) return find("cat_expense_e8", /мама/);
  if (/склад|storage|хранени/.test(lower)) return find("cat_expense_e9", /склад|хранени/);
  if (/фитнес|fitness|gym|спортзал|зал/.test(lower)) return find("cat_expense_e10", /фитнес|спортзал/);
  if (/клининг|cleaning|уборк/.test(lower)) return find("cat_expense_e11", /клининг|уборк/);
  if (/зачисление|поступление|salary|зарплат|перевод от|income/.test(lower)) return findById("cat_income") ?? findByName(/доход/);
  return findById("cat_other") ?? findByName(/другое/) ?? categories[0]?.id ?? "";
};

const isIncomeLine = (line: string, amountText: string) => {
  const lower = line.toLowerCase();
  if (/зачисление|поступление|salary|зарплат|возврат|cashback|кэшбэк|перевод от|пополнение/.test(lower)) return true;
  return amountText.trim().startsWith("+");
};

const parseTransactionsFromText = (text: string, categories: TransactionCategory[]) => {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const parsed: MoneyTransaction[] = [];
  const datePattern = /(\d{2}[./-]\d{2}[./-]\d{2,4})/;
  const amountPattern = /([+-]?\s?\d{1,3}(?:[\s.]\d{3})*(?:[,.]\d{2})|[+-]?\s?\d+[,.]\d{2})/g;

  lines.forEach((line, index) => {
    const dateMatch = line.match(datePattern);
    if (!dateMatch) return;

    const amounts = [...line.matchAll(amountPattern)].map((match) => match[1]);
    const amountText = amounts.at(-1);
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
      categoryId: type === "income" ? (categories.find((category) => category.id === "cat_income")?.id ?? categoryForText(line, categories)) : categoryForText(line, categories),
      source: "pdf",
    });
  });

  return parsed;
};

export async function parseBankPdf(file: File, categories: TransactionCategory[]): Promise<ParsedPdfResult> {
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean)
      .join("\n");
    pageTexts.push(pageText);
  }

  const text = pageTexts.join("\n");
  return {
    transactions: parseTransactionsFromText(text, categories),
    textPreview: text.slice(0, 2000),
  };
}
