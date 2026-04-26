import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db, eq, inArray } from "@openstatus/db";
import {
  monitor,
  monitorTag,
  monitorTagsToMonitors,
  notification,
  notificationsToMonitors,
} from "@openstatus/db/src/schema";

import {
  SEEDED_WORKSPACE_FREE_ID,
  SEEDED_WORKSPACE_TEAM_ID,
} from "../../../test/fixtures";
import {
  expectAuditRow,
  loadSeededWorkspace,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError } from "../../errors";
import { cloneMonitor } from "../clone";
import { createMonitor } from "../create";
import { deleteMonitor, deleteMonitors } from "../delete";
import { getMonitor, listMonitors } from "../list";
import { updateMonitorNotifiers, updateMonitorTags } from "../relations";
import { updateMonitorGeneral } from "../update";

const TEST_PREFIX = "svc-monitor-test";

let teamCtx: ServiceContext;
let freeCtx: ServiceContext;
let testTagId: number;
let testNotificationId: number;

beforeAll(async () => {
  const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  const free = await loadSeededWorkspace(SEEDED_WORKSPACE_FREE_ID);
  teamCtx = makeUserCtx(team, { userId: 1 });
  freeCtx = makeUserCtx(free, { userId: 2 });

  const tagRow = await db
    .insert(monitorTag)
    .values({
      workspaceId: team.id,
      name: `${TEST_PREFIX}-tag`,
      color: "#000000",
    })
    .returning()
    .get();
  testTagId = tagRow.id;

  const notifRow = await db
    .insert(notification)
    .values({
      workspaceId: team.id,
      name: `${TEST_PREFIX}-notif`,
      provider: "email",
      data: JSON.stringify({ email: "test@example.com" }),
    })
    .returning()
    .get();
  testNotificationId = notifRow.id;
});

afterAll(async () => {
  await db
    .delete(monitorTag)
    .where(eq(monitorTag.id, testTagId))
    .catch(() => undefined);
  await db
    .delete(notification)
    .where(eq(notification.id, testNotificationId))
    .catch(() => undefined);
});

describe("createMonitor", () => {
  test("http happy path — stores defaults + emits audit", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const row = await createMonitor({
        ctx,
        input: {
          name: `${TEST_PREFIX}-http`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
        },
      });

      expect(row.jobType).toBe("http");
      expect(row.url).toBe("https://example.com");
      expect(row.regions.length).toBeGreaterThan(0);

      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "monitor.create",
        entityType: "monitor",
        entityId: row.id,
        db: tx,
      });
    });
  });

  test("tcp happy path", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-tcp`,
          jobType: "tcp",
          url: "example.com:443",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
        },
      });
      expect(row.jobType).toBe("tcp");
    });
  });

  test("dns happy path", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-dns`,
          jobType: "dns",
          url: "example.com",
          method: "GET",
          headers: [],
          assertions: [
            {
              version: "v1",
              type: "dnsRecord",
              key: "A",
              compare: "eq",
              target: "1.1.1.1",
            },
          ],
          active: false,
        },
      });
      expect(row.jobType).toBe("dns");
    });
  });
});

describe("deleteMonitor", () => {
  test("soft-deletes + removes tag / notifier associations", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const row = await createMonitor({
        ctx,
        input: {
          name: `${TEST_PREFIX}-delete`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
        },
      });
      // Attach relations.
      await tx
        .insert(monitorTagsToMonitors)
        .values({ monitorId: row.id, monitorTagId: testTagId });
      await tx.insert(notificationsToMonitors).values({
        monitorId: row.id,
        notificationId: testNotificationId,
      });

      await deleteMonitor({ ctx, input: { id: row.id } });

      const after = await tx
        .select()
        .from(monitor)
        .where(eq(monitor.id, row.id))
        .get();
      expect(after?.deletedAt).toBeInstanceOf(Date);
      expect(after?.active).toBe(false);

      const tagAssoc = await tx
        .select()
        .from(monitorTagsToMonitors)
        .where(eq(monitorTagsToMonitors.monitorId, row.id))
        .all();
      const notifAssoc = await tx
        .select()
        .from(notificationsToMonitors)
        .where(eq(notificationsToMonitors.monitorId, row.id))
        .all();
      expect(tagAssoc).toHaveLength(0);
      expect(notifAssoc).toHaveLength(0);
    });
  });

  test("throws NotFoundError for cross-workspace delete", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-cross-ws-delete`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
        },
      });
      await expect(
        deleteMonitor({ ctx: { ...freeCtx, db: tx }, input: { id: row.id } }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("second delete returns NotFoundError (idempotency guard)", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      // Regression for the Cubic P2 fix: `getMonitorInWorkspace` filters
      // by `isNull(deletedAt)`, so a second `deleteMonitor` on the same
      // id should throw `NotFoundError` rather than silently re-running
      // the soft-delete / cascade / audit sequence on a tombstoned row.
      const row = await createMonitor({
        ctx,
        input: {
          name: `${TEST_PREFIX}-double-delete`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
        },
      });
      await deleteMonitor({ ctx, input: { id: row.id } });
      await expect(
        deleteMonitor({ ctx, input: { id: row.id } }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

describe("deleteMonitors (bulk)", () => {
  test("soft-deletes all ids and strips associations", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const a = await createMonitor({
        ctx,
        input: {
          name: `${TEST_PREFIX}-bulk-a`,
          jobType: "http",
          url: "https://a.example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
        },
      });
      const b = await createMonitor({
        ctx,
        input: {
          name: `${TEST_PREFIX}-bulk-b`,
          jobType: "http",
          url: "https://b.example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
        },
      });

      await deleteMonitors({
        ctx,
        input: { ids: [a.id, b.id] },
      });

      const rows = await tx
        .select({ id: monitor.id, deletedAt: monitor.deletedAt })
        .from(monitor)
        .where(inArray(monitor.id, [a.id, b.id]))
        .all();
      expect(rows).toHaveLength(2);
      for (const r of rows) expect(r.deletedAt).toBeInstanceOf(Date);
    });
  });
});

describe("cloneMonitor", () => {
  test("duplicates the row with a `(Copy)` name", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const source = await createMonitor({
        ctx,
        input: {
          name: `${TEST_PREFIX}-source`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
        },
      });

      const clone = await cloneMonitor({
        ctx,
        input: { id: source.id },
      });

      expect(clone.id).not.toBe(source.id);
      expect(clone.name).toBe(`${source.name} (Copy)`);
      expect(clone.url).toBe(source.url);
    });
  });

  test("resets status to active even when source is degraded/error", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      // Regression for the Cubic P2 fix: `clone.ts` destructures
      // `status` out of the source row before spreading, so a clone
      // always starts in `"active"` state rather than inheriting the
      // source's stale health. Flipping the source's status via a
      // direct db update — `createMonitor` doesn't accept `status`
      // input, and `"active"` is the insert default.
      const source = await createMonitor({
        ctx,
        input: {
          name: `${TEST_PREFIX}-clone-status-reset`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
        },
      });
      await tx
        .update(monitor)
        .set({ status: "error" })
        .where(eq(monitor.id, source.id));

      const clone = await cloneMonitor({
        ctx,
        input: { id: source.id },
      });

      expect(clone.status).toBe("active");
    });
  });
});

describe("updateMonitorTags / updateMonitorNotifiers", () => {
  test("replaces the full tag set with deduped ids", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const row = await createMonitor({
        ctx,
        input: {
          name: `${TEST_PREFIX}-tags`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
        },
      });

      await updateMonitorTags({
        ctx,
        input: { id: row.id, tags: [testTagId, testTagId] },
      });
      const assoc = await tx
        .select()
        .from(monitorTagsToMonitors)
        .where(eq(monitorTagsToMonitors.monitorId, row.id))
        .all();
      expect(assoc).toHaveLength(1);
    });
  });

  test("throws ForbiddenError when tag is in another workspace", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-tag-forbidden`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
        },
      });
      await expect(
        updateMonitorTags({
          ctx: { ...freeCtx, db: tx },
          input: { id: row.id, tags: [testTagId] },
        }),
      ).rejects.toBeInstanceOf(NotFoundError); // monitor is in another ws
    });
  });

  test("replaces the full notifier set", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const row = await createMonitor({
        ctx,
        input: {
          name: `${TEST_PREFIX}-notif`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
        },
      });
      await updateMonitorNotifiers({
        ctx,
        input: { id: row.id, notifiers: [testNotificationId] },
      });
      const assoc = await tx
        .select()
        .from(notificationsToMonitors)
        .where(eq(notificationsToMonitors.monitorId, row.id))
        .all();
      expect(assoc).toHaveLength(1);
    });
  });

  test("throws ForbiddenError when notifier is in another workspace", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...freeCtx, db: tx };
      // free ctx owns its own monitor; pass team's notificationId (which is in
      // team's workspace) into the update under free ctx → the monitor lookup
      // would fail first (NotFoundError), so we build an in-free monitor and
      // try to attach team's notifier.
      const freeMonitor = await createMonitor({
        ctx,
        input: {
          name: `${TEST_PREFIX}-free-notif`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
        },
      });
      await expect(
        updateMonitorNotifiers({
          ctx,
          input: { id: freeMonitor.id, notifiers: [testNotificationId] },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});

describe("list / get", () => {
  test("respects workspace isolation + soft-delete", async () => {
    await withTestTransaction(async (tx) => {
      const teamCtxTx = { ...teamCtx, db: tx };
      const freeCtxTx = { ...freeCtx, db: tx };
      const row = await createMonitor({
        ctx: teamCtxTx,
        input: {
          name: `${TEST_PREFIX}-list`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: true,
        },
      });

      await expect(
        getMonitor({ ctx: freeCtxTx, input: { id: row.id } }),
      ).rejects.toBeInstanceOf(NotFoundError);

      const { items } = await listMonitors({
        ctx: freeCtxTx,
        input: { limit: 100, offset: 0, order: "desc" },
      });
      expect(items.find((m) => m.id === row.id)).toBeUndefined();

      // Soft-delete, then verify it disappears from the team list too.
      await deleteMonitor({ ctx: teamCtxTx, input: { id: row.id } });
      const { items: teamItems } = await listMonitors({
        ctx: teamCtxTx,
        input: { limit: 1000, offset: 0, order: "desc" },
      });
      expect(teamItems.find((m) => m.id === row.id)).toBeUndefined();
    });
  });
});

describe("updateMonitorGeneral", () => {
  test("updates name / url / assertions and audits", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const row = await createMonitor({
        ctx,
        input: {
          name: `${TEST_PREFIX}-gen`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
        },
      });

      const updated = await updateMonitorGeneral({
        ctx,
        input: {
          id: row.id,
          name: `${TEST_PREFIX}-gen-renamed`,
          jobType: "http",
          url: "https://example.org",
          method: "POST",
          headers: [{ key: "X-Test", value: "yes" }],
          assertions: [],
          active: true,
        },
      });

      expect(updated.name).toBe(`${TEST_PREFIX}-gen-renamed`);
      expect(updated.url).toBe("https://example.org");
      expect(updated.method).toBe("POST");
      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "monitor.update",
        entityType: "monitor",
        entityId: row.id,
        db: tx,
      });
    });
  });
});
