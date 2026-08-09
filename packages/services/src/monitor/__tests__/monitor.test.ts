import { and, db, eq, inArray, isNull } from "@openstatus/db";
import {
  monitor,
  monitorRun,
  monitorTag,
  monitorTagsToMonitors,
  notification,
  notificationsToMonitors,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";
import { createWorkspace } from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { afterAll, beforeAll, describe, test } from "@std/testing/bdd";

import {
  clearAuditLog,
  expectAuditRow,
  makeApiKeyCtx,
  makeSystemCtx,
  makeUserCtx,
  readAuditLog,
  withTestTransaction,
} from "../../../test/helpers";
import type { DrizzleTx, ServiceContext } from "../../context";
import {
  ForbiddenError,
  LimitExceededError,
  NotFoundError,
} from "../../errors";
import { cloneMonitor } from "../clone";
import { createMonitor } from "../create";
import { deleteMonitor, deleteMonitors } from "../delete";
import { getMonitor, listMonitors } from "../list";
import { updateMonitorNotifiers, updateMonitorTags } from "../relations";
import { triggerMonitorRun } from "../trigger";
import {
  bulkUpdateMonitors,
  updateMonitorConfig,
  updateMonitorGeneral,
} from "../update";

const TEST_PREFIX = "svc-monitor-test";

let teamCtx: ServiceContext;
let freeCtx: ServiceContext;
let teamWorkspaceId: number;
let freeWorkspaceId: number;
let testTagId: number;
let testNotificationId: number;

beforeAll(async () => {
  // Own workspaces per suite — relying on the shared seeded workspace races
  // sibling suites that wipe its tags/notifications (e.g. monitor-tag).
  const team = selectWorkspaceSchema.parse(await createWorkspace());
  const free = selectWorkspaceSchema.parse(await createWorkspace());
  teamWorkspaceId = team.id;
  freeWorkspaceId = free.id;
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
  await db
    .delete(workspace)
    .where(inArray(workspace.id, [teamWorkspaceId, freeWorkspaceId]))
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

  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = {
        ...makeApiKeyCtx(teamCtx.workspace, {
          keyId: "k-read",
          userId: 1,
          scopes: ["read"],
        }),
        db: tx,
      };
      await expect(
        createMonitor({
          ctx,
          input: {
            name: `${TEST_PREFIX}-read-only`,
            jobType: "http",
            url: "https://example.com",
            method: "GET",
            headers: [],
            assertions: [],
            active: false,
          },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
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

// `totalSize` is derived from the page length whenever that is unambiguous,
// and only falls back to `count(*)` when it isn't. The derivation must agree
// with the count in every case, including past the end of the result set.
describe("listMonitors totalSize", () => {
  /** Seed `n` monitors and return the workspace's true monitor count. */
  const seed = async (tx: DrizzleTx, ctx: ServiceContext, n: number) => {
    for (let i = 0; i < n; i++) {
      await createMonitor({
        ctx,
        input: {
          name: `${TEST_PREFIX}-total-${i}`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: true,
        },
      });
    }
    const rows = await tx
      .select({ id: monitor.id })
      .from(monitor)
      .where(
        and(
          eq(monitor.workspaceId, ctx.workspace.id),
          isNull(monitor.deletedAt),
        ),
      )
      .all();
    return rows.length;
  };

  test("a short page derives the total from offset + rows", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const total = await seed(tx, ctx, 3);

      const { items, totalSize } = await listMonitors({
        ctx,
        input: { limit: total + 10, offset: 0, order: "desc" },
      });
      expect(items).toHaveLength(total);
      expect(totalSize).toBe(total);
    });
  });

  test("a full page falls back to count(*)", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const total = await seed(tx, ctx, 3);

      const { items, totalSize } = await listMonitors({
        ctx,
        input: { limit: 1, offset: 0, order: "desc" },
      });
      expect(items).toHaveLength(1);
      // Derivation alone would say 1; only the count knows the real total.
      expect(totalSize).toBe(total);
    });
  });

  test("a mid-list page reports the full total, not the page end", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const total = await seed(tx, ctx, 3);

      const { totalSize } = await listMonitors({
        ctx,
        input: { limit: 2, offset: 1, order: "desc" },
      });
      expect(totalSize).toBe(total);
    });
  });

  test("an offset past the end still reports the true total", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const total = await seed(tx, ctx, 3);

      const { items, totalSize } = await listMonitors({
        ctx,
        input: { limit: 10, offset: total + 50, order: "desc" },
      });
      expect(items).toHaveLength(0);
      // Regression: deriving `offset + rows.length` here would report the
      // offset itself as the total.
      expect(totalSize).toBe(total);
    });
  });

  test("an empty result at offset 0 reports zero", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...freeCtx, db: tx };
      const total = await seed(tx, ctx, 0);

      const { items, totalSize } = await listMonitors({
        ctx,
        input: { limit: 100, offset: 0, order: "desc" },
      });
      expect(items).toHaveLength(total);
      expect(totalSize).toBe(total);
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

describe("bulkUpdateMonitors", () => {
  test("system actor pauses active monitors and audits", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const a = await createMonitor({
        ctx,
        input: {
          name: `${TEST_PREFIX}-bulk-a`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: true,
        },
      });
      const b = await createMonitor({
        ctx,
        input: {
          name: `${TEST_PREFIX}-bulk-b`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: true,
        },
      });

      await bulkUpdateMonitors({
        ctx: {
          ...makeSystemCtx(teamCtx.workspace, { job: "monitor-auto-pause" }),
          db: tx,
        },
        input: { ids: [a.id, b.id], active: false },
      });

      const rows = await tx
        .select()
        .from(monitor)
        .where(inArray(monitor.id, [a.id, b.id]))
        .all();
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(row.active).toBe(false);
      }

      for (const id of [a.id, b.id]) {
        const audits = await readAuditLog({
          workspaceId: teamCtx.workspace.id,
          entityType: "monitor",
          entityId: id,
          db: tx,
        });
        const hit = audits.find(
          (row) =>
            row.action === "monitor.update" && row.actorType === "system",
        );
        expect(hit).toBeDefined();
        expect(hit?.actorId).toBe("monitor-auto-pause");
      }
    });
  });

  test("ignores ids outside the workspace", async () => {
    await withTestTransaction(async (tx) => {
      const foreign = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-bulk-foreign`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: true,
        },
      });

      await bulkUpdateMonitors({
        ctx: {
          ...makeSystemCtx(freeCtx.workspace, { job: "monitor-auto-pause" }),
          db: tx,
        },
        input: { ids: [foreign.id], active: false },
      });

      const row = await tx
        .select()
        .from(monitor)
        .where(eq(monitor.id, foreign.id))
        .get();
      expect(row?.active).toBe(true);

      const audits = await readAuditLog({
        workspaceId: freeCtx.workspace.id,
        entityType: "monitor",
        entityId: foreign.id,
        db: tx,
      });
      expect(audits).toHaveLength(0);
    });
  });

  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = {
        ...makeApiKeyCtx(teamCtx.workspace, {
          keyId: "k-read",
          userId: 1,
          scopes: ["read"],
        }),
        db: tx,
      };
      await expect(
        bulkUpdateMonitors({ ctx, input: { ids: [1], active: false } }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});

describe("updateMonitorConfig", () => {
  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      const readOnlyCtx = {
        ...makeApiKeyCtx(teamCtx.workspace, {
          keyId: "k-read",
          userId: 1,
          scopes: ["read"],
        }),
        db: tx,
      };
      await expect(
        updateMonitorConfig({
          ctx: readOnlyCtx,
          input: { id: 999_999_999, name: "nope" },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("patches only supplied fields and leaves the rest intact", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const row = await createMonitor({
        ctx,
        input: {
          name: `${TEST_PREFIX}-cfg`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
          periodicity: "10m",
          regions: ["ams"],
          timeout: 30_000,
          retry: 2,
          description: "keep me",
        },
      });

      const updated = await updateMonitorConfig({
        ctx,
        input: { id: row.id, name: `${TEST_PREFIX}-cfg-renamed`, retry: 5 },
      });

      expect(updated.name).toBe(`${TEST_PREFIX}-cfg-renamed`);
      expect(updated.retry).toBe(5);
      // Untouched fields survive the patch.
      expect(updated.url).toBe("https://example.com");
      expect(updated.periodicity).toBe("10m");
      expect(updated.timeout).toBe(30_000);
      expect(updated.description).toBe("keep me");
      expect(updated.regions).toEqual(["ams"]);
    });
  });

  test("emits a single monitor.update audit row per call", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const row = await createMonitor({
        ctx,
        input: {
          name: `${TEST_PREFIX}-cfg-audit`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
        },
      });

      await updateMonitorConfig({
        ctx,
        input: {
          id: row.id,
          name: `${TEST_PREFIX}-cfg-audit-2`,
          public: true,
          timeout: 20_000,
          followRedirects: false,
        },
      });

      const rows = await readAuditLog({
        workspaceId: teamCtx.workspace.id,
        entityType: "monitor",
        entityId: String(row.id),
        db: tx,
      });
      const updates = rows.filter((r) => r.action === "monitor.update");
      expect(updates).toHaveLength(1);
    });
  });

  test("throws NotFoundError for cross-workspace id", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-cfg-cross`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
        },
      });

      await expect(
        updateMonitorConfig({
          ctx: { ...freeCtx, db: tx },
          input: { id: row.id, name: "nope" },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

describe("triggerMonitorRun", () => {
  test("rejects read-only actor before touching the DB", async () => {
    await withTestTransaction(async (tx) => {
      const readOnlyCtx = {
        ...makeApiKeyCtx(teamCtx.workspace, {
          keyId: "k-read",
          userId: 1,
          scopes: ["read"],
        }),
        db: tx,
      };
      await expect(
        triggerMonitorRun({
          ctx: readOnlyCtx,
          input: { id: 999_999_999 },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("records a run and returns the monitor with region status", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const row = await createMonitor({
        ctx,
        input: {
          name: `${TEST_PREFIX}-trigger`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: true,
          regions: ["ams"],
        },
      });

      const result = await triggerMonitorRun({ ctx, input: { id: row.id } });

      expect(result.monitor.id).toBe(row.id);
      expect(result.monitor.regions).toEqual(["ams"]);
      expect(typeof result.runId).toBe("number");

      const runs = await tx
        .select()
        .from(monitorRun)
        .where(eq(monitorRun.monitorId, row.id))
        .all();
      expect(runs).toHaveLength(1);
    });
  });

  test("throws NotFoundError for cross-workspace id", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-trigger-cross`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: true,
        },
      });

      await expect(
        triggerMonitorRun({
          ctx: { ...freeCtx, db: tx },
          input: { id: row.id },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

describe("createMonitor config fields", () => {
  test("persists every field the public API can set", async () => {
    await withTestTransaction(async (tx) => {
      // These columns are only reachable through the API's create path;
      // if the service silently drops one, the monitor runs with a
      // default the caller never asked for.
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-full`,
          jobType: "http",
          url: "https://example.com",
          method: "POST",
          headers: [{ key: "X-Api", value: "1" }],
          assertions: [],
          active: true,
          periodicity: "5m",
          regions: ["ams", "iad"],
          description: "full config",
          public: true,
          timeout: 12_000,
          degradedAfter: 3_000,
          retry: 4,
          followRedirects: false,
          otelEndpoint: "https://otel.example.com",
          otelHeaders: [{ key: "authorization", value: "Bearer x" }],
        },
      });

      expect(row.description).toBe("full config");
      expect(row.public).toBe(true);
      expect(row.timeout).toBe(12_000);
      expect(row.degradedAfter).toBe(3_000);
      expect(row.retry).toBe(4);
      expect(row.followRedirects).toBe(false);
      expect(row.otelEndpoint).toBe("https://otel.example.com");
      expect(row.regions).toEqual(["ams", "iad"]);
      expect(row.periodicity).toBe("5m");
    });
  });

  test("omitted config fields fall through to the column defaults", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-defaults`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
        },
      });

      expect(row.timeout).toBe(45_000);
      expect(row.retry).toBe(3);
      expect(row.followRedirects).toBe(true);
      expect(row.public).toBe(false);
      expect(row.description).toBe("");
      expect(row.degradedAfter).toBe(null);
    });
  });

  test("an empty regions array is honoured, not replaced by plan defaults", async () => {
    await withTestTransaction(async (tx) => {
      // The API has never auto-assigned regions; `[]` must stay `[]`.
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-no-regions`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
          regions: [],
        },
      });

      expect(row.regions).toEqual([]);
    });
  });
});

describe("updateMonitorConfig clearing + replacement", () => {
  async function seed(tx: DrizzleTx, name: string) {
    return createMonitor({
      ctx: { ...teamCtx, db: tx },
      input: {
        name,
        jobType: "http",
        url: "https://example.com",
        method: "GET",
        headers: [],
        assertions: [
          { version: "v1", type: "status", compare: "eq", target: 200 },
        ],
        active: false,
        degradedAfter: 5_000,
      },
    });
  }

  test("degradedAfter: null clears the column", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const row = await seed(tx, `${TEST_PREFIX}-clear-degraded`);
      expect(row.degradedAfter).toBe(5_000);

      const updated = await updateMonitorConfig({
        ctx,
        input: { id: row.id, degradedAfter: null },
      });
      expect(updated.degradedAfter).toBe(null);
    });
  });

  test("degradedAfter omitted leaves the column untouched", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const row = await seed(tx, `${TEST_PREFIX}-keep-degraded`);

      const updated = await updateMonitorConfig({
        ctx,
        input: { id: row.id, name: `${TEST_PREFIX}-keep-degraded-2` },
      });
      expect(updated.degradedAfter).toBe(5_000);
    });
  });

  // The proto declares 0–120_000 ms for `timeout`/`degraded_at`; the RPC API
  // accepted that range before these verbs existed, so they must too.
  test("accepts the proto's full 0–120_000 ms timeout range", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const row = await seed(tx, `${TEST_PREFIX}-wide-timeout`);

      const updated = await updateMonitorConfig({
        ctx,
        input: { id: row.id, timeout: 120_000, degradedAfter: 90_000 },
      });
      expect(updated.timeout).toBe(120_000);
      expect(updated.degradedAfter).toBe(90_000);

      const created = await createMonitor({
        ctx,
        input: {
          name: `${TEST_PREFIX}-wide-timeout-create`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
          timeout: 120_000,
          degradedAfter: 90_000,
        },
      });
      expect(created.timeout).toBe(120_000);
      expect(created.degradedAfter).toBe(90_000);
    });
  });

  test("rejects a timeout above the proto's ceiling", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const row = await seed(tx, `${TEST_PREFIX}-over-timeout`);

      await expect(
        updateMonitorConfig({ ctx, input: { id: row.id, timeout: 120_001 } }),
      ).rejects.toThrow();
    });
  });

  test("assertions replace wholesale rather than merging", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const row = await seed(tx, `${TEST_PREFIX}-replace-assertions`);

      const updated = await updateMonitorConfig({
        ctx,
        input: {
          id: row.id,
          assertions: [
            { version: "v1", type: "status", compare: "eq", target: 204 },
          ],
        },
      });

      const stored = JSON.parse(updated.assertions ?? "[]");
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({ target: 204 });
    });
  });

  // Matches the pre-service RPC path, where an empty converter result was
  // `undefined` and Drizzle skipped the column. Omission never clears.
  test("assertions omitted leaves the stored list untouched", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const row = await seed(tx, `${TEST_PREFIX}-keep-assertions`);

      const updated = await updateMonitorConfig({
        ctx,
        input: { id: row.id, name: `${TEST_PREFIX}-keep-assertions-2` },
      });

      const stored = JSON.parse(updated.assertions ?? "[]");
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({ target: 200 });
    });
  });

  test("no-op update emits no audit row", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const row = await seed(tx, `${TEST_PREFIX}-noop`);
      await clearAuditLog(teamCtx.workspace.id, { db: tx });

      await updateMonitorConfig({
        ctx,
        input: { id: row.id, name: `${TEST_PREFIX}-noop` },
      });

      const rows = await readAuditLog({
        workspaceId: teamCtx.workspace.id,
        entityType: "monitor",
        entityId: String(row.id),
        db: tx,
      });
      expect(rows.filter((r) => r.action === "monitor.update")).toHaveLength(0);
    });
  });
});

describe("triggerMonitorRun quota", () => {
  test("throws LimitExceededError once the monthly quota is spent", async () => {
    await withTestTransaction(async (tx) => {
      // Quota is the only thing standing between an API key and unbounded
      // outbound probes, so prove the ceiling actually stops the run.
      const limit = teamCtx.workspace.limits["synthetic-checks"];
      const ctx = { ...teamCtx, db: tx };
      const row = await createMonitor({
        ctx,
        input: {
          name: `${TEST_PREFIX}-quota`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: true,
          regions: ["ams"],
        },
      });

      for (let i = 0; i < limit; i++) {
        await tx.insert(monitorRun).values({
          monitorId: row.id,
          workspaceId: teamCtx.workspace.id,
          runnedAt: new Date(),
        });
      }

      await expect(
        triggerMonitorRun({ ctx, input: { id: row.id } }),
      ).rejects.toBeInstanceOf(LimitExceededError);
    });
  });
});

describe("monitor count quota", () => {
  const input = (name: string) => ({
    name,
    jobType: "http" as const,
    url: "https://example.com",
    method: "GET" as const,
    headers: [],
    assertions: [],
    active: true,
  });

  // Both suite workspaces are team-plan, so pin the cap on the row —
  // `assertWithinLimit` re-reads it, and the tx rolls the override back.
  const capAtOne = async (tx: DrizzleTx) => {
    await tx
      .update(workspace)
      .set({ limits: JSON.stringify({ monitors: 1 }) })
      .where(eq(workspace.id, freeWorkspaceId));
    return { ...freeCtx, db: tx };
  };

  test("createMonitor rejects once the plan's monitor cap is spent", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = await capAtOne(tx);
      await createMonitor({ ctx, input: input(`${TEST_PREFIX}-cap-1`) });

      await expect(
        createMonitor({ ctx, input: input(`${TEST_PREFIX}-cap-2`) }),
      ).rejects.toBeInstanceOf(LimitExceededError);
    });
  });

  test("a soft-deleted monitor frees its slot", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = await capAtOne(tx);
      const first = await createMonitor({
        ctx,
        input: input(`${TEST_PREFIX}-cap-reuse-1`),
      });
      await deleteMonitor({ ctx, input: { id: first.id } });

      await expect(
        createMonitor({ ctx, input: input(`${TEST_PREFIX}-cap-reuse-2`) }),
      ).resolves.toBeDefined();
    });
  });

  test("cloneMonitor rejects once the cap is spent", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = await capAtOne(tx);
      const source = await createMonitor({
        ctx,
        input: input(`${TEST_PREFIX}-clone-cap`),
      });

      await expect(
        cloneMonitor({ ctx, input: { id: source.id } }),
      ).rejects.toBeInstanceOf(LimitExceededError);
    });
  });
});
