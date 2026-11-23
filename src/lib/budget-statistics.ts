export type BudgetStatisticTransaction = {
  date: string;
  amount: number;
  type: "income" | "expense";
  categoryId: string;
};

export type BudgetHistoryMonth = {
  monthKey: string;
  expense: number;
  income: number;
  expenseCategories: { name: string; total: number }[];
  incomeCategories: { name: string; total: number }[];
};

export function isConfirmedBudgetTransaction(
  transaction: Pick<BudgetStatisticTransaction, "categoryId">,
  categoryNameById: ReadonlyMap<string, string>,
  reviewCategoryId: string,
) {
  return (
    transaction.categoryId !== reviewCategoryId && categoryNameById.has(transaction.categoryId)
  );
}

export function buildBudgetMonthlyHistory(
  transactions: readonly BudgetStatisticTransaction[],
  categoryNameById: ReadonlyMap<string, string>,
  reviewCategoryId: string,
  startMonth: string,
): BudgetHistoryMonth[] {
  const months = new Map<
    string,
    {
      monthKey: string;
      expense: number;
      income: number;
      expenseCategories: Map<string, number>;
      incomeCategories: Map<string, number>;
    }
  >();

  transactions.forEach((transaction) => {
    const monthKey = transaction.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(monthKey) || monthKey < startMonth) return;
    if (!isConfirmedBudgetTransaction(transaction, categoryNameById, reviewCategoryId)) return;

    const categoryName = categoryNameById.get(transaction.categoryId)!;
    const current = months.get(monthKey) ?? {
      monthKey,
      expense: 0,
      income: 0,
      expenseCategories: new Map<string, number>(),
      incomeCategories: new Map<string, number>(),
    };

    if (transaction.type === "expense") {
      current.expense += transaction.amount;
      current.expenseCategories.set(
        categoryName,
        (current.expenseCategories.get(categoryName) ?? 0) + transaction.amount,
      );
    } else {
      current.income += transaction.amount;
      current.incomeCategories.set(
        categoryName,
        (current.incomeCategories.get(categoryName) ?? 0) + transaction.amount,
      );
    }
    months.set(monthKey, current);
  });

  const toRows = (values: ReadonlyMap<string, number>) =>
    Array.from(values.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

  return Array.from(months.values())
    .map((month) => ({
      ...month,
      expenseCategories: toRows(month.expenseCategories),
      incomeCategories: toRows(month.incomeCategories),
    }))
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}
