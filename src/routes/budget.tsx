import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileText, Plus, Trash2, Upload } from "lucide-react";

import { EditableNumber } from "@/components/EditableNumber";
import { MetricCard, PageContainer, PageHeader } from "@/components/MetricCard";
import { useCapital, type CashAccountKind, type MoneyTransactionType } from "@/lib/capital-store";
import { formatMillions, formatRub } from "@/lib/format";

export const Route = createFileRoute("/budget")({
  head: () => ({
    meta: [
      { title: "Доход и расходы · LIFE IS GOOD" },
      { name: "description", content: "Баланс, выписки и статьи расходов." },
    ],
  }),
  component: BudgetPage,
});

const accountKindLabels: Record<CashAccountKind, string> = {
  card: "Карта",
  cash: "Наличные",
  safety: "Подушка",
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const monthLabel = () => new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(new Date());

function BudgetPage() {
  const {
    state,
    totals,
    updateCashAccount,
    addCashAccount,
    removeCashAccount,
    updateExpense,
    addExpense,
    removeExpense,
    addTransaction,
    importTransactions,
    addTransactionCategory,
    updateTransactionCategory,
    removeTransactionCategory,
  } = useCapital();

  const categories = state.transactionCategories ?? [];
  const transactions = state.transactions ?? [];
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountKind, setNewAccountKind] = useState<CashAccountKind>("card");
  const [draft, setDraft] = useState({
    date: todayIso(),
    description: "",
    amount: 0,
    type: "expense" as MoneyTransactionType,
    categoryId: categories[0]?.id ?? categories.find((category) => category.id === "cat_other")?.id ?? "",
  });

  const expenseByCategory = useMemo(() => {
    const monthKey = new Date().toISOString().slice(0, 7);
    const rows = categories.map((category) => ({
      category,
      total: transactions
        .filter((transaction) => transaction.type === "expense" && transaction.categoryId === category.id && transaction.date.startsWith(monthKey))
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    }));
    return rows.filter((row) => row.total > 0).sort((a, b) => b.total - a.total);
  }, [categories, transactions]);

  const maxCategoryTotal = Math.max(...expenseByCategory.map((row) => row.total), 1);
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

  const addCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    const category = { id: `cat_${Date.now()}`, name };
    addTransactionCategory(category);
    setDraft((value) => ({ ...value, categoryId: category.id }));
    setNewCategoryName("");
  };

  const addAccount = () => {
    const name = newAccountName.trim();
    if (!name) return;
    addCashAccount({ id: `ca_${Date.now()}`, name, kind: newAccountKind, balance: 0 });
    setNewAccountName("");
  };

  const handlePdfUpload = async (file: File | undefined) => {
    if (!file) return;
    setImportMessage("Читаю PDF локально в браузере...");
    try {
      const { parseBankPdf } = await import("@/lib/pdf-bank-parser");
      const result = await parseBankPdf(file, categories);
      if (!result.transactions.length) {
        setImportMessage("PDF прочитан, но операции не распознаны. Можно добавить расходы вручную или позже настроить парсер под конкретный банк.");
        return;
      }
      importTransactions(result.transactions);
      setImportMessage(`Импортировано операций: ${result.transactions.length}. Распределение обновилось в статьях расходов.`);
    } catch {
      setImportMessage("Не удалось прочитать PDF. Попробуй другую выписку или добавь операции вручную.");
    }
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Баланс и поток"
        title="Доходы / Расходы"
        description="Фактический баланс по счетам, расходы из выписки, ручные корректировки и распределение по статьям."
      />

      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <MetricCard label="Текущий баланс" value={formatRub(totals.currentBalance)} sublabel="сумма счетов" accent="gold" />
        <MetricCard label="Карта / наличные" value={formatRub(totals.cardCashBalance)} sublabel="доступные деньги" />
        <MetricCard label="Подушка" value={formatRub(totals.safetyBalance)} sublabel="резерв" accent="green" />
        <MetricCard label="Расходы за месяц" value={formatRub(totals.monthExpenseTotal)} sublabel={monthLabel()} />
      </div>

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
                <div key={expense.id} className="flex items-center gap-3 py-3">
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

      <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Баланс</div>
              <div className="mt-1 font-display text-xl">{formatRub(totals.currentBalance)}</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-right text-xs md:grid-cols-3">
              <div>
                <div className="text-muted-foreground">Карта / наличные</div>
                <div className="mt-1 tabular text-foreground">{formatRub(totals.cardCashBalance)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Подушка</div>
                <div className="mt-1 tabular text-foreground">{formatRub(totals.safetyBalance)}</div>
              </div>
              <div className="hidden md:block">
                <div className="text-muted-foreground">Расходы</div>
                <div className="mt-1 tabular text-foreground">{formatRub(totals.monthExpenseTotal)}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            {(state.cashAccounts ?? []).map((account) => (
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
                <div className="grid grid-cols-[1fr_1.2fr] gap-2">
                  <select
                    value={account.kind}
                    onChange={(event) => updateCashAccount(account.id, { kind: event.target.value as CashAccountKind })}
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground outline-none"
                  >
                    {Object.entries(accountKindLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <EditableNumber value={account.balance} onChange={(value) => updateCashAccount(account.id, { balance: value })} className="text-sm" />
                </div>
              </div>
            ))}
          </div>

          <details className="mt-3 rounded-lg border border-dashed border-border px-3 py-2">
            <summary className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-[color:var(--gold)]">Добавить счет</summary>
            <div className="mt-3 grid gap-2 md:grid-cols-[minmax(160px,1fr)_130px_auto]">
              <input
                value={newAccountName}
                onChange={(event) => setNewAccountName(event.target.value)}
                placeholder="Новый счет"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <select
                value={newAccountKind}
                onChange={(event) => setNewAccountKind(event.target.value as CashAccountKind)}
                className="rounded-md border border-input bg-background px-2 py-2 text-xs text-foreground outline-none"
              >
                {Object.entries(accountKindLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <button
                onClick={addAccount}
                disabled={!newAccountName.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-[color:var(--surface-elevated)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Добавить
              </button>
            </div>
          </details>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[color:var(--gold)]">
            <Upload className="h-3.5 w-3.5" /> Выписка PDF
          </div>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-[color:var(--surface-elevated)]/40 px-4 py-3 text-sm text-foreground transition-colors hover:border-[color:var(--gold)]/50">
            <FileText className="h-4 w-4 text-[color:var(--gold)]" />
            Загрузить выписку
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(event) => void handlePdfUpload(event.target.files?.[0])}
            />
          </label>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">Файл читается локально и не отправляется на сервер.</p>
          {importMessage ? (
            <div className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-xs leading-5 text-muted-foreground">{importMessage}</div>
          ) : null}
        </section>
      </div>

      <section className="mb-6 rounded-xl border border-border bg-card p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Факт за месяц</div>
            <div className="mt-1 font-display text-xl">Расходы по статьям</div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            Доходы: <span className="text-foreground">{formatRub(totals.monthIncomeTotal)}</span>
          </div>
        </div>

        {expenseByCategory.length ? (
          <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
            {expenseByCategory.map((row) => {
              const width = Math.max(4, (row.total / maxCategoryTotal) * 100);
              return (
                <div key={row.category.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                    <span className="text-foreground">{row.category.name}</span>
                    <span className="tabular text-muted-foreground">{formatRub(row.total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[color:var(--surface-elevated)]">
                    <div className="h-full rounded-full" style={{ width: `${width}%`, background: "var(--gradient-gold)" }} />
                  </div>
                </div>
              );
            })}
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
                {categories.map((category) => (
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

      <details className="rounded-xl border border-border bg-card p-5">
        <summary className="cursor-pointer list-none">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Справочник</div>
              <div className="mt-1 font-display text-xl">Статьи расходов</div>
            </div>
            <div className="text-xs text-muted-foreground">Раскрыть</div>
          </div>
        </summary>

        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center gap-2 rounded-md border border-border bg-[color:var(--surface-elevated)]/40 p-2">
              <input
                value={category.name}
                onChange={(event) => updateTransactionCategory(category.id, { name: event.target.value })}
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
              />
              <button
                onClick={() => removeTransactionCategory(category.id)}
                className="rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-[minmax(160px,1fr)_auto]">
          <input
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            placeholder="Новая статья"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={addCategory}
            disabled={!newCategoryName.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-[color:var(--surface-elevated)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Добавить
          </button>
        </div>
      </details>
    </PageContainer>
  );
}
