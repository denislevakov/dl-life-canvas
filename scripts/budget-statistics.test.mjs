import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBudgetMonthlyHistory,
  isConfirmedBudgetTransaction,
} from "../src/lib/budget-statistics.ts";

const reviewCategoryId = "cat_review";
const categories = new Map([
  [reviewCategoryId, "Нужно распределить"],
  ["cat_expense_food", "Продукты"],
  ["cat_income_work", "Работа"],
]);

test("review and unknown categories are not confirmed", () => {
  assert.equal(
    isConfirmedBudgetTransaction({ categoryId: reviewCategoryId }, categories, reviewCategoryId),
    false,
  );
  assert.equal(
    isConfirmedBudgetTransaction({ categoryId: "cat_deleted" }, categories, reviewCategoryId),
    false,
  );
  assert.equal(
    isConfirmedBudgetTransaction({ categoryId: "cat_expense_food" }, categories, reviewCategoryId),
    true,
  );
});

test("monthly history contains only categorized operations", () => {
  const history = buildBudgetMonthlyHistory(
    [
      {
        date: "2026-10-05",
        amount: 5_100_000,
        type: "expense",
        categoryId: reviewCategoryId,
      },
      {
        date: "2026-10-06",
        amount: 20_000,
        type: "expense",
        categoryId: "cat_deleted",
      },
      {
        date: "2026-10-07",
        amount: 125_000,
        type: "expense",
        categoryId: "cat_expense_food",
      },
      {
        date: "2026-10-08",
        amount: 600_000,
        type: "income",
        categoryId: "cat_income_work",
      },
      {
        date: "2026-10-09",
        amount: 1_968_100,
        type: "income",
        categoryId: reviewCategoryId,
      },
      {
        date: "2026-10-10",
        amount: 20_000,
        type: "income",
        categoryId: "cat_deleted",
      },
      {
        date: "2026-11-01",
        amount: 30_000,
        type: "expense",
        categoryId: reviewCategoryId,
      },
    ],
    categories,
    reviewCategoryId,
    "2026-07",
  );

  assert.deepEqual(history, [
    {
      monthKey: "2026-10",
      expense: 125_000,
      income: 600_000,
      expenseCategories: [{ name: "Продукты", total: 125_000 }],
      incomeCategories: [{ name: "Работа", total: 600_000 }],
    },
  ]);
});
