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
const CLIENT_BOOT_PATH = "/__client-boot";
const MAX_PDF_SIZE = 15 * 1024 * 1024;
const MAX_CLIENT_BOOT_BODY_SIZE = 2_048;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry),
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

async function handleClientBootRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_CLIENT_BOOT_BODY_SIZE) {
    return new Response(null, { status: 413 });
  }

  try {
    const body = (await request.json()) as { stage?: unknown; detail?: unknown };
    const stage =
      typeof body.stage === "string"
        ? body.stage.replace(/[^a-z0-9-]/gi, "").slice(0, 48)
        : "unknown";
    const detail =
      typeof body.detail === "string" ? body.detail.replace(/[\r\n\t]+/g, " ").slice(0, 500) : "";

    console.info(`[client-boot] ${stage}${detail ? `: ${detail}` : ""}`);
  } catch {
    console.info("[client-boot] invalid-report");
  }

  return new Response(null, { status: 204 });
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

async function normalizeHtmlNullBytes(response: Response): Promise<Response> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;

  const body = await response.clone().text();
  if (!body.includes("\0")) return response;

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");

  return new Response(body.replaceAll("\0", "\\u0000"), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (url.pathname === PDF_PARSE_PATH) {
        return await handlePdfParseRequest(request);
      }
      if (url.pathname === CLIENT_BOOT_PATH) {
        return await handleClientBootRequest(request);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalizedResponse = await normalizeCatastrophicSsrResponse(response);
      return await normalizeHtmlNullBytes(normalizedResponse);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
