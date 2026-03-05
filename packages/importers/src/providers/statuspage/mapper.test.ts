import { describe, expect, it } from "bun:test";
import {
  MOCK_COMPONENTS,
  MOCK_COMPONENT_GROUPS,
  MOCK_INCIDENTS,
  MOCK_PAGES,
  MOCK_SUBSCRIBERS,
} from "./fixtures";
import {
  isScheduledIncident,
  mapComponent,
  mapComponentGroup,
  mapIncidentToMaintenance,
  mapIncidentToStatusReport,
  mapIncidentUpdateStatus,
  mapPage,
  mapSubscriber,
} from "./mapper";

describe("mapPage", () => {
  it("maps a page with all fields", () => {
    const result = mapPage(MOCK_PAGES[0], 1);
    expect(result).toEqual({
      workspaceId: 1,
      title: "Acme Corp Status",
      description: "Current status and incidents for Acme Corp services",
      slug: "acmecorp",
      customDomain: "status.acmecorp.com",
      published: true,
      icon: "",
    });
  });

  it("handles null domain", () => {
    const page = { ...MOCK_PAGES[0], domain: null };
    const result = mapPage(page, 1);
    expect(result.customDomain).toBe("");
  });
});

describe("mapComponent", () => {
  it("maps a component with all fields", () => {
    const result = mapComponent(MOCK_COMPONENTS[0], 1, 10);
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

  it("maps position to order", () => {
    const result = mapComponent(MOCK_COMPONENTS[2], 1, 10);
    expect(result.order).toBe(3);
  });
});

describe("mapComponentGroup", () => {
  it("maps a component group", () => {
    const result = mapComponentGroup(MOCK_COMPONENT_GROUPS[0], 1, 10);
    expect(result).toEqual({
      workspaceId: 1,
      pageId: 10,
      name: "Core Services",
    });
  });
});

describe("isScheduledIncident", () => {
  it("returns true for scheduled incidents", () => {
    expect(isScheduledIncident(MOCK_INCIDENTS[2])).toBe(true);
  });

  it("returns false for realtime incidents", () => {
    expect(isScheduledIncident(MOCK_INCIDENTS[0])).toBe(false);
    expect(isScheduledIncident(MOCK_INCIDENTS[1])).toBe(false);
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
    expect(result.sourceComponentIds).toEqual(["sp_comp_001"]);
  });

  it("maps an ongoing incident", () => {
    const result = mapIncidentToStatusReport(MOCK_INCIDENTS[1], 1, 10);
    expect(result.report.status).toBe("identified");
    expect(result.updates).toHaveLength(2);
    expect(result.sourceComponentIds).toEqual(["sp_comp_003"]);
  });

  it("appends postmortem to last update", () => {
    const result = mapIncidentToStatusReport(MOCK_INCIDENTS[0], 1, 10);
    const lastUpdate = result.updates[result.updates.length - 1];
    expect(lastUpdate.message).toContain("---\n\n**Postmortem**\n\n");
    expect(lastUpdate.message).toContain("## Summary");
  });
});

describe("mapIncidentUpdateStatus", () => {
  it.each([
    ["investigating", "investigating"],
    ["identified", "identified"],
    ["monitoring", "monitoring"],
    ["resolved", "resolved"],
    ["scheduled", "investigating"],
    ["in_progress", "investigating"],
    ["verifying", "monitoring"],
    ["completed", "resolved"],
  ] as const)("maps %s to %s", (input, expected) => {
    expect(mapIncidentUpdateStatus(input)).toBe(expected);
  });
});

describe("mapIncidentToMaintenance", () => {
  it("maps a scheduled incident to maintenance", () => {
    const result = mapIncidentToMaintenance(MOCK_INCIDENTS[2], 1, 10);
    expect(result.title).toBe("Scheduled Database Maintenance");
    expect(result.workspaceId).toBe(1);
    expect(result.pageId).toBe(10);
    expect(result.from).toEqual(new Date("2024-06-20T02:00:00.000Z"));
    expect(result.to).toEqual(new Date("2024-06-20T06:00:00.000Z"));
    expect(result.message).toContain("scheduled database maintenance");
  });
});

describe("mapSubscriber", () => {
  it("maps email subscriber", () => {
    const result = mapSubscriber(MOCK_SUBSCRIBERS[0], 10);
    expect(result).toEqual({
      email: "alice@acmecorp.com",
      pageId: 10,
      channelType: "email",
      webhookUrl: null,
    });
  });

  it("maps webhook subscriber", () => {
    const result = mapSubscriber(MOCK_SUBSCRIBERS[2], 10);
    expect(result).toEqual({
      email: "webhook@imported.openstatus.dev",
      pageId: 10,
      channelType: "webhook",
      webhookUrl: "https://hooks.acmecorp.com/statuspage",
    });
  });

  it("returns null for sms subscriber", () => {
    expect(mapSubscriber(MOCK_SUBSCRIBERS[3], 10)).toBeNull();
  });

  it("returns null for slack subscriber", () => {
    expect(mapSubscriber(MOCK_SUBSCRIBERS[4], 10)).toBeNull();
  });
});
