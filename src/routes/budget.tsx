import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, ChevronDown, FileText, GripVertical, Plus, Trash2, Upload } from "lucide-react";

import { EditableNumber } from "@/components/EditableNumber";
import { PageContainer, PageHeader } from "@/components/MetricCard";
import { REVIEW_CATEGORY_ID, useCapital, type MoneyTransaction, type MoneyTransactionType } from "@/lib/capital-store";
import { formatMillions, formatRub } from "@/lib/format";

type ParsedPdfResult = {
  transactions: MoneyTransaction[];
  textPreview?: string;
};

export const Route = createFileRoute("/budget")({
  head: () => ({
    meta: [
      { title: "Доход и расходы · LIFE IS GOOD" },
      { name: "description", content: "Баланс, выписки и статьи расходов." },
    ],
  }),
  component: BudgetPage,
});

const todayIso = () => new Date().toISOString().slice(0, 10);

function BudgetPage() {
  const {
    state,
    totals,
    update,
    updateCashAccount,
    transferCashAccountBalance,
    addCashAccount,
    removeCashAccount,
    updateExpense,
    addExpense,
    removeExpense,
    addTransaction,
    importTransactions,
    updateTransaction,
    removeTransaction,
  } = useCapital();

  const categories = state.transactionCategories ?? [];
  const categoryNameById = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const expenseCategories = useMemo(() => categories.filter((category) => category.id.startsWith("cat_expense_")), [categories]);
  const transactions = state.transactions ?? [];
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [newAccountName, setNewAccountName] = useState("");
  const [transferMessage, setTransferMessage] = useState<string | null>(null);
  const [transferDraft, setTransferDraft] = useState({ fromId: "", toId: "", amount: 0 });
  const [draggedExpenseId, setDraggedExpenseId] = useState<string | null>(null);
  const [openExpenseRows, setOpenExpenseRows] = useState<string[]>([]);
  const [draft, setDraft] = useState({
    date: todayIso(),
    description: "",
    amount: 0,
    type: "expense" as MoneyTransactionType,
    categoryId: categories[0]?.id ?? categories.find((category) => category.id === "cat_other")?.id ?? "",
  });

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const currentMonthTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.date.startsWith(currentMonthKey)),
    [currentMonthKey, transactions],
  );
  const reviewTransactions = useMemo(
    () => currentMonthTransactions.filter((transaction) => transaction.categoryId === REVIEW_CATEGORY_ID),
    [currentMonthTransactions],
  );
  const currentMonthExpenses = useMemo(
    () => currentMonthTransactions.filter((transaction) => transaction.type === "expense"),
    [currentMonthTransactions],
  );

  const expenseByCategory = useMemo(() => {
    const rows = new Map<string, { id: string; name: string; total: number; needsReview: boolean; transactions: MoneyTransaction[] }>();

    currentMonthExpenses.forEach((transaction) => {
      const needsReview = transaction.categoryId === REVIEW_CATEGORY_ID || !categoryNameById.has(transaction.categoryId);
      const id = needsReview ? REVIEW_CATEGORY_ID : transaction.categoryId;
      const name = needsReview ? "Нужно распределить" : (categoryNameById.get(transaction.categoryId) ?? "Нужно распределить");
      const current = rows.get(id) ?? { id, name, total: 0, needsReview, transactions: [] };
      rows.set(id, { ...current, total: current.total + transaction.amount, transactions: [...current.transactions, transaction] });
    });

    return Array.from(rows.values()).sort((a, b) => {
      if (a.needsReview !== b.needsReview) return a.needsReview ? 1 : -1;
      return b.total - a.total;
    });
  }, [categoryNameById, currentMonthExpenses]);

  const displayedExpenseTotal = expenseByCategory.reduce((sum, row) => sum + row.total, 0);
  const hiddenExpenseTotal = Math.max(0, totals.monthExpenseTotal - displayedExpenseTotal);
  const maxCategoryTotal = Math.max(...expenseByCategory.map((row) => row.total), hiddenExpenseTotal, 1);
  const monthlyMinimum = totals.monthlyMinimum;
  const scenarios = state.incomeScenarios.map((income) => {
    const surplus = income - monthlyMinimum;
    return {
      income,
      surplus,
      yearly: surplus * 12,
      coverage: monthlyMinimum ? income / monthlyMinimum : 0,
      savingsRate: income ? (surplus / income) * 100 : 0,
    };
  });
  const cashAccounts = state.cashAccounts ?? [];
  const cardCashAccounts = cashAccounts.filter((account) => account.kind === "card" || account.kind === "cash");
  const safetyAccounts = cashAccounts.filter((account) => account.kind === "safety");
  const primaryCardCashAccount = cardCashAccounts[0];
  const primarySafetyAccount = safetyAccounts[0];
  const extraAccounts = cashAccounts.filter(
    (account) => account.id !== primaryCardCashAccount?.id && account.id !== primarySafetyAccount?.id,
  );
  const transferFromAccount = cashAccounts.find((account) => account.id === transferDraft.fromId);
  const canTransfer =
    Boolean(transferDraft.fromId && transferDraft.toId) &&
    transferDraft.fromId !== transferDraft.toId &&
    transferDraft.amount > 0 &&
    Boolean(transferFromAccount && transferFromAccount.balance >= transferDraft.amount);

  useEffect(() => {
    if (!cashAccounts.length) return;
    setTransferDraft((value) => {
      const fromExists = cashAccounts.some((account) => account.id === value.fromId);
      const toExists = cashAccounts.some((account) => account.id === value.toId);
      const first = cashAccounts[0]?.id ?? "";
      const second = cashAccounts.find((account) => account.id !== first)?.id ?? first;
      const nextFromId = fromExists ? value.fromId : first;
      const nextToId = toExists && value.toId !== nextFromId ? value.toId : second;
      if (value.fromId === nextFromId && value.toId === nextToId) return value;
      return { ...value, fromId: nextFromId, toId: nextToId };
    });
  }, [cashAccounts]);

  const setCardCashBalance = (nextBalance: number) => {
    const otherBalance = cardCashAccounts
      .filter((account) => account.id !== primaryCardCashAccount?.id)
      .reduce((sum, account) => sum + account.balance, 0);
    if (primaryCardCashAccount) {
      updateCashAccount(primaryCardCashAccount.id, { name: "Карта / наличные", kind: "card", balance: nextBalance - otherBalance });
      return;
    }
    addCashAccount({ id: `ca_${Date.now()}`, name: "Карта / наличные", kind: "card", balance: nextBalance });
  };

  const setSafetyBalance = (nextBalance: number) => {
    const otherBalance = safetyAccounts
      .filter((account) => account.id !== primarySafetyAccount?.id)
      .reduce((sum, account) => sum + account.balance, 0);
    if (primarySafetyAccount) {
      updateCashAccount(primarySafetyAccount.id, { name: "Подушка безопасности", kind: "safety", balance: nextBalance - otherBalance });
      return;
    }
    addCashAccount({ id: `ca_${Date.now()}`, name: "Подушка безопасности", kind: "safety", balance: nextBalance });
  };

  const addManualTransaction = () => {
    if (!draft.description.trim() || !draft.amount || !draft.categoryId) return;
    addTransaction({
      id: `tx_${Date.now()}`,
      date: draft.date,
      description: draft.description.trim(),
      amount: Math.abs(draft.amount),
      type: draft.type,
      categoryId: draft.categoryId,
      source: "manual",
    });
    setDraft({
      date: todayIso(),
      description: "",
      amount: 0,
      type: "expense",
      categoryId: draft.categoryId,
    });
  };

  const manualCategoryOptions = useMemo(
    () => (draft.type === "income" ? categories.filter((category) => category.id === "cat_income") : expenseCategories),
    [categories, draft.type, expenseCategories],
  );

  useEffect(() => {
    if (!manualCategoryOptions.length || manualCategoryOptions.some((category) => category.id === draft.categoryId)) return;
    setDraft((value) => ({ ...value, categoryId: manualCategoryOptions[0]?.id ?? "" }));
  }, [draft.categoryId, manualCategoryOptions]);

  const addAccount = () => {
    const name = newAccountName.trim();
    if (!name) return;
    addCashAccount({ id: `ca_${Date.now()}`, name, kind: "card", balance: 0 });
    setNewAccountName("");
  };

  const submitTransfer = () => {
    if (!transferDraft.fromId || !transferDraft.toId || transferDraft.fromId === transferDraft.toId) {
      setTransferMessage("Выбери два разных счета.");
      return;
    }
    if (transferDraft.amount <= 0) {
      setTransferMessage("Укажи сумму перевода.");
      return;
    }
    if (!transferFromAccount || transferFromAccount.balance < transferDraft.amount) {
      setTransferMessage("На счете-источнике недостаточно денег.");
      return;
    }
    const toAccount = cashAccounts.find((account) => account.id === transferDraft.toId);
    transferCashAccountBalance(transferDraft.fromId, transferDraft.toId, transferDraft.amount);
    setTransferMessage(`${formatRub(transferDraft.amount)} перенесено: ${transferFromAccount.name} → ${toAccount?.name ?? "другой счет"}.`);
    setTransferDraft((value) => ({ ...value, amount: 0 }));
  };

  const reorderExpenses = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const expenses = [...(state.expenses ?? [])];
    const sourceIndex = expenses.findIndex((expense) => expense.id === sourceId);
    const targetIndex = expenses.findIndex((expense) => expense.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [moved] = expenses.splice(sourceIndex, 1);
    expenses.splice(targetIndex, 0, moved);
    update({ expenses });
    setDraggedExpenseId(null);
  };

  const toggleExpenseRow = (id: string) =>
    setOpenExpenseRows((rows) => (rows.includes(id) ? rows.filter((rowId) => rowId !== id) : [...rows, id]));

  const clearCurrentMonthExpenses = () => {
    if (!currentMonthExpenses.length) return;
    const confirmed = window.confirm("Удалить расходы текущего месяца? После этого можно заново загрузить выписку.");
    if (!confirmed) return;
    currentMonthExpenses.forEach((transaction) => removeTransaction(transaction.id));
    setImportMessage("Расходы текущего месяца очищены. Можно заново загрузить выписку.");
  };

  const handlePdfUpload = async (file: File | undefined) => {
    if (!file) return;
    setImportMessage("Читаю PDF на сервере...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("categories", JSON.stringify(categories));

      const response = await fetch("/api/parse-bank-pdf", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as ParsedPdfResult | { message?: string };
      if (!response.ok) {
        throw new Error("message" in payload && payload.message ? payload.message : "сервер не смог разобрать PDF");
      }

      const result = payload as ParsedPdfResult;
      if (!result.transactions.length) {
        setImportMessage("PDF прочитан, но операции не распознаны. Можно добавить расходы вручную или позже настроить парсер под конкретный банк.");
        return;
      }
      importTransactions(result.transactions);
      setImportMessage(`Импортировано операций: ${result.transactions.length}. Распределение обновилось в статьях расходов.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "неизвестная ошибка";
      setImportMessage(`Не удалось прочитать PDF: ${detail}`);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Баланс и поток"
        title="Доходы / Расходы"
        description="Фактический баланс по счетам, расходы из выписки, ручные корректировки и распределение по статьям."
      />

      <div className="mb-4 grid gap-4 md:grid-cols-4">
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="text-[10px] uppercase tracking-[0.26em] text-muted-foreground">Текущий баланс</div>
          <div className="mt-6 font-display text-5xl tabular text-[color:var(--gold)]">{formatRub(totals.currentBalance)}</div>
          <div className="mt-5 text-sm text-muted-foreground">сумма счетов</div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <div className="text-[10px] uppercase tracking-[0.26em] text-muted-foreground">Карта / наличные</div>
          <div className="mt-6 font-display text-5xl tabular text-foreground">
            <EditableNumber
              value={totals.cardCashBalance}
              editValue={totals.cardCashBaseBalance}
              onChange={setCardCashBalance}
              className="font-display text-5xl"
            />
          </div>
          <div className="mt-5 text-sm text-muted-foreground">доступные деньги</div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <div className="text-[10px] uppercase tracking-[0.26em] text-muted-foreground">Подушка безопасности</div>
          <div className="mt-6 font-display text-5xl tabular text-[color:oklch(0.7_0.1_160)]">
            <EditableNumber value={totals.safetyBalance} onChange={setSafetyBalance} className="font-display text-5xl text-[color:oklch(0.7_0.1_160)]" />
          </div>
          <div className="mt-5 text-sm text-muted-foreground">резерв</div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.26em] text-muted-foreground">
            <Upload className="h-3.5 w-3.5 text-[color:var(--gold)]" /> Выписка PDF
          </div>
          <label className="mt-6 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-[color:var(--surface-elevated)]/40 px-4 py-4 text-sm text-foreground transition-colors hover:border-[color:var(--gold)]/50">
            <FileText className="h-4 w-4 text-[color:var(--gold)]" />
            Загрузить выписку
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                void handlePdfUpload(file);
              }}
            />
          </label>
          <div className="mt-4 text-xs leading-5 text-muted-foreground">расходы меняют баланс карты / наличных</div>
        </section>
      </div>

      {importMessage ? (
        <div className="mb-4 rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{importMessage}</div>
      ) : null}

      <details className="mb-8 rounded-xl border border-border bg-card p-4">
        <summary className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-[color:var(--gold)]">
          Счета и переводы
        </summary>

        <div className="mt-4 rounded-lg border border-border bg-[color:var(--surface-elevated)]/30 p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <ArrowRightLeft className="h-3.5 w-3.5 text-[color:var(--gold)]" />
            Перевод между счетами
          </div>
          <div className="grid gap-2 md:grid-cols-[minmax(160px,1fr)_minmax(160px,1fr)_140px_auto]">
            <select
              value={transferDraft.fromId}
              onChange={(event) => {
                setTransferMessage(null);
                setTransferDraft((value) => ({ ...value, fromId: event.target.value }));
              }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none"
            >
              {cashAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} · {formatRub(account.balance)}
                </option>
              ))}
            </select>
            <select
              value={transferDraft.toId}
              onChange={(event) => {
                setTransferMessage(null);
                setTransferDraft((value) => ({ ...value, toId: event.target.value }));
              }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none"
            >
              {cashAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} · {formatRub(account.balance)}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="100"
              value={transferDraft.amount || ""}
              onChange={(event) => {
                setTransferMessage(null);
                setTransferDraft((value) => ({ ...value, amount: Math.max(0, Number(event.target.value) || 0) }));
              }}
              placeholder="Сумма"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={submitTransfer}
              disabled={!canTransfer}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-[color:var(--surface-elevated)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Перенести
            </button>
          </div>
          {transferMessage ? <div className="mt-3 text-xs text-muted-foreground">{transferMessage}</div> : null}
        </div>

        {extraAccounts.length ? (
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {extraAccounts.map((account) => (
              <div key={account.id} className="rounded-lg border border-border bg-[color:var(--surface-elevated)]/30 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <input
                    value={account.name}
                    onChange={(event) => updateCashAccount(account.id, { name: event.target.value })}
                    className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
                  />
                  <button
                    onClick={() => removeCashAccount(account.id)}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <EditableNumber value={account.balance} onChange={(value) => updateCashAccount(account.id, { balance: value })} className="text-sm" />
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-4 grid gap-2 md:grid-cols-[minmax(180px,1fr)_auto]">
          <input
            value={newAccountName}
            onChange={(event) => setNewAccountName(event.target.value)}
            placeholder="Новый счет"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={addAccount}
            disabled={!newAccountName.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-[color:var(--surface-elevated)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Добавить счет
          </button>
        </div>
      </details>

      <div className="mb-6 grid gap-6 lg:grid-cols-5">
        <section className="rounded-xl border border-border bg-card p-6 lg:col-span-3">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Минимальный сценарий</div>
              <div className="mt-1 font-display text-xl">Расходы в месяц</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Итого</div>
              <div className="font-display text-xl tabular text-[color:var(--gold)]">{formatRub(monthlyMinimum)}</div>
            </div>
          </div>

          <div className="divide-y divide-border">
            {state.expenses.map((expense) => {
              const share = (expense.amount / (monthlyMinimum || 1)) * 100;
              return (
                <div
                  key={expense.id}
                  onDragOver={(event) => {
                    if (draggedExpenseId && draggedExpenseId !== expense.id) event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const sourceId = draggedExpenseId ?? event.dataTransfer.getData("text/plain");
                    if (sourceId) reorderExpenses(sourceId, expense.id);
                  }}
                  onDragEnd={() => setDraggedExpenseId(null)}
                  className={"flex items-center gap-3 py-3 transition-opacity " + (draggedExpenseId === expense.id ? "opacity-50" : "")}
                >
                  <div
                    draggable
                    onDragStart={(event) => {
                      setDraggedExpenseId(expense.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", expense.id);
                    }}
                    onDragEnd={() => setDraggedExpenseId(null)}
                    className="inline-flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-md border border-border text-muted-foreground active:cursor-grabbing"
                    title="Перетащить"
                  >
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <input
                    value={expense.name}
                    onChange={(event) => updateExpense(expense.id, { name: event.target.value })}
                    className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none focus:text-[color:var(--gold)]"
                  />
                  <div className="w-20 text-right text-[11px] tabular text-muted-foreground">{share.toFixed(1)}%</div>
                  <div className="w-36 text-right">
                    <EditableNumber value={expense.amount} onChange={(value) => updateExpense(expense.id, { amount: value })} className="text-sm" />
                  </div>
                  <button
                    onClick={() => removeExpense(expense.id)}
                    className="inline-flex items-center justify-center rounded-md px-2 py-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => addExpense({ id: `e${Date.now()}`, name: "Новая статья", amount: 0 })}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border py-2.5 text-xs text-muted-foreground transition-colors hover:border-[color:var(--gold)]/50 hover:text-[color:var(--gold)]"
          >
            <Plus className="h-3.5 w-3.5" />
            Добавить статью
          </button>
        </section>

        <section className="space-y-3 lg:col-span-2">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Сценарии дохода</div>
          {scenarios.map((scenario) => (
            <div key={scenario.income} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-display text-lg tabular">{formatRub(scenario.income)}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{scenario.coverage.toFixed(1)}x покрытие</div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Остаток</div>
                  <div className="mt-0.5 text-sm tabular text-[color:var(--gold)]">{formatRub(scenario.surplus)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">В год</div>
                  <div className="mt-0.5 text-sm tabular">{formatMillions(scenario.yearly)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Норма</div>
                  <div className="mt-0.5 text-sm tabular">{scenario.savingsRate.toFixed(0)}%</div>
                </div>
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-[color:var(--surface-elevated)]">
                <div className="h-full" style={{ width: `${Math.max(0, Math.min(100, scenario.savingsRate))}%`, background: "var(--gradient-gold)" }} />
              </div>
            </div>
          ))}
        </section>
      </div>

      <section className="mb-6 rounded-xl border border-border bg-card p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Факт за месяц</div>
            <div className="mt-1 font-display text-xl">Расходы по статьям</div>
          </div>
          <div className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground">
            Расходы: <span className="text-foreground">{formatRub(totals.monthExpenseTotal)}</span>
          </div>
        </div>

        <div className="mb-5 grid gap-3 rounded-lg border border-dashed border-border bg-[color:var(--surface-elevated)]/20 p-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="text-sm text-foreground">Обновление факта за месяц</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">Можно очистить расходы текущего месяца и загрузить выписку заново.</div>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-[color:var(--surface-elevated)]">
              <Upload className="h-4 w-4 text-[color:var(--gold)]" />
              Загрузить PDF
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = "";
                  void handlePdfUpload(file);
                }}
              />
            </label>
            <button
              type="button"
              onClick={clearCurrentMonthExpenses}
              disabled={!currentMonthExpenses.length}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Очистить месяц
            </button>
          </div>
        </div>

        {reviewTransactions.length ? (
          <div className="mb-5 rounded-lg border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/5 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--gold)]">Нужно распределить</div>
                <div className="mt-1 text-sm text-muted-foreground">Переводы и операции без понятной статьи</div>
              </div>
              <div className="text-sm tabular text-foreground">{reviewTransactions.length}</div>
            </div>
            <div className="grid gap-2">
              {reviewTransactions.slice(0, 6).map((transaction) => (
                <div key={transaction.id} className="grid gap-2 rounded-md border border-border bg-card/70 p-3 md:grid-cols-[1fr_130px_180px_36px] md:items-center">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-foreground">{transaction.description}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {transaction.date} · {transaction.type === "income" ? "приход" : "расход"}
                    </div>
                  </div>
                  <div className="text-sm tabular text-muted-foreground md:text-right">{formatRub(transaction.amount)}</div>
                  <select
                    value={transaction.categoryId}
                    onChange={(event) =>
                      updateTransaction(transaction.id, {
                        categoryId: event.target.value,
                        type: event.target.value === "cat_income" ? "income" : event.target.value.startsWith("cat_expense_") ? "expense" : transaction.type,
                      })
                    }
                    className="rounded-md border border-input bg-background px-2 py-2 text-xs text-foreground outline-none"
                  >
                    <option value={REVIEW_CATEGORY_ID}>Нужно распределить</option>
                    {categories
                      .filter((category) => category.id === "cat_income")
                      .map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    {expenseCategories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeTransaction(transaction.id)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Удалить операцию"
                    title="Удалить операцию"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            {reviewTransactions.length > 6 ? (
              <div className="mt-3 text-xs text-muted-foreground">Еще {reviewTransactions.length - 6} операций появятся после распределения верхних.</div>
            ) : null}
          </div>
        ) : null}

        {expenseByCategory.length ? (
          <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
            {expenseByCategory.map((row) => {
              const width = Math.max(4, (row.total / maxCategoryTotal) * 100);
              const isOpen = openExpenseRows.includes(row.id);
              return (
                <div key={row.id}>
                  <button
                    type="button"
                    onClick={() => toggleExpenseRow(row.id)}
                    className="mb-1.5 flex w-full items-center justify-between gap-3 text-left text-sm"
                    aria-expanded={isOpen}
                  >
                    <span className={row.needsReview ? "text-[color:var(--gold)]" : "text-foreground"}>{row.name}</span>
                    <span className="inline-flex items-center gap-2 tabular text-muted-foreground">
                      {formatRub(row.total)}
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </span>
                  </button>
                  <div className="h-2 overflow-hidden rounded-full bg-[color:var(--surface-elevated)]">
                    <div className="h-full rounded-full" style={{ width: `${width}%`, background: row.needsReview ? "var(--gold)" : "var(--gradient-gold)" }} />
                  </div>
                  {isOpen ? (
                    <div className="mt-3 grid gap-2 rounded-lg border border-border bg-[color:var(--surface-elevated)]/20 p-2">
                      {row.transactions.map((transaction) => (
                        <div key={transaction.id} className="grid gap-2 rounded-md border border-border bg-card/70 p-2 text-xs md:grid-cols-[1fr_86px_120px_30px] md:items-center">
                          <div className="min-w-0">
                            <div className="truncate text-foreground">{transaction.description}</div>
                            <div className="mt-1 text-muted-foreground">{transaction.date} · {transaction.source === "pdf" ? "PDF" : "вручную"}</div>
                          </div>
                          <div className="tabular text-muted-foreground md:text-right">{formatRub(transaction.amount)}</div>
                          <select
                            value={transaction.categoryId}
                            onChange={(event) =>
                              updateTransaction(transaction.id, {
                                categoryId: event.target.value,
                                type: event.target.value === "cat_income" ? "income" : event.target.value.startsWith("cat_expense_") ? "expense" : transaction.type,
                              })
                            }
                            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground outline-none"
                          >
                            <option value={REVIEW_CATEGORY_ID}>Нужно распределить</option>
                            {expenseCategories.map((category) => (
                              <option key={category.id} value={category.id}>{category.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => removeTransaction(transaction.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Удалить операцию"
                            title="Удалить операцию"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {hiddenExpenseTotal > 0 ? (
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="text-[color:var(--gold)]">Не показано в строках</span>
                  <span className="tabular text-muted-foreground">{formatRub(hiddenExpenseTotal)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[color:var(--surface-elevated)]">
                  <div className="h-full rounded-full bg-[color:var(--gold)]" style={{ width: `${Math.max(4, (hiddenExpenseTotal / maxCategoryTotal) * 100)}%` }} />
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            За текущий месяц расходов пока нет.
          </div>
        )}

        <details className="mt-5 rounded-lg border border-dashed border-border px-3 py-2">
          <summary className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-[color:var(--gold)]">Добавить расход или доход вручную</summary>
          <div className="mt-4 grid gap-3 lg:grid-cols-[130px_minmax(180px,1fr)_120px_140px_150px_auto] lg:items-end">
            <label>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Дата</span>
              <input
                type="date"
                value={draft.date}
                onChange={(event) => setDraft((value) => ({ ...value, date: event.target.value }))}
                className="mt-2 w-full rounded-md border border-input bg-background px-2 py-2 text-xs text-foreground outline-none"
              />
            </label>
            <label>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Описание</span>
              <input
                value={draft.description}
                onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))}
                placeholder="Новый расход"
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            <label>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Тип</span>
              <select
                value={draft.type}
                onChange={(event) => setDraft((value) => ({ ...value, type: event.target.value as MoneyTransactionType }))}
                className="mt-2 w-full rounded-md border border-input bg-background px-2 py-2 text-xs text-foreground outline-none"
              >
                <option value="expense">Расход</option>
                <option value="income">Доход</option>
              </select>
            </label>
            <label>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Сумма</span>
              <input
                type="number"
                min={0}
                value={draft.amount}
                onChange={(event) => setDraft((value) => ({ ...value, amount: Number(event.target.value) || 0 }))}
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none"
              />
            </label>
            <label>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Статья</span>
              <select
                value={draft.categoryId}
                onChange={(event) => setDraft((value) => ({ ...value, categoryId: event.target.value }))}
                className="mt-2 w-full rounded-md border border-input bg-background px-2 py-2 text-xs text-foreground outline-none"
              >
                {manualCategoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
            <button
              onClick={addManualTransaction}
              disabled={!draft.description.trim() || !draft.amount || !draft.categoryId}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Добавить
            </button>
          </div>
        </details>
      </section>

    </PageContainer>
  );
}
