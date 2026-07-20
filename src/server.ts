import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import type { TransactionCategory } from "./lib/capital-store";
import type { FinanceAssistantRule, FinanceTransactionExample } from "./lib/finance-categorization";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;
const PDF_PARSE_PATH = "/api/parse-bank-pdf";
const MAX_PDF_SIZE = 15 * 1024 * 1024;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function jsonResponse(payload: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

async function handlePdfParseRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ message: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const categoriesRaw = formData.get("categories");
  const examplesRaw = formData.get("examples");
  const rulesRaw = formData.get("rules");

  if (!(file instanceof File)) {
    return jsonResponse({ message: "PDF-файл не найден" }, { status: 400 });
  }

  if (file.size > MAX_PDF_SIZE) {
    return jsonResponse({ message: "PDF слишком большой" }, { status: 413 });
  }

  let categories: TransactionCategory[] = [];
  let examples: FinanceTransactionExample[] = [];
  let rules: FinanceAssistantRule[] = [];
  try {
    const parsedCategories = typeof categoriesRaw === "string" ? JSON.parse(categoriesRaw) : [];
    const parsedExamples = typeof examplesRaw === "string" ? JSON.parse(examplesRaw) : [];
    const parsedRules = typeof rulesRaw === "string" ? JSON.parse(rulesRaw) : [];
    categories = Array.isArray(parsedCategories) ? parsedCategories : [];
    examples = Array.isArray(parsedExamples) ? parsedExamples.slice(0, 1000) : [];
    rules = Array.isArray(parsedRules) ? parsedRules.slice(0, 500) : [];
  } catch {
    return jsonResponse({ message: "Не удалось прочитать список категорий" }, { status: 400 });
  }

  try {
    const { parseBankPdf } = await import("./lib/pdf-bank-parser-v2");
    const result = await parseBankPdf(file, categories, { examples, rules });
    return jsonResponse(result);
  } catch (error) {
    console.error("PDF parse failed", error instanceof Error ? error.message : error);
    const message = error instanceof Error ? error.message : "неизвестная ошибка";
    return jsonResponse({ message }, { status: 500 });
  }
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (url.pathname === PDF_PARSE_PATH) {
        return await handlePdfParseRequest(request);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
