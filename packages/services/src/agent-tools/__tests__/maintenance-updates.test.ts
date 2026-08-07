import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { agentTools, buildAgentSystemPrompt } from "../index";

describe("maintenance update agent tools", () => {
  test("registers write-scoped CRUD tools", () => {
    expect(agentTools.add_maintenance_update.scope).toBe("write");
    expect(agentTools.update_maintenance_update.scope).toBe("write");
    expect(agentTools.delete_maintenance_update.scope).toBe("write");
  });

  test("requires an explicit notify decision when adding an update", () => {
    expect(
      agentTools.add_maintenance_update.inputSchema.safeParse({
        maintenanceId: 1,
        message: "Update",
      }).success,
    ).toBe(false);
    expect(
      agentTools.add_maintenance_update.inputSchema.safeParse({
        maintenanceId: 1,
        message: "Update",
        notify: false,
      }).success,
    ).toBe(true);
  });

  test("includes maintenance updates in notification guidance", () => {
    const prompt = buildAgentSystemPrompt({
      workspaceName: "Test",
      surface: "dashboard",
      canNotifySubscribers: true,
    });
    expect(prompt).toContain("add_maintenance_update");
    expect(prompt).toContain("Should I notify subscribers? yes/no");
  });
});
