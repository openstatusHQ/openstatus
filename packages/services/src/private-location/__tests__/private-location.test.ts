import { and, db, eq } from "@openstatus/db";
import {
  monitor,
  privateLocation,
  privateLocationToMonitors,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";
import { getLimits } from "@openstatus/db/src/schema/plan/utils";
import { expect } from "@std/expect";
import { afterAll, beforeAll, describe, test } from "@std/testing/bdd";

import { SEEDED_WORKSPACE_TEAM_ID } from "../../../test/fixtures";
import {
  expectAuditRow,
  loadSeededWorkspace,
  makeApiKeyCtx,
  makeUserCtx,
  readAuditLog,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError } from "../../errors";
import { createPrivateLocation } from "../create";
import { deletePrivateLocation } from "../delete";
import { getPrivateLocation } from "../get";
import { listPrivateLocations } from "../list";
import { setPrivateLocationStatus } from "../set-status";
import { updatePrivateLocation } from "../update";

const TEST_PREFIX = "svc-private-location-test";

let teamCtx: ServiceContext;
let teamMonitorId: number;
let secondMonitorId: number;
let deletedMonitorId: number;
let otherWorkspaceMonitorId: number;
let otherWorkspaceId: number;

const OTHER_WS_SLUG = `${TEST_PREFIX}-other-ws`;

beforeAll(async () => {
  const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  teamCtx = makeUserCtx(team, { userId: 1 });

  const mk = async (name: string, workspaceId: number, deleted?: boolean) => {
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

  teamMonitorId = await mk(`${TEST_PREFIX}-monitor`, teamCtx.workspace.id);
  secondMonitorId = await mk(`${TEST_PREFIX}-monitor-2`, teamCtx.workspace.id);
  deletedMonitorId = await mk(
    `${TEST_PREFIX}-monitor-deleted`,
    teamCtx.workspace.id,
    true,
  );

  await db
    .delete(workspace)
    .where(eq(workspace.slug, OTHER_WS_SLUG))
    .catch(() => undefined);
  const otherRow = await db
    .insert(workspace)
    .values({
      slug: OTHER_WS_SLUG,
      name: `${TEST_PREFIX}-other`,
      plan: "team",
      limits: JSON.stringify(getLimits("team")),
    })
    .returning()
    .get();
  const otherWs = selectWorkspaceSchema.parse(otherRow);
  otherWorkspaceId = otherWs.id;
  otherWorkspaceMonitorId = await mk(
    `${TEST_PREFIX}-other-monitor`,
    otherWs.id,
  );
});

afterAll(async () => {
  for (const id of [
    teamMonitorId,
    secondMonitorId,
    deletedMonitorId,
    otherWorkspaceMonitorId,
  ]) {
    await db.delete(monitor).where(eq(monitor.id, id));
  }
  await db.delete(workspace).where(eq(workspace.slug, OTHER_WS_SLUG));
});

describe("createPrivateLocation", () => {
  test("generates a token when none is supplied", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createPrivateLocation({
        ctx: { ...teamCtx, db: tx },
        input: { name: `${TEST_PREFIX}-generated`, monitors: [] },
      });

      expect(row.token).toBeTruthy();
      expect(row.token.length).toBeGreaterThan(20);
    });
  });

  test("generates a distinct token per location", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const a = await createPrivateLocation({
        ctx,
        input: { name: `${TEST_PREFIX}-a`, monitors: [] },
      });
      const b = await createPrivateLocation({
        ctx,
        input: { name: `${TEST_PREFIX}-b`, monitors: [] },
      });

      expect(a.token).not.toBe(b.token);
    });
  });

  test("honors a caller-supplied token", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createPrivateLocation({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-supplied`,
          token: "caller-chosen-token",
          monitors: [],
        },
      });

      expect(row.token).toBe("caller-chosen-token");
    });
  });

  test("attaches monitors and audits the create", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createPrivateLocation({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-with-monitors`,
          monitors: [teamMonitorId],
        },
      });

      const links = await tx
        .select()
        .from(privateLocationToMonitors)
        .where(eq(privateLocationToMonitors.privateLocationId, row.id))
        .all();
      expect(links.map((l) => l.monitorId)).toEqual([teamMonitorId]);

      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "private_location.create",
        entityType: "private_location",
        entityId: row.id,
        db: tx,
      });
    });
  });

  test("dedupes duplicate monitor ids", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createPrivateLocation({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-dupes`,
          monitors: [teamMonitorId, teamMonitorId, teamMonitorId],
        },
      });

      const links = await tx
        .select()
        .from(privateLocationToMonitors)
        .where(eq(privateLocationToMonitors.privateLocationId, row.id))
        .all();
      expect(links.length).toBe(1);
    });
  });

  test("rejects a monitor from another workspace", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        createPrivateLocation({
          ctx: { ...teamCtx, db: tx },
          input: {
            name: `${TEST_PREFIX}-foreign`,
            monitors: [otherWorkspaceMonitorId],
          },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("rejects a soft-deleted monitor", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        createPrivateLocation({
          ctx: { ...teamCtx, db: tx },
          input: {
            name: `${TEST_PREFIX}-deleted-monitor`,
            monitors: [deletedMonitorId],
          },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("persists metadata and audits it", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createPrivateLocation({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-metadata`,
          monitors: [],
          metadata: { datacenter: "eu-west", rack: "A3" },
        },
      });

      expect(row.metadata).toEqual({ datacenter: "eu-west", rack: "A3" });

      const audit = await readAuditLog({
        workspaceId: teamCtx.workspace.id,
        entityType: "private_location",
        entityId: String(row.id),
        db: tx,
      });
      const created = audit.find((r) => r.action === "private_location.create");
      expect(
        (created?.after as { metadata?: Record<string, string> } | undefined)
          ?.metadata,
      ).toEqual({ datacenter: "eu-west", rack: "A3" });
    });
  });

  test("stores null metadata when none is supplied", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createPrivateLocation({
        ctx: { ...teamCtx, db: tx },
        input: { name: `${TEST_PREFIX}-no-metadata`, monitors: [] },
      });

      expect(row.metadata).toBeNull();
    });
  });

  test("rejects metadata beyond the allowed limits", async () => {
    await withTestTransaction(async (tx) => {
      const tooMany = Object.fromEntries(
        Array.from({ length: 21 }, (_, i) => [`k${i}`, "v"]),
      );
      await expect(
        createPrivateLocation({
          ctx: { ...teamCtx, db: tx },
          input: {
            name: `${TEST_PREFIX}-too-many`,
            monitors: [],
            metadata: tooMany,
          },
        }),
      ).rejects.toBeTruthy();

      await expect(
        createPrivateLocation({
          ctx: { ...teamCtx, db: tx },
          input: {
            name: `${TEST_PREFIX}-long-value`,
            monitors: [],
            metadata: { k: "x".repeat(257) },
          },
        }),
      ).rejects.toBeTruthy();
    });
  });

  test("defaults status to error until the agent reports in", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createPrivateLocation({
        ctx: { ...teamCtx, db: tx },
        input: { name: `${TEST_PREFIX}-status-default`, monitors: [] },
      });

      expect(row.status).toBe("error");
    });
  });

  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = {
        ...makeApiKeyCtx(teamCtx.workspace, {
          keyId: "k",
          userId: 1,
          scopes: ["read"],
        }),
        db: tx,
      };
      await expect(
        createPrivateLocation({
          ctx,
          input: { name: `${TEST_PREFIX}-readonly`, monitors: [] },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});

describe("updatePrivateLocation", () => {
  const seed = async (
    tx: Parameters<Parameters<typeof withTestTransaction>[0]>[0],
    monitors: number[] = [],
  ) =>
    createPrivateLocation({
      ctx: { ...teamCtx, db: tx },
      input: { name: `${TEST_PREFIX}-seed`, monitors },
    });

  test("updates the name and leaves associations untouched", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const created = await seed(tx, [teamMonitorId]);

      const updated = await updatePrivateLocation({
        ctx,
        input: { id: created.id, name: `${TEST_PREFIX}-renamed` },
      });
      expect(updated.name).toBe(`${TEST_PREFIX}-renamed`);

      const links = await tx
        .select()
        .from(privateLocationToMonitors)
        .where(eq(privateLocationToMonitors.privateLocationId, created.id))
        .all();
      expect(links.map((l) => l.monitorId)).toEqual([teamMonitorId]);
    });
  });

  test("replaces associations without touching the name", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const created = await seed(tx, [teamMonitorId]);

      const updated = await updatePrivateLocation({
        ctx,
        input: { id: created.id, monitors: [secondMonitorId] },
      });
      expect(updated.name).toBe(created.name);

      const links = await tx
        .select()
        .from(privateLocationToMonitors)
        .where(eq(privateLocationToMonitors.privateLocationId, created.id))
        .all();
      expect(links.map((l) => l.monitorId)).toEqual([secondMonitorId]);
    });
  });

  test("clears associations when monitors is an empty array", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const created = await seed(tx, [teamMonitorId]);

      await updatePrivateLocation({
        ctx,
        input: { id: created.id, monitors: [] },
      });

      const links = await tx
        .select()
        .from(privateLocationToMonitors)
        .where(eq(privateLocationToMonitors.privateLocationId, created.id))
        .all();
      expect(links.length).toBe(0);
    });
  });

  test("emits no audit row when nothing changes", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const created = await seed(tx, [teamMonitorId]);

      await updatePrivateLocation({ ctx, input: { id: created.id } });

      const rows = await readAuditLog({
        workspaceId: teamCtx.workspace.id,
        entityType: "private_location",
        entityId: String(created.id),
        db: tx,
      });
      expect(rows.some((r) => r.action === "private_location.update")).toBe(
        false,
      );
    });
  });

  test("audits a real update", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const created = await seed(tx);

      await updatePrivateLocation({
        ctx,
        input: { id: created.id, name: `${TEST_PREFIX}-audited` },
      });

      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "private_location.update",
        entityType: "private_location",
        entityId: created.id,
        db: tx,
      });
    });
  });

  test("rejects a soft-deleted monitor", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const created = await seed(tx);

      await expect(
        updatePrivateLocation({
          ctx,
          input: { id: created.id, monitors: [deletedMonitorId] },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("throws NotFoundError for an unknown id", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        updatePrivateLocation({
          ctx: { ...teamCtx, db: tx },
          input: { id: 999_999_999, name: "nope" },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("replaces metadata and audits the change", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const created = await createPrivateLocation({
        ctx,
        input: {
          name: `${TEST_PREFIX}-meta-seed`,
          monitors: [],
          metadata: { a: "1" },
        },
      });

      const updated = await updatePrivateLocation({
        ctx,
        input: { id: created.id, metadata: { b: "2", c: "3" } },
      });
      expect(updated.metadata).toEqual({ b: "2", c: "3" });

      const audit = await readAuditLog({
        workspaceId: teamCtx.workspace.id,
        entityType: "private_location",
        entityId: String(created.id),
        db: tx,
      });
      const row = audit.find((r) => r.action === "private_location.update");
      expect(row?.changedFields).toContain("metadata");
    });
  });

  test("clears metadata when given an empty object", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const created = await createPrivateLocation({
        ctx,
        input: {
          name: `${TEST_PREFIX}-meta-clear`,
          monitors: [],
          metadata: { a: "1" },
        },
      });

      const updated = await updatePrivateLocation({
        ctx,
        input: { id: created.id, metadata: {} },
      });
      expect(updated.metadata).toBeNull();
    });
  });

  test("preserves metadata when the field is omitted", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const created = await createPrivateLocation({
        ctx,
        input: {
          name: `${TEST_PREFIX}-meta-preserve`,
          monitors: [],
          metadata: { a: "1" },
        },
      });

      const updated = await updatePrivateLocation({
        ctx,
        input: { id: created.id, name: `${TEST_PREFIX}-meta-renamed` },
      });
      expect(updated.metadata).toEqual({ a: "1" });
    });
  });

  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = {
        ...makeApiKeyCtx(teamCtx.workspace, {
          keyId: "k",
          userId: 1,
          scopes: ["read"],
        }),
        db: tx,
      };
      await expect(
        updatePrivateLocation({ ctx, input: { id: 1, name: "nope" } }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});

describe("setPrivateLocationStatus", () => {
  test("flips status and audits the change", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const created = await createPrivateLocation({
        ctx,
        input: { name: `${TEST_PREFIX}-set-status`, monitors: [] },
      });
      expect(created.status).toBe("error");

      const updated = await setPrivateLocationStatus({
        ctx,
        input: { id: created.id, status: "active" },
      });
      expect(updated.status).toBe("active");

      const audit = await readAuditLog({
        workspaceId: teamCtx.workspace.id,
        entityType: "private_location",
        entityId: String(created.id),
        db: tx,
      });
      const row = audit.find((r) => r.action === "private_location.update");
      expect(row?.changedFields).toContain("status");
    });
  });

  test("is a no-op when the status is unchanged", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const created = await createPrivateLocation({
        ctx,
        input: { name: `${TEST_PREFIX}-set-status-noop`, monitors: [] },
      });

      await setPrivateLocationStatus({
        ctx,
        input: { id: created.id, status: "error" },
      });

      const rows = await readAuditLog({
        workspaceId: teamCtx.workspace.id,
        entityType: "private_location",
        entityId: String(created.id),
        db: tx,
      });
      expect(rows.some((r) => r.action === "private_location.update")).toBe(
        false,
      );
    });
  });

  test("throws NotFoundError for another workspace's location", async () => {
    await withTestTransaction(async (tx) => {
      const other = await tx
        .insert(privateLocation)
        .values({
          name: `${TEST_PREFIX}-set-status-foreign`,
          token: "foreign-token-status",
          workspaceId: otherWorkspaceId,
        })
        .returning()
        .get();

      await expect(
        setPrivateLocationStatus({
          ctx: { ...teamCtx, db: tx },
          input: { id: other.id, status: "error" },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = {
        ...makeApiKeyCtx(teamCtx.workspace, {
          keyId: "k",
          userId: 1,
          scopes: ["read"],
        }),
        db: tx,
      };
      await expect(
        setPrivateLocationStatus({
          ctx,
          input: { id: 1, status: "error" },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});

describe("getPrivateLocation", () => {
  test("returns the location with its monitors", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const created = await createPrivateLocation({
        ctx,
        input: { name: `${TEST_PREFIX}-get`, monitors: [teamMonitorId] },
      });

      const found = await getPrivateLocation({
        ctx,
        input: { id: created.id },
      });
      expect(found.id).toBe(created.id);
      expect(found.token).toBe(created.token);
      expect(found.monitors.map((m) => m.id)).toEqual([teamMonitorId]);
    });
  });

  test("throws NotFoundError for an unknown id", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        getPrivateLocation({
          ctx: { ...teamCtx, db: tx },
          input: { id: 999_999_999 },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("throws NotFoundError for another workspace's location", async () => {
    await withTestTransaction(async (tx) => {
      const other = await tx
        .insert(privateLocation)
        .values({
          name: `${TEST_PREFIX}-foreign-loc`,
          token: "foreign-token",
          workspaceId: otherWorkspaceId,
        })
        .returning()
        .get();

      await expect(
        getPrivateLocation({
          ctx: { ...teamCtx, db: tx },
          input: { id: other.id },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

describe("listPrivateLocations", () => {
  test("returns items and a workspace-scoped totalSize", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const before = await listPrivateLocations({ ctx });

      await createPrivateLocation({
        ctx,
        input: { name: `${TEST_PREFIX}-list-1`, monitors: [teamMonitorId] },
      });
      await createPrivateLocation({
        ctx,
        input: { name: `${TEST_PREFIX}-list-2`, monitors: [] },
      });

      const after = await listPrivateLocations({ ctx });
      expect(after.totalSize).toBe(before.totalSize + 2);
      expect(
        after.items.every((i) => i.workspaceId === teamCtx.workspace.id),
      ).toBe(true);
    });
  });

  test("applies limit and offset over a stable ordering", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      await createPrivateLocation({
        ctx,
        input: { name: `${TEST_PREFIX}-page-1`, monitors: [] },
      });
      await createPrivateLocation({
        ctx,
        input: { name: `${TEST_PREFIX}-page-2`, monitors: [] },
      });

      const firstPage = await listPrivateLocations({
        ctx,
        input: { limit: 1, offset: 0 },
      });
      const secondPage = await listPrivateLocations({
        ctx,
        input: { limit: 1, offset: 1 },
      });

      expect(firstPage.items.length).toBe(1);
      expect(secondPage.items.length).toBe(1);
      expect(firstPage.items[0].id).not.toBe(secondPage.items[0].id);
    });
  });
});

describe("deletePrivateLocation", () => {
  test("removes the row, cascades links, and audits", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const created = await createPrivateLocation({
        ctx,
        input: { name: `${TEST_PREFIX}-delete`, monitors: [teamMonitorId] },
      });

      await deletePrivateLocation({ ctx, input: { id: created.id } });

      const remaining = await tx
        .select()
        .from(privateLocation)
        .where(eq(privateLocation.id, created.id))
        .all();
      expect(remaining.length).toBe(0);

      const links = await tx
        .select()
        .from(privateLocationToMonitors)
        .where(eq(privateLocationToMonitors.privateLocationId, created.id))
        .all();
      expect(links.length).toBe(0);

      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "private_location.delete",
        entityType: "private_location",
        entityId: created.id,
        db: tx,
      });
    });
  });

  test("is idempotent for an unknown id", async () => {
    await withTestTransaction(async (tx) => {
      await deletePrivateLocation({
        ctx: { ...teamCtx, db: tx },
        input: { id: 999_999_999 },
      });

      const rows = await readAuditLog({
        workspaceId: teamCtx.workspace.id,
        entityType: "private_location",
        entityId: "999999999",
        db: tx,
      });
      expect(rows.length).toBe(0);
    });
  });

  test("does not delete another workspace's location", async () => {
    await withTestTransaction(async (tx) => {
      const other = await tx
        .insert(privateLocation)
        .values({
          name: `${TEST_PREFIX}-foreign-delete`,
          token: "foreign-token-2",
          workspaceId: otherWorkspaceId,
        })
        .returning()
        .get();

      await deletePrivateLocation({
        ctx: { ...teamCtx, db: tx },
        input: { id: other.id },
      });

      const remaining = await tx
        .select()
        .from(privateLocation)
        .where(
          and(
            eq(privateLocation.id, other.id),
            eq(privateLocation.workspaceId, otherWorkspaceId),
          ),
        )
        .all();
      expect(remaining.length).toBe(1);
    });
  });

  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = {
        ...makeApiKeyCtx(teamCtx.workspace, {
          keyId: "k",
          userId: 1,
          scopes: ["read"],
        }),
        db: tx,
      };
      await expect(
        deletePrivateLocation({ ctx, input: { id: 1 } }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});
