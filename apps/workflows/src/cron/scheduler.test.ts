import { Cron, Result } from "effect";
import { describe, expect, test } from "vitest";

import { SCHEDULED_TASKS } from "./scheduler";

describe("SCHEDULED_TASKS", () => {
  test("every expression parses", () => {
    for (const task of SCHEDULED_TASKS) {
      const parsed = Cron.parse(task.expression);
      expect(Result.isSuccess(parsed)).toBe(true);
    }
  });

  test("task names are unique", () => {
    const names = SCHEDULED_TASKS.map((task) => task.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test("incident reminders and SLA misses run every five minutes", () => {
    const task = SCHEDULED_TASKS.find((t) => t.name === "incident-reminders");
    expect(task?.expression).toBe("*/5 * * * *");
  });
});
