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
  const find = (id: string) => categories.find((category) => category.id === id)?.id;
  if (/пят[её]р|перекрест|вкусвилл|магнит|самокат|лавк|restaurant|cafe|кофе|еда|продукт/.test(lower)) return find("cat_food");
  if (/такси|метро|transport|яндекс go|авто|парков/.test(lower)) return find("cat_transport");
  if (/аптек|клиник|health|мед|doctor/.test(lower)) return find("cat_health");
  if (/ozon|wildberries|маркет|магазин|store|purchase/.test(lower)) return find("cat_home");
  if (/подпис|spotify|apple|google|yandex|netflix|kinopoisk/.test(lower)) return find("cat_subscriptions");
  if (/авиа|hotel|отел|travel|booking|airbnb|поезд/.test(lower)) return find("cat_travel");
  if (/зачисление|поступление|salary|зарплат|перевод от|income/.test(lower)) return find("cat_income");
  return find("cat_other") ?? categories[0]?.id ?? "";
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
