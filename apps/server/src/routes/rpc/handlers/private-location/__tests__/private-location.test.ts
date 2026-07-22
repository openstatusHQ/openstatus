import { db, eq } from "@openstatus/db";
import {
  monitor,
  privateLocation,
  privateLocationToMonitors,
  workspace,
} from "@openstatus/db/src/schema";
import { getLimits } from "@openstatus/db/src/schema/plan/utils";
import { expect } from "@std/expect";
import { afterAll, beforeAll, describe, test } from "@std/testing/bdd";
import { nanoid } from "nanoid";

import { app } from "../../../../../index";

async function connectRequest(
  method: string,
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  return app.request(
    `/rpc/openstatus.private_location.v1.PrivateLocationService/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    },
  );
}

const TEST_PREFIX = "rpc-private-location-test";

// Scoped to a dedicated workspace so parallel suites mutating the shared seed
// workspace can't delete our fixtures mid-run. In test, `validateKey` maps
// `x-openstatus-key` to the workspace id.
let entitledWorkspaceId: number;
let authKey: string;
let freeWorkspaceId: number;
let freeAuthKey: string;

let testMonitorId: number;
let secondMonitorId: number;
let deletedMonitorId: number;
let foreignMonitorId: number;

let testLocationId: number;
let locationToUpdateId: number;
let locationToDeleteId: number;

const mkWorkspace = async (
  plan: "team" | "free",
  privateLocations: boolean,
) => {
  const limits = { ...getLimits(plan), "private-locations": privateLocations };
  const row = await db
    .insert(workspace)
    .values({
      slug: `${TEST_PREFIX}-ws-${nanoid(8)}`,
      name: `${TEST_PREFIX}-workspace`,
      plan,
      limits: JSON.stringify(limits),
    })
    .returning()
    .get();
  return row.id;
};

const mkMonitor = async (
  name: string,
  workspaceId: number,
  deleted?: boolean,
) => {
  const row = await db
    .insert(monitor)
    .values({
      name,
      workspaceId,
      url: "https://example.com",
      periodicity: "10m",
      deletedAt: deleted ? new Date() : null,
    })
    .returning()
    .get();
  return row.id;
};

const mkLocation = async (name: string, workspaceId: number) => {
  const row = await db
    .insert(privateLocation)
    .values({ name, token: `token-${nanoid(8)}`, workspaceId })
    .returning()
    .get();
  return row.id;
};

beforeAll(async () => {
  entitledWorkspaceId = await mkWorkspace("team", true);
  authKey = String(entitledWorkspaceId);

  freeWorkspaceId = await mkWorkspace("free", false);
  freeAuthKey = String(freeWorkspaceId);

  testMonitorId = await mkMonitor(
    `${TEST_PREFIX}-monitor`,
    entitledWorkspaceId,
  );
  secondMonitorId = await mkMonitor(
    `${TEST_PREFIX}-monitor-2`,
    entitledWorkspaceId,
  );
  deletedMonitorId = await mkMonitor(
    `${TEST_PREFIX}-monitor-deleted`,
    entitledWorkspaceId,
    true,
  );
  foreignMonitorId = await mkMonitor(
    `${TEST_PREFIX}-monitor-foreign`,
    freeWorkspaceId,
  );

  testLocationId = await mkLocation(`${TEST_PREFIX}-main`, entitledWorkspaceId);
  await db
    .insert(privateLocationToMonitors)
    .values({ privateLocationId: testLocationId, monitorId: testMonitorId });

  locationToUpdateId = await mkLocation(
    `${TEST_PREFIX}-to-update`,
    entitledWorkspaceId,
  );
  await db.insert(privateLocationToMonitors).values({
    privateLocationId: locationToUpdateId,
    monitorId: testMonitorId,
  });

  locationToDeleteId = await mkLocation(
    `${TEST_PREFIX}-to-delete`,
    entitledWorkspaceId,
  );
});

afterAll(async () => {
  for (const id of [entitledWorkspaceId, freeWorkspaceId]) {
    await db.delete(privateLocation).where(eq(privateLocation.workspaceId, id));
    await db.delete(monitor).where(eq(monitor.workspaceId, id));
    await db.delete(workspace).where(eq(workspace.id, id));
  }
});

describe("PrivateLocationService.CreatePrivateLocation", () => {
  test("creates a private location with a server-generated token", async () => {
    const res = await connectRequest(
      "CreatePrivateLocation",
      {
        name: `${TEST_PREFIX}-created`,
        monitorIds: [String(testMonitorId)],
      },
      { "x-openstatus-key": authKey },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("privateLocation");
    expect(data.privateLocation.name).toBe(`${TEST_PREFIX}-created`);
    expect(data.privateLocation.token).toBeTruthy();
    expect(data.privateLocation.monitorIds).toContain(String(testMonitorId));

    await db
      .delete(privateLocation)
      .where(eq(privateLocation.id, Number(data.privateLocation.id)));
  });

  test("generates a distinct token per location", async () => {
    const mk = async (name: string) => {
      const res = await connectRequest(
        "CreatePrivateLocation",
        { name },
        { "x-openstatus-key": authKey },
      );
      expect(res.status).toBe(200);
      return await res.json();
    };

    const a = await mk(`${TEST_PREFIX}-token-a`);
    const b = await mk(`${TEST_PREFIX}-token-b`);

    expect(a.privateLocation.token).not.toBe(b.privateLocation.token);

    for (const data of [a, b]) {
      await db
        .delete(privateLocation)
        .where(eq(privateLocation.id, Number(data.privateLocation.id)));
    }
  });

  test("ignores a caller-supplied token", async () => {
    const res = await connectRequest(
      "CreatePrivateLocation",
      { name: `${TEST_PREFIX}-ignores-token`, token: "attacker-chosen" },
      { "x-openstatus-key": authKey },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.privateLocation.token).not.toBe("attacker-chosen");

    await db
      .delete(privateLocation)
      .where(eq(privateLocation.id, Number(data.privateLocation.id)));
  });

  test("returns 403 for a workspace without the entitlement", async () => {
    const res = await connectRequest(
      "CreatePrivateLocation",
      { name: `${TEST_PREFIX}-not-entitled` },
      { "x-openstatus-key": freeAuthKey },
    );

    expect(res.status).toBe(403);
  });

  test("returns 403 for a monitor in another workspace", async () => {
    const res = await connectRequest(
      "CreatePrivateLocation",
      {
        name: `${TEST_PREFIX}-foreign-monitor`,
        monitorIds: [String(foreignMonitorId)],
      },
      { "x-openstatus-key": authKey },
    );

    expect(res.status).toBe(403);
  });

  test("returns 403 for a soft-deleted monitor", async () => {
    const res = await connectRequest(
      "CreatePrivateLocation",
      {
        name: `${TEST_PREFIX}-deleted-monitor`,
        monitorIds: [String(deletedMonitorId)],
      },
      { "x-openstatus-key": authKey },
    );

    expect(res.status).toBe(403);
  });

  test("returns 400 when name is empty", async () => {
    const res = await connectRequest(
      "CreatePrivateLocation",
      { name: "" },
      { "x-openstatus-key": authKey },
    );

    expect(res.status).toBe(400);
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("CreatePrivateLocation", {
      name: `${TEST_PREFIX}-unauth`,
    });

    expect(res.status).toBe(401);
  });
});

describe("PrivateLocationService.GetPrivateLocation", () => {
  test("returns the location including its token", async () => {
    const res = await connectRequest(
      "GetPrivateLocation",
      { id: String(testLocationId) },
      { "x-openstatus-key": authKey },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.privateLocation.id).toBe(String(testLocationId));
    expect(data.privateLocation.name).toBe(`${TEST_PREFIX}-main`);
    expect(data.privateLocation.token).toBeTruthy();
    expect(data.privateLocation.monitorIds).toContain(String(testMonitorId));
    expect(data.privateLocation.createdAt).toBeTruthy();
  });

  test("returns 404 for a non-existent id", async () => {
    const res = await connectRequest(
      "GetPrivateLocation",
      { id: "99999999" },
      { "x-openstatus-key": authKey },
    );

    expect(res.status).toBe(404);
    expect(res.headers.get("error-reason")).toBe("PRIVATE_LOCATION_NOT_FOUND");
  });

  test("returns 404 for a location in another workspace", async () => {
    const foreignId = await mkLocation(
      `${TEST_PREFIX}-foreign`,
      freeWorkspaceId,
    );

    const res = await connectRequest(
      "GetPrivateLocation",
      { id: String(foreignId) },
      { "x-openstatus-key": authKey },
    );

    expect(res.status).toBe(404);

    await db.delete(privateLocation).where(eq(privateLocation.id, foreignId));
  });

  test("returns 400 when id is empty", async () => {
    const res = await connectRequest(
      "GetPrivateLocation",
      { id: "" },
      { "x-openstatus-key": authKey },
    );

    expect(res.status).toBe(400);
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("GetPrivateLocation", {
      id: String(testLocationId),
    });

    expect(res.status).toBe(401);
  });
});

describe("PrivateLocationService.ListPrivateLocations", () => {
  test("returns workspace-scoped summaries without tokens", async () => {
    const res = await connectRequest(
      "ListPrivateLocations",
      {},
      { "x-openstatus-key": authKey },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data.privateLocations)).toBe(true);
    expect(data.totalSize).toBeGreaterThan(0);

    for (const summary of data.privateLocations) {
      expect(summary.token).toBeUndefined();
    }

    const ids = data.privateLocations.map(
      (l: { id: string }) => l.id,
    ) as string[];
    expect(ids).toContain(String(testLocationId));
  });

  test("reports monitorCount for an attached location", async () => {
    const res = await connectRequest(
      "ListPrivateLocations",
      {},
      { "x-openstatus-key": authKey },
    );

    const data = await res.json();
    const found = data.privateLocations.find(
      (l: { id: string; monitorCount?: number }) =>
        l.id === String(testLocationId),
    );
    expect(found.monitorCount).toBe(1);
  });

  test("applies limit and offset", async () => {
    const first = await connectRequest(
      "ListPrivateLocations",
      { limit: 1, offset: 0 },
      { "x-openstatus-key": authKey },
    );
    const second = await connectRequest(
      "ListPrivateLocations",
      { limit: 1, offset: 1 },
      { "x-openstatus-key": authKey },
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const firstData = await first.json();
    const secondData = await second.json();
    expect(firstData.privateLocations.length).toBe(1);
    expect(secondData.privateLocations.length).toBe(1);
    expect(firstData.privateLocations[0].id).not.toBe(
      secondData.privateLocations[0].id,
    );
  });

  test("returns 400 when limit exceeds the maximum", async () => {
    const res = await connectRequest(
      "ListPrivateLocations",
      { limit: 500 },
      { "x-openstatus-key": authKey },
    );

    expect(res.status).toBe(400);
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("ListPrivateLocations", {});
    expect(res.status).toBe(401);
  });
});

describe("PrivateLocationService.UpdatePrivateLocation", () => {
  test("updates the name and leaves associations untouched", async () => {
    const res = await connectRequest(
      "UpdatePrivateLocation",
      { id: String(locationToUpdateId), name: `${TEST_PREFIX}-renamed` },
      { "x-openstatus-key": authKey },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.privateLocation.name).toBe(`${TEST_PREFIX}-renamed`);
    expect(data.privateLocation.monitorIds).toEqual([String(testMonitorId)]);
  });

  test("ignores monitorIds when updateMonitorIds is absent", async () => {
    const res = await connectRequest(
      "UpdatePrivateLocation",
      {
        id: String(locationToUpdateId),
        monitorIds: [String(secondMonitorId)],
      },
      { "x-openstatus-key": authKey },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.privateLocation.monitorIds).toEqual([String(testMonitorId)]);
  });

  test("replaces associations when updateMonitorIds is true", async () => {
    const target = await mkLocation(
      `${TEST_PREFIX}-replace`,
      entitledWorkspaceId,
    );
    await db
      .insert(privateLocationToMonitors)
      .values({ privateLocationId: target, monitorId: testMonitorId });

    const res = await connectRequest(
      "UpdatePrivateLocation",
      {
        id: String(target),
        monitorIds: [String(secondMonitorId)],
        updateMonitorIds: true,
      },
      { "x-openstatus-key": authKey },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.privateLocation.monitorIds).toEqual([String(secondMonitorId)]);

    await db.delete(privateLocation).where(eq(privateLocation.id, target));
  });

  test("clears associations with an empty list and the flag set", async () => {
    const target = await mkLocation(
      `${TEST_PREFIX}-clear`,
      entitledWorkspaceId,
    );
    await db
      .insert(privateLocationToMonitors)
      .values({ privateLocationId: target, monitorId: testMonitorId });

    const res = await connectRequest(
      "UpdatePrivateLocation",
      { id: String(target), monitorIds: [], updateMonitorIds: true },
      { "x-openstatus-key": authKey },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.privateLocation.monitorIds ?? []).toEqual([]);

    await db.delete(privateLocation).where(eq(privateLocation.id, target));
  });

  test("returns 403 for a workspace without the entitlement", async () => {
    const res = await connectRequest(
      "UpdatePrivateLocation",
      { id: String(testLocationId), name: "nope" },
      { "x-openstatus-key": freeAuthKey },
    );

    expect(res.status).toBe(403);
  });

  test("returns 404 for a non-existent id", async () => {
    const res = await connectRequest(
      "UpdatePrivateLocation",
      { id: "99999999", name: "nope" },
      { "x-openstatus-key": authKey },
    );

    expect(res.status).toBe(404);
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("UpdatePrivateLocation", {
      id: String(testLocationId),
      name: "nope",
    });

    expect(res.status).toBe(401);
  });
});

describe("PrivateLocationService.DeletePrivateLocation", () => {
  test("deletes the location and cascades its links", async () => {
    const res = await connectRequest(
      "DeletePrivateLocation",
      { id: String(locationToDeleteId) },
      { "x-openstatus-key": authKey },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);

    const remaining = await db
      .select()
      .from(privateLocation)
      .where(eq(privateLocation.id, locationToDeleteId))
      .all();
    expect(remaining.length).toBe(0);

    const links = await db
      .select()
      .from(privateLocationToMonitors)
      .where(
        eq(privateLocationToMonitors.privateLocationId, locationToDeleteId),
      )
      .all();
    expect(links.length).toBe(0);
  });

  test("is idempotent for a non-existent id", async () => {
    const res = await connectRequest(
      "DeletePrivateLocation",
      { id: "99999999" },
      { "x-openstatus-key": authKey },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  test("succeeds for a workspace without the entitlement", async () => {
    const target = await mkLocation(
      `${TEST_PREFIX}-free-delete`,
      freeWorkspaceId,
    );

    const res = await connectRequest(
      "DeletePrivateLocation",
      { id: String(target) },
      { "x-openstatus-key": freeAuthKey },
    );

    expect(res.status).toBe(200);
  });

  test("does not delete another workspace's location", async () => {
    const foreignId = await mkLocation(
      `${TEST_PREFIX}-foreign-delete`,
      freeWorkspaceId,
    );

    const res = await connectRequest(
      "DeletePrivateLocation",
      { id: String(foreignId) },
      { "x-openstatus-key": authKey },
    );

    expect(res.status).toBe(200);

    const remaining = await db
      .select()
      .from(privateLocation)
      .where(eq(privateLocation.id, foreignId))
      .all();
    expect(remaining.length).toBe(1);

    await db.delete(privateLocation).where(eq(privateLocation.id, foreignId));
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("DeletePrivateLocation", {
      id: String(testLocationId),
    });

    expect(res.status).toBe(401);
  });
});
