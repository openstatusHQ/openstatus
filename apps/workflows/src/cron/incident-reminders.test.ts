import { describe, expect, test } from "vitest";

import { runIncidentSlaAndRemindersTick } from "./incident-reminders";

describe("incident-sla-and-reminders tick", () => {
  test("a failing SLA phase still runs the stale reminders", async () => {
    let reminded = 0;
    const results = await runIncidentSlaAndRemindersTick({
      sla: async () => {
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
