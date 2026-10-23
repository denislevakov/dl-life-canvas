import assert from "node:assert/strict";
import { test } from "node:test";

import { cloudValuesEqual, mergeCloudState } from "../src/lib/cloud-state-sync.ts";

test("compares cloud objects independently of JSON key order", () => {
  assert.equal(
    cloudValuesEqual(
      { project: { id: "p1", title: "Проект" }, active: true },
      { active: true, project: { title: "Проект", id: "p1" } },
    ),
    true,
  );
});

test("merges changes made to different fields on two devices", () => {
  const base = { minIncome: 100, minExpense: 50 };
  const local = { minIncome: 120, minExpense: 50 };
  const remote = { minIncome: 100, minExpense: 60 };

  assert.deepEqual(mergeCloudState(base, local, remote), {
    minIncome: 120,
    minExpense: 60,
  });
});

test("preserves concurrent additions to collections with ids", () => {
  const base = { projects: [{ id: "p1", title: "Первый" }] };
  const local = { projects: [...base.projects, { id: "p2", title: "С телефона" }] };
  const remote = { projects: [...base.projects, { id: "p3", title: "С компьютера" }] };

  assert.deepEqual(
    mergeCloudState(base, local, remote).projects.map(({ id }) => id),
    ["p1", "p2", "p3"],
  );
});

test("merges fields when both devices edited an item created after the common base", () => {
  const base = { projects: [] };
  const local = { projects: [{ id: "p1", title: "С телефона", note: "" }] };
  const remote = { projects: [{ id: "p1", title: "Черновик", note: "С компьютера" }] };

  assert.deepEqual(mergeCloudState(base, local, remote), {
    projects: [{ id: "p1", title: "С телефона", note: "С компьютера" }],
  });
});

test("merges nested edits inside the same project", () => {
  const base = {
    projects: [
      {
        id: "p1",
        title: "Проект",
        actions: [{ id: "a1", title: "Шаг", note: "" }],
      },
    ],
  };
  const local = {
    projects: [
      {
        id: "p1",
        title: "Проект с телефона",
        actions: [{ id: "a1", title: "Шаг", note: "" }],
      },
    ],
  };
  const remote = {
    projects: [
      {
        id: "p1",
        title: "Проект",
        actions: [{ id: "a1", title: "Шаг", note: "Комментарий с компьютера" }],
      },
    ],
  };

  assert.deepEqual(mergeCloudState(base, local, remote).projects[0], {
    id: "p1",
    title: "Проект с телефона",
    actions: [{ id: "a1", title: "Шаг", note: "Комментарий с компьютера" }],
  });
});

test("keeps a deletion when the other device did not change the deleted item", () => {
  const base = { projects: [{ id: "p1", title: "Удалить" }] };
  const local = { projects: [] };
  const remote = structuredClone(base);

  assert.deepEqual(mergeCloudState(base, local, remote), { projects: [] });
});

test("keeps the current device edit when both devices changed the same scalar", () => {
  assert.deepEqual(mergeCloudState({ value: 1 }, { value: 2 }, { value: 3 }), { value: 2 });
});
