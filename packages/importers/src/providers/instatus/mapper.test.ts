import { describe, expect, it } from "bun:test";
import {
  MOCK_COMPONENTS,
  MOCK_INCIDENTS,
  MOCK_MAINTENANCES,
  MOCK_PAGES,
  MOCK_SUBSCRIBERS,
} from "./fixtures";
import {
  mapComponent,
  mapComponentGroup,
  mapIncidentStatus,
  mapIncidentToStatusReport,
  mapMaintenanceToMaintenance,
  mapPage,
  mapSubscriber,
  partitionComponents,
} from "./mapper";

describe("mapPage", () => {
  it("maps a page with all fields", () => {
    const result = mapPage(MOCK_PAGES[0], 1);
    expect(result).toEqual({
      workspaceId: 1,
      title: "Acme Corp Status",
      description: "",
      slug: "acmecorp",
      customDomain: "status.acmecorp.com",
      published: true,
      icon: "",
    });
  });

  it("handles null customDomain", () => {
    const page = { ...MOCK_PAGES[0], customDomain: null };
    const result = mapPage(page, 1);
    expect(result.customDomain).toBe("");
  });
});

describe("partitionComponents", () => {
  it("separates groups from regular components", () => {
    const result = partitionComponents(MOCK_COMPONENTS);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].id).toBe("in_comp_group_001");
    expect(result.components).toHaveLength(4);
    expect(result.warnings).toHaveLength(0);
  });

  it("returns empty groups when no components reference a group", () => {
    const noGroupComponents = MOCK_COMPONENTS.filter((c) => c.group === null);
    const result = partitionComponents(noGroupComponents);
    expect(result.groups).toHaveLength(0);
    expect(result.components).toHaveLength(noGroupComponents.length);
    expect(result.warnings).toHaveLength(0);
  });

  it("creates synthetic group with warning when group ID not found", () => {
    const components = [
      {
        id: "comp_1",
        name: "Orphaned Component",
        description: null,
        status: "OPERATIONAL" as const,
        order: 0,
        group: "missing_group_id",
        showUptime: true,
        grouped: true,
      },
    ];
    const result = partitionComponents(components);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].id).toBe("missing_group_id");
    expect(result.groups[0].name).toBe("missing_group_id");
    expect(result.components).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("missing_group_id");
  });
});

describe("mapComponentGroup", () => {
  it("maps a group component", () => {
    const group = MOCK_COMPONENTS[0]; // in_comp_group_001
    const result = mapComponentGroup(group, 1, 10);
    expect(result).toEqual({
      workspaceId: 1,
      pageId: 10,
      name: "Core Services",
    });
  });
});

describe("mapComponent", () => {
  it("maps a component with all fields", () => {
    const result = mapComponent(MOCK_COMPONENTS[1], 1, 10);
    expect(result).toEqual({
      workspaceId: 1,
      pageId: 10,
      type: "static",
      monitorId: null,
      name: "API Gateway",
      description: "Main API gateway for all services",
      order: 1,
    });
  });

  it("maps order from component order field", () => {
    const result = mapComponent(MOCK_COMPONENTS[3], 1, 10);
    expect(result.order).toBe(3);
  });
});

describe("mapIncidentStatus", () => {
  it.each([
    ["INVESTIGATING", "investigating"],
    ["IDENTIFIED", "identified"],
    ["MONITORING", "monitoring"],
    ["RESOLVED", "resolved"],
  ] as const)("maps %s to %s", (input, expected) => {
    expect(mapIncidentStatus(input)).toBe(expected);
  });

  it("defaults to investigating for unknown status", () => {
    expect(mapIncidentStatus("UNKNOWN")).toBe("investigating");
  });
});

describe("mapIncidentToStatusReport", () => {
  it("maps a resolved incident with 4 updates", () => {
    const result = mapIncidentToStatusReport(MOCK_INCIDENTS[0], 1, 10);
    expect(result.report.title).toBe("API Gateway Elevated Error Rates");
    expect(result.report.status).toBe("resolved");
    expect(result.report.workspaceId).toBe(1);
    expect(result.report.pageId).toBe(10);
    expect(result.updates).toHaveLength(4);
    expect(result.updates[0].status).toBe("investigating");
    expect(result.updates[1].status).toBe("identified");
    expect(result.updates[2].status).toBe("monitoring");
    expect(result.updates[3].status).toBe("resolved");
    expect(result.sourceComponentIds).toEqual(["in_comp_001"]);
  });

  it("maps an ongoing incident", () => {
    const result = mapIncidentToStatusReport(MOCK_INCIDENTS[1], 1, 10);
    expect(result.report.status).toBe("identified");
    expect(result.updates).toHaveLength(2);
    expect(result.sourceComponentIds).toEqual(["in_comp_003"]);
  });
});

describe("mapMaintenanceToMaintenance", () => {
  it("maps a maintenance with duration", () => {
    const result = mapMaintenanceToMaintenance(MOCK_MAINTENANCES[0], 1, 10);
    expect(result.title).toBe("Scheduled Database Maintenance");
    expect(result.workspaceId).toBe(1);
    expect(result.pageId).toBe(10);
    expect(result.from).toEqual(new Date("2024-06-20T02:00:00.000Z"));
    expect(result.to).toEqual(new Date("2024-06-20T06:00:00.000Z")); // +240 minutes
    expect(result.message).toContain("scheduled database maintenance");
  });

  it("uses same from and to when duration is null", () => {
    const m = { ...MOCK_MAINTENANCES[0], duration: null };
    const result = mapMaintenanceToMaintenance(m, 1, 10);
    expect(result.from).toEqual(result.to);
  });

  it("maps maintenance with multiple updates", () => {
    const result = mapMaintenanceToMaintenance(MOCK_MAINTENANCES[1], 1, 10);
    expect(result.message).toContain("Starting CDN cache purge");
    expect(result.message).toContain("Cache purge completed successfully");
  });
});

describe("mapSubscriber", () => {
  it("maps email subscriber with all components", () => {
    const result = mapSubscriber(MOCK_SUBSCRIBERS[0], 10);
    expect(result).toEqual({
      email: "alice@acmecorp.com",
      pageId: 10,
      confirmed: true,
      sourceComponentIds: [],
    });
  });

  it("maps email subscriber with specific components", () => {
    const result = mapSubscriber(MOCK_SUBSCRIBERS[1], 10);
    expect(result).toEqual({
      email: "bob@acmecorp.com",
      pageId: 10,
      confirmed: true,
      sourceComponentIds: ["in_comp_001", "in_comp_003"],
    });
  });

  it("maps unconfirmed subscriber with confirmed: false", () => {
    const unconfirmed = { ...MOCK_SUBSCRIBERS[0], confirmed: false };
    const result = mapSubscriber(unconfirmed, 10);
    expect(result).toEqual({
      email: "alice@acmecorp.com",
      pageId: 10,
      confirmed: false,
      sourceComponentIds: [],
    });
  });

  it("returns null for phone subscriber", () => {
    expect(mapSubscriber(MOCK_SUBSCRIBERS[2], 10)).toBeNull();
  });

  it("returns null for webhook subscriber", () => {
    expect(mapSubscriber(MOCK_SUBSCRIBERS[3], 10)).toBeNull();
  });

  it("returns null for subscriber with no email/phone/webhook", () => {
    expect(mapSubscriber(MOCK_SUBSCRIBERS[4], 10)).toBeNull();
  });
});
