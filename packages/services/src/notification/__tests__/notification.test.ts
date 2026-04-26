import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db, eq } from "@openstatus/db";
import {
  monitor,
  notification,
  notificationsToMonitors,
} from "@openstatus/db/src/schema";

import {
  SEEDED_WORKSPACE_FREE_ID,
  SEEDED_WORKSPACE_TEAM_ID,
} from "../../../test/fixtures";
import {
  cleanQuotaGatedTables,
  expectAuditRow,
  loadSeededWorkspace,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import {
  ForbiddenError,
  LimitExceededError,
  NotFoundError,
  ValidationError,
} from "../../errors";
import { createNotification } from "../create";
import { deleteNotification } from "../delete";
import { getNotification, listNotifications } from "../list";
import { updateNotification } from "../update";

const TEST_PREFIX = "svc-notification-test";

let teamCtx: ServiceContext;
let freeCtx: ServiceContext;
let teamMonitorId: number;

beforeAll(async () => {
  const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  const free = await loadSeededWorkspace(SEEDED_WORKSPACE_FREE_ID);
  teamCtx = makeUserCtx(team, { userId: 1 });
  freeCtx = makeUserCtx(free, { userId: 2 });

  // Clear quota-gated rows on the free workspace so
  // `notification-channels: 1` (free plan) can actually be exercised
  // by negative-path tests — any leftover row from prior runs tripped
  // `LimitExceededError` before the intended assertion fired.
  await cleanQuotaGatedTables(SEEDED_WORKSPACE_FREE_ID);

  const monitorRow = await db
    .insert(monitor)
    .values({
      workspaceId: team.id,
      active: true,
      url: "https://example.com",
      name: `${TEST_PREFIX}-monitor`,
      method: "GET",
      periodicity: "10m",
      regions: "ams",
    })
    .returning()
    .get();
  teamMonitorId = monitorRow.id;
});

afterAll(async () => {
  await db
    .delete(monitor)
    .where(eq(monitor.id, teamMonitorId))
    .catch(() => undefined);
});

describe("createNotification", () => {
  test("creates a discord channel with monitors + audits", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const row = await createNotification({
        ctx,
        input: {
          name: `${TEST_PREFIX}-discord`,
          provider: "discord",
          data: { discord: "https://discord.com/api/webhooks/1/abc" },
          monitors: [teamMonitorId],
        },
      });
      expect(row.provider).toBe("discord");

      const assoc = await tx
        .select()
        .from(notificationsToMonitors)
        .where(eq(notificationsToMonitors.notificationId, row.id))
        .all();
      expect(assoc.map((a) => a.monitorId)).toEqual([teamMonitorId]);

      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "notification.create",
        entityType: "notification",
        entityId: row.id,
        db: tx,
      });
    });
  });

  test("throws ValidationError for malformed data", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        createNotification({
          ctx: { ...teamCtx, db: tx },
          input: {
            name: `${TEST_PREFIX}-bad`,
            provider: "discord",
            // missing the required `discord` key
            data: {},
            monitors: [],
          },
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  test("throws ValidationError when data payload key doesn't match provider", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        createNotification({
          ctx: { ...teamCtx, db: tx },
          input: {
            name: `${TEST_PREFIX}-mismatch`,
            provider: "discord",
            // Valid slack payload, but provider is discord → rejected.
            data: { slack: "https://hooks.slack.com/services/x/y/z" },
            monitors: [],
          },
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  test("throws ValidationError when provider payload is malformed but another provider's is valid", async () => {
    await withTestTransaction(async (tx) => {
      // The canonical data schema for the selected provider must match.
      // A plain key-presence check would have missed this: `discord: "not-a-url"`
      // fails `urlSchema`, but a valid `slack` field could've hidden it.
      await expect(
        createNotification({
          ctx: { ...teamCtx, db: tx },
          input: {
            name: `${TEST_PREFIX}-invalid-payload`,
            provider: "discord",
            data: {
              discord: "not-a-url",
              slack: "https://hooks.slack.com/services/x/y/z",
            },
            monitors: [],
          },
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  test("throws LimitExceededError when plan blocks the provider", async () => {
    await withTestTransaction(async (tx) => {
      // free plan has `pagerduty: false`.
      await expect(
        createNotification({
          ctx: { ...freeCtx, db: tx },
          input: {
            name: `${TEST_PREFIX}-gated`,
            provider: "pagerduty",
            data: {
              pagerduty: JSON.stringify({
                integration_keys: [{ id: "k1", integration_key: "x" }],
              }),
            },
            monitors: [],
          },
        }),
      ).rejects.toBeInstanceOf(LimitExceededError);
    });
  });

  test("throws ForbiddenError for cross-workspace monitor", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        createNotification({
          ctx: { ...freeCtx, db: tx },
          input: {
            name: `${TEST_PREFIX}-cross-ws`,
            provider: "discord",
            data: { discord: "https://discord.com/api/webhooks/1/abc" },
            monitors: [teamMonitorId], // team's monitor
          },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});

describe("updateNotification", () => {
  test("replaces name / data / monitor associations", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const row = await createNotification({
        ctx,
        input: {
          name: `${TEST_PREFIX}-update`,
          provider: "discord",
          data: { discord: "https://discord.com/api/webhooks/1/abc" },
          monitors: [teamMonitorId],
        },
      });

      const updated = await updateNotification({
        ctx,
        input: {
          id: row.id,
          name: `${TEST_PREFIX}-update-renamed`,
          data: { discord: "https://discord.com/api/webhooks/2/def" },
          monitors: [],
        },
      });
      expect(updated.name).toBe(`${TEST_PREFIX}-update-renamed`);

      const assoc = await tx
        .select()
        .from(notificationsToMonitors)
        .where(eq(notificationsToMonitors.notificationId, row.id))
        .all();
      expect(assoc).toHaveLength(0);
    });
  });

  test("throws NotFoundError for cross-workspace update", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createNotification({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-cross-ws-update`,
          provider: "discord",
          data: { discord: "https://discord.com/api/webhooks/1/abc" },
          monitors: [],
        },
      });

      await expect(
        updateNotification({
          ctx: { ...freeCtx, db: tx },
          input: {
            id: row.id,
            name: "blocked",
            data: { discord: "https://discord.com/api/webhooks/x/y" },
            monitors: [],
          },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("emits a notification.update audit row", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const row = await createNotification({
        ctx,
        input: {
          name: `${TEST_PREFIX}-update-audit`,
          provider: "discord",
          data: { discord: "https://discord.com/api/webhooks/1/abc" },
          monitors: [],
        },
      });

      await updateNotification({
        ctx,
        input: {
          id: row.id,
          name: `${TEST_PREFIX}-update-audit-renamed`,
          data: { discord: "https://discord.com/api/webhooks/2/def" },
          monitors: [],
        },
      });

      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "notification.update",
        entityType: "notification",
        entityId: row.id,
        db: tx,
      });
    });
  });

  test("throws LimitExceededError when plan gate blocks update", async () => {
    await withTestTransaction(async (tx) => {
      // Regression for the post-downgrade case: the row was created on a
      // plan that allowed pagerduty, but the current workspace no longer
      // does. The pre-fix update flow never re-checked the gate, so an
      // editable form field remained open to channels the plan had since
      // revoked. Simulate it by bypassing the create-time gate with a
      // direct db insert bound to the free workspace.
      const [inserted] = await tx
        .insert(notification)
        .values({
          workspaceId: SEEDED_WORKSPACE_FREE_ID,
          name: `${TEST_PREFIX}-downgrade-gate`,
          provider: "pagerduty",
          data: JSON.stringify({
            pagerduty: JSON.stringify({
              integration_keys: [{ id: "k1", integration_key: "x" }],
            }),
          }),
        })
        .returning();
      if (!inserted) throw new Error("direct insert failed");

      await expect(
        updateNotification({
          ctx: { ...freeCtx, db: tx },
          input: {
            id: inserted.id,
            name: "would-be-rename",
            data: {
              pagerduty: JSON.stringify({
                integration_keys: [{ id: "k1", integration_key: "y" }],
              }),
            },
            monitors: [],
          },
        }),
      ).rejects.toBeInstanceOf(LimitExceededError);
    });
  });
});

describe("deleteNotification", () => {
  test("removes the row", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const row = await createNotification({
        ctx,
        input: {
          name: `${TEST_PREFIX}-delete`,
          provider: "discord",
          data: { discord: "https://discord.com/api/webhooks/1/abc" },
          monitors: [],
        },
      });

      await deleteNotification({ ctx, input: { id: row.id } });

      const remaining = await tx
        .select()
        .from(notification)
        .where(eq(notification.id, row.id))
        .all();
      expect(remaining).toHaveLength(0);
    });
  });
});

describe("list / get", () => {
  test("list returns enriched monitors scoped to the workspace", async () => {
    await withTestTransaction(async (tx) => {
      const teamCtxTx = { ...teamCtx, db: tx };
      const freeCtxTx = { ...freeCtx, db: tx };
      const row = await createNotification({
        ctx: teamCtxTx,
        input: {
          name: `${TEST_PREFIX}-enrich`,
          provider: "discord",
          data: { discord: "https://discord.com/api/webhooks/1/abc" },
          monitors: [teamMonitorId],
        },
      });

      const full = await getNotification({
        ctx: teamCtxTx,
        input: { id: row.id },
      });
      expect(full.monitors.map((m) => m.id)).toEqual([teamMonitorId]);

      await expect(
        getNotification({ ctx: freeCtxTx, input: { id: row.id } }),
      ).rejects.toBeInstanceOf(NotFoundError);

      const { items: freeItems } = await listNotifications({
        ctx: freeCtxTx,
        input: { limit: 100, offset: 0, order: "desc" },
      });
      expect(freeItems.find((n) => n.id === row.id)).toBeUndefined();
    });
  });
});
