import { describe, expect, test } from "@openstatus/test-utils";
import { Cron, Result } from "effect";

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
});
