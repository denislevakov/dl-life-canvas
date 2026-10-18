import assert from "node:assert/strict";
import { test } from "node:test";
import {
  completedCount,
  monthDays,
  monthStats,
  monthWeeks,
  routineItems,
  shiftMonth,
} from "../src/lib/routine-history.ts";
import { routinePeriods } from "../src/lib/routine-periods.ts";

test("Moscow midnight starts a new day and Monday starts a new week", () => {
  assert.deepEqual(routinePeriods(new Date("2026-10-18T20:59:59Z")), {
    day: "2026-10-18",
    week: "2026-10-12",
  });
  assert.deepEqual(routinePeriods(new Date("2026-10-18T21:00:00Z")), {
    day: "2026-10-19",
    week: "2026-10-19",
  });
});
test("calendar handles leap years and year boundaries", () => {
  assert.equal(monthDays("2028-02").length, 29);
  assert.equal(monthDays("2027-02").length, 28);
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2027-01", -1), "2026-12");
});
test("launch day has no completed-day denominator", () => {
  const stats = monthStats({}, "2026-10", "2026-10-13");
  assert.equal(stats.days, 0);
  assert.ok(stats.rules.every((rule) => rule.percent === null));
});
test("exclude today and pre-launch data, count missing completed days", () => {
  const full = { wake: true, nonfiction: true, fiction: true, sleep: true };
  const checks = { "day:2026-10-12": full, "day:2026-10-13": full, "day:2026-10-15": full };
  const stats = monthStats(checks, "2026-10", "2026-10-15");
  assert.equal(stats.days, 2);
  assert.equal(stats.full, 1);
  assert.ok(stats.rules.every((rule) => rule.percent === 50));
  assert.equal(completedCount(checks, "week", "2026-10-12"), 0);
  assert.equal(
    monthStats({ ...checks, "day:2026-10-13": { ...full, wake: false } }, "2026-10", "2026-10-15")
      .full,
    0,
  );
});
test("weekends contain only reading and use separate statistics denominators", () => {
  const full = { wake: true, nonfiction: true, fiction: true, sleep: true };
  const checks = {
    "day:2026-10-16": full,
    "day:2026-10-17": { nonfiction: true, fiction: true },
    "day:2026-10-18": { nonfiction: true, fiction: true },
  };

  assert.deepEqual(
    routineItems("day", "2026-10-17").map(([id]) => id),
    ["nonfiction", "fiction"],
  );
  assert.equal(completedCount({ "day:2026-10-17": full }, "day", "2026-10-17"), 2);

  const stats = monthStats(checks, "2026-10", "2026-10-19");
  assert.equal(stats.days, 6);
  assert.equal(stats.full, 3);
  assert.deepEqual(
    stats.rules.map(({ id, done, total, percent }) => ({ id, done, total, percent })),
    [
      { id: "wake", done: 1, total: 4, percent: 25 },
      { id: "nonfiction", done: 3, total: 6, percent: 50 },
      { id: "fiction", done: 3, total: 6, percent: 50 },
      { id: "sleep", done: 1, total: 4, percent: 25 },
    ],
  );
});
test("weeks overlap month boundaries, exclude future and pre-launch weeks", () => {
  assert.deepEqual(monthWeeks("2026-10", "2026-10-12"), ["2026-10-12"]);
  assert.deepEqual(monthWeeks("2026-11", "2026-11-02"), ["2026-10-26", "2026-11-02"]);
});
