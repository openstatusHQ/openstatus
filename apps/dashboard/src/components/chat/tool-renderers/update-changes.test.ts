import { describe, expect, it } from "vitest";

import {
  createComponentGroupChanges,
  updateComponentGroupChanges,
} from "./component-group";
import { updateMaintenanceChanges } from "./update-maintenance";
import { updateMonitorChanges } from "./update-monitor";
import { updatePageComponentChanges } from "./update-page-component";
import { updateStatusPageChanges } from "./update-status-page";

// safe because the mappers only read the fields each fixture sets
function as<T>(value: Record<string, unknown>): T {
  return value as T;
}

describe("updateMonitorChanges", () => {
  type Input = Parameters<typeof updateMonitorChanges>[0];

  it("shows only the fields the input carries", () => {
    expect(
      updateMonitorChanges(as<Input>({ monitorId: 12, active: false })),
    ).toEqual([
      { field: "monitorId", after: 12 },
      { field: "active", after: false },
    ]);
  });

  it("keeps relation ids as entity-ref fields", () => {
    expect(
      updateMonitorChanges(
        as<Input>({ monitorId: 12, notificationIds: [3], tagIds: [] }),
      ),
    ).toEqual([
      { field: "monitorId", after: 12 },
      { field: "notificationIds", after: [3] },
      { field: "tagIds", after: [] },
    ]);
  });

  it("appends the dashboard url once applied", () => {
    const rows = updateMonitorChanges(
      as<Input>({ monitorId: 12, name: "API" }),
      as<Parameters<typeof updateMonitorChanges>[1]>({
        id: 12,
        dashboardUrl: "http://localhost:3001/monitors/12/overview",
      }),
    );
    expect(rows.at(-1)).toEqual({
      field: "dashboardUrl",
      after: "http://localhost:3001/monitors/12/overview",
    });
  });
});

describe("updateStatusPageChanges", () => {
  type Input = Parameters<typeof updateStatusPageChanges>[0];

  it("lists the page and the changed fields, then the applied url", () => {
    expect(
      updateStatusPageChanges(as<Input>({ pageId: 3, title: "Acme" }), {
        id: 3,
        slug: "acme",
        title: "Acme",
        url: "https://acme.openstatus.dev",
        dashboardUrl: "",
      }),
    ).toEqual([
      { field: "pageId", after: 3 },
      { field: "title", after: "Acme" },
      { field: "url", after: "https://acme.openstatus.dev" },
    ]);
  });
});

describe("updatePageComponentChanges", () => {
  type Input = Parameters<typeof updatePageComponentChanges>[0];

  it("shows a null groupId so ungrouping is visible", () => {
    expect(
      updatePageComponentChanges(as<Input>({ componentId: 9, groupId: null })),
    ).toEqual([
      { field: "componentId", after: 9 },
      { field: "groupId", after: null },
    ]);
  });

  it("appends the page once applied", () => {
    const rows = updatePageComponentChanges(
      as<Input>({ componentId: 9, name: "API" }),
      { id: 9, pageId: 3, monitorId: 4, name: "API", order: 1, groupId: 2 },
    );
    expect(rows.at(-1)).toEqual({ field: "pageId", after: 3 });
  });
});

describe("component group changes", () => {
  it("defaults defaultOpen to false in the draft and leads with the id when applied", () => {
    type Input = Parameters<typeof createComponentGroupChanges>[0];
    expect(
      createComponentGroupChanges(as<Input>({ pageId: 3, name: "Core" })),
    ).toEqual([
      { field: "pageId", after: 3 },
      { field: "name", after: "Core" },
      { field: "defaultOpen", after: false },
    ]);
    expect(
      createComponentGroupChanges(as<Input>({ pageId: 3, name: "Core" }), {
        id: 2,
        pageId: 3,
        name: "Core",
        defaultOpen: true,
      })[0],
    ).toEqual({ field: "id", after: 2 });
  });

  it("shows only the group fields that change", () => {
    type Input = Parameters<typeof updateComponentGroupChanges>[0];
    expect(
      updateComponentGroupChanges(as<Input>({ groupId: 2, defaultOpen: true })),
    ).toEqual([
      { field: "groupId", after: 2 },
      { field: "defaultOpen", after: true },
    ]);
  });
});

describe("updateMaintenanceChanges", () => {
  type Input = Parameters<typeof updateMaintenanceChanges>[0];

  it("shows the id and only the changed fields", () => {
    expect(
      updateMaintenanceChanges(
        as<Input>({ maintenanceId: 5, to: "2026-05-01T16:00:00Z" }),
      ),
    ).toEqual([
      { field: "maintenanceId", after: 5 },
      { field: "to", after: "2026-05-01T16:00:00Z" },
    ]);
  });
});
