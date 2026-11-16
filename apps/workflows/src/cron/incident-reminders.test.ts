import { describe, expect, test } from "vitest";

import { runIncidentTargetAndRemindersTick } from "./incident-reminders";

describe("incident-target-and-reminders tick", () => {
  test("a failing target phase still runs the stale reminders", async () => {
    let reminded = 0;
    const results = await runIncidentTargetAndRemindersTick({
      targets: async () => {
        throw new Error("libsql timeout");
      },
      reminders: async () => {
        reminded++;
        return [];
      },
    });
    expect(reminded).toBe(1);
    expect(results).toEqual([]);
  });
});
