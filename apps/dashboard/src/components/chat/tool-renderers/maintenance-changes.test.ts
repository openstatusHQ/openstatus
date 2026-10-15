import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { createMaintenanceChanges } from "./create-maintenance";
import {
  addMaintenanceUpdateChanges,
  deleteMaintenanceUpdateChanges,
  updateMaintenanceUpdateChanges,
} from "./maintenance-update";

// safe because the mappers only read the fields each fixture sets
function asInput<T>(value: Record<string, unknown>): T {
  return value as T;
}

describe("createMaintenanceChanges", () => {
  const input = asInput<Parameters<typeof createMaintenanceChanges>[0]>({
    title: "DB upgrade",
    message: "Short downtime",
    from: "2024-01-01T00:00:00Z",
    to: "2024-01-01T01:00:00Z",
    pageId: 1,
    pageComponentIds: [2, 3],
    notify: true,
  });

  it("lists every field in a fixed order", () => {
    expect(createMaintenanceChanges(input)).toEqual([
      { field: "title", after: "DB upgrade" },
      { field: "message", after: "Short downtime" },
      { field: "from", after: "2024-01-01T00:00:00Z" },
      { field: "to", after: "2024-01-01T01:00:00Z" },
      { field: "pageId", after: 1 },
      { field: "pageComponentIds", after: [2, 3] },
      { field: "notify", after: true },
    ]);
  });

  it("prefers the applied notify flag", () => {
    const rows = createMaintenanceChanges(input, { id: 1, notified: false });
    expect(rows.at(-1)).toEqual({ field: "notify", after: false });
  });
});

describe("addMaintenanceUpdateChanges", () => {
  type Input = Parameters<typeof addMaintenanceUpdateChanges>[0];

  it("omits the id and date for a draft without a date", () => {
    expect(
      addMaintenanceUpdateChanges(
        asInput<Input>({ maintenanceId: 4, message: "Started", notify: true }),
      ),
    ).toEqual([
      { field: "maintenanceId", after: 4 },
      { field: "message", after: "Started" },
      { field: "notify", after: true },
    ]);
  });

  it("leads with the applied id and uses the applied notify flag", () => {
    expect(
      addMaintenanceUpdateChanges(
        asInput<Input>({
          maintenanceId: 4,
          message: "Started",
          date: "2024-01-01T00:00:00Z",
          notify: true,
        }),
        { id: 11, notified: false },
      ),
    ).toEqual([
      { field: "id", after: 11 },
      { field: "maintenanceId", after: 4 },
      { field: "message", after: "Started" },
      { field: "date", after: "2024-01-01T00:00:00Z" },
      { field: "notify", after: false },
    ]);
  });
});

describe("updateMaintenanceUpdateChanges", () => {
  type Input = Parameters<typeof updateMaintenanceUpdateChanges>[0];

  it("lists only the provided fields", () => {
    expect(updateMaintenanceUpdateChanges(asInput<Input>({ id: 3 }))).toEqual([
      { field: "id", after: 3 },
    ]);
    expect(
      updateMaintenanceUpdateChanges(
        asInput<Input>({ id: 3, message: "Edited", date: "2024-01-01" }),
      ),
    ).toEqual([
      { field: "id", after: 3 },
      { field: "message", after: "Edited" },
      { field: "date", after: "2024-01-01" },
    ]);
  });
});

describe("deleteMaintenanceUpdateChanges", () => {
  it("shows the id as removed", () => {
    const rows = deleteMaintenanceUpdateChanges(
      asInput<Parameters<typeof deleteMaintenanceUpdateChanges>[0]>({ id: 8 }),
    );
    expect(rows).toEqual([{ field: "id", before: 8 }]);
    expect("after" in rows[0]).toBe(false);
  });
});
