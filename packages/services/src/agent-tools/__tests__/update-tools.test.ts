import { describe, expect, test } from "vitest";
import { ZodObject } from "zod";

import { agentTools, buildAgentSystemPrompt } from "../index";

const updateTools = [
  agentTools.update_monitor,
  agentTools.update_status_page,
  agentTools.update_page_component,
  agentTools.create_component_group,
  agentTools.update_component_group,
  agentTools.update_maintenance,
];

describe("update agent tools", () => {
  test("declare group scopes, approval and the past-tense verb", () => {
    expect(agentTools.update_monitor.scope).toBe("monitors:write");
    expect(agentTools.update_status_page.scope).toBe("pages:write");
    expect(agentTools.update_page_component.scope).toBe("pages:write");
    expect(agentTools.create_component_group.scope).toBe("pages:write");
    expect(agentTools.update_component_group.scope).toBe("pages:write");
    expect(agentTools.update_maintenance.scope).toBe("incidents:write");
    expect(agentTools.get_maintenance.scope).toBe("incidents:read");
    expect(agentTools.get_maintenance.destructive).toBe(false);
    for (const t of updateTools) {
      expect(t.destructive, t.name).toBe(true);
      expect(t.approval?.summarize, t.name).toBeDefined();
    }
    for (const t of updateTools.filter((t) => t.name.startsWith("update_"))) {
      expect(t.approval?.verb, t.name).toBe("updated");
    }
    expect(agentTools.create_component_group.approval?.verb).toBe("created");
  });

  // The MCP adapter needs `.shape`; `.refine` must keep the ZodObject root.
  test("schemas are flat ZodObjects", () => {
    for (const t of [...updateTools, agentTools.get_maintenance]) {
      expect(t.inputSchema, `${t.name} input`).toBeInstanceOf(ZodObject);
      expect(t.outputSchema, `${t.name} output`).toBeInstanceOf(ZodObject);
    }
  });

  test("id-only patches are rejected, single-field patches accepted", () => {
    expect(
      agentTools.update_monitor.inputSchema.safeParse({ monitorId: 1 }).success,
    ).toBe(false);
    expect(
      agentTools.update_monitor.inputSchema.safeParse({
        monitorId: 1,
        active: false,
      }).success,
    ).toBe(true);
    expect(
      agentTools.update_status_page.inputSchema.safeParse({ pageId: 3 })
        .success,
    ).toBe(false);
    expect(
      agentTools.update_status_page.inputSchema.safeParse({
        pageId: 3,
        title: "Acme",
      }).success,
    ).toBe(true);
    expect(
      agentTools.update_page_component.inputSchema.safeParse({ componentId: 9 })
        .success,
    ).toBe(false);
    expect(
      agentTools.update_component_group.inputSchema.safeParse({ groupId: 2 })
        .success,
    ).toBe(false);
    expect(
      agentTools.update_maintenance.inputSchema.safeParse({ maintenanceId: 5 })
        .success,
    ).toBe(false);
    expect(
      agentTools.update_maintenance.inputSchema.safeParse({
        maintenanceId: 5,
        to: "2026-05-01T16:00:00Z",
      }).success,
    ).toBe(true);
  });

  test("update_monitor keeps jobType out and takes relation ids", () => {
    const schema = agentTools.update_monitor.inputSchema;
    const parsed = schema.parse({
      monitorId: 12,
      notificationIds: [3, 4],
      tagIds: [],
    });
    expect(parsed.notificationIds).toEqual([3, 4]);
    expect(parsed.tagIds).toEqual([]);
    expect(schema.safeParse({ monitorId: 12, jobType: "tcp" }).success).toBe(
      false,
    );
  });

  test("update_page_component accepts null to ungroup", () => {
    const parsed = agentTools.update_page_component.inputSchema.parse({
      componentId: 9,
      groupId: null,
    });
    expect(parsed.groupId).toBeNull();
  });

  test("update_status_page normalises the slug like create", () => {
    const parsed = agentTools.update_status_page.inputSchema.parse({
      pageId: 3,
      slug: "Acme-Status",
    });
    expect(parsed.slug).toBe("acme-status");
  });

  test("summaries only carry the fields the input sends", () => {
    const monitor = agentTools.update_monitor.approval?.summarize({
      monitorId: 12,
      active: false,
    });
    expect(monitor?.title).toBe("Update Monitor #12");
    expect(monitor?.lines.map((l) => l.label)).toEqual([
      "Monitor ID",
      "Active",
    ]);
    expect(monitor?.lines[1]?.value).toBe("no (pause)");

    const linked = agentTools.update_monitor.approval?.summarize({
      monitorId: 12,
      notificationIds: [3, 4],
      tagIds: [],
    });
    expect(linked?.lines.map((l) => [l.label, l.value])).toEqual([
      ["Monitor ID", "12"],
      ["Notifications", "3, 4"],
      ["Tags", "(clear all)"],
    ]);

    const config = agentTools.update_monitor.approval?.summarize({
      monitorId: 12,
      headers: [{ key: "x-a", value: "1" }],
      body: "",
      assertions: [
        { type: "status", compare: "eq", target: 200 },
        { type: "status", compare: "eq", target: 201 },
      ],
      timeout: 5000,
      degradedAfter: null,
    } as Parameters<
      NonNullable<typeof agentTools.update_monitor.approval>["summarize"]
    >[0]);
    expect(config?.lines.map((l) => [l.label, l.value])).toEqual([
      ["Monitor ID", "12"],
      ["Headers", "x-a"],
      ["Body", "(cleared)"],
      ["Assertions", "2 (status)"],
      ["Timeout", "5000 ms"],
      ["Degraded after", "cleared"],
    ]);

    const page = agentTools.update_status_page.approval?.summarize({
      pageId: 3,
      title: "Acme",
    });
    expect(page?.lines[0]?.ref).toEqual({ kind: "page", pageId: 3 });
    expect(page?.lines.map((l) => l.label)).toEqual(["Page ID", "Title"]);

    const component = agentTools.update_page_component.approval?.summarize({
      componentId: 9,
      groupId: null,
    });
    expect(component?.lines[0]?.ref).toEqual({
      kind: "components",
      componentIds: [9],
    });
    expect(component?.lines[1]).toEqual({
      label: "Group ID",
      value: "(ungroup)",
    });

    const group = agentTools.create_component_group.approval?.summarize({
      pageId: 3,
      name: "Core",
    });
    expect(group?.title).toBe("Create Component Group: Core");
    expect(group?.lines[0]?.ref).toEqual({ kind: "page", pageId: 3 });

    const maintenance = agentTools.update_maintenance.approval?.summarize({
      maintenanceId: 5,
      to: "2026-05-01T16:00:00Z",
      pageComponentIds: [1, 2],
    });
    expect(maintenance?.lines.map((l) => l.label)).toEqual([
      "Maintenance ID",
      "To",
      "Components",
    ]);
    expect(maintenance?.lines[2]?.ref).toEqual({
      kind: "components",
      componentIds: [1, 2],
    });
  });

  test("prompt carries the read-before-write rule and names the tools", () => {
    const prompt = buildAgentSystemPrompt({
      workspaceName: "Test",
      surface: "dashboard",
      canNotifySubscribers: true,
    });
    expect(prompt).toContain("Read before you write");
    expect(prompt).toContain("Never resend a whole object from memory");
    for (const t of [...updateTools, agentTools.get_maintenance]) {
      expect(prompt, t.name).toContain(t.name);
    }
  });
});
