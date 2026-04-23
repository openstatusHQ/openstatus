import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { db, eq, inArray } from "@openstatus/db";
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
  expectAuditRow,
  loadSeededWorkspace,
  makeUserCtx,
  withAuditBuffer,
} from "../../../test/helpers";
import type { AuditLogRecord } from "../../audit";
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
let auditBuffer: AuditLogRecord[];
let auditReset: () => void;
const createdNotificationIds: number[] = [];

beforeAll(async () => {
  const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  const free = await loadSeededWorkspace(SEEDED_WORKSPACE_FREE_ID);
  teamCtx = makeUserCtx(team, { userId: 1 });
  freeCtx = makeUserCtx(free, { userId: 2 });

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
  if (createdNotificationIds.length > 0) {
    await db
      .delete(notification)
      .where(inArray(notification.id, createdNotificationIds))
      .catch(() => undefined);
  }
  await db
    .delete(monitor)
    .where(eq(monitor.id, teamMonitorId))
    .catch(() => undefined);
});

beforeEach(() => {
  const hooks = withAuditBuffer();
  auditBuffer = hooks.buffer;
  auditReset = hooks.reset;
});

afterEach(() => {
  auditReset();
});

function track(id: number) {
  createdNotificationIds.push(id);
  return id;
}

describe("createNotification", () => {
  test("creates a discord channel with monitors + audits", async () => {
    const row = await createNotification({
      ctx: teamCtx,
      input: {
        name: `${TEST_PREFIX}-discord`,
        provider: "discord",
        data: { discord: "https://discord.com/api/webhooks/1/abc" },
        monitors: [teamMonitorId],
      },
    });
    track(row.id);
    expect(row.provider).toBe("discord");

    const assoc = await db
      .select()
      .from(notificationsToMonitors)
      .where(eq(notificationsToMonitors.notificationId, row.id))
      .all();
    expect(assoc.map((a) => a.monitorId)).toEqual([teamMonitorId]);

    await expectAuditRow(auditBuffer, {
      action: "notification.create",
      entityType: "notification",
      entityId: row.id,
    });
  });

  test("throws ValidationError for malformed data", async () => {
    await expect(
      createNotification({
        ctx: teamCtx,
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

  test("throws LimitExceededError when plan blocks the provider", async () => {
    // free plan has `pagerduty: false`.
    await expect(
      createNotification({
        ctx: freeCtx,
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

  test("throws ForbiddenError for cross-workspace monitor", async () => {
    await expect(
      createNotification({
        ctx: freeCtx,
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

describe("updateNotification", () => {
  test("replaces name / data / monitor associations", async () => {
    const row = await createNotification({
      ctx: teamCtx,
      input: {
        name: `${TEST_PREFIX}-update`,
        provider: "discord",
        data: { discord: "https://discord.com/api/webhooks/1/abc" },
        monitors: [teamMonitorId],
      },
    });
    track(row.id);

    const updated = await updateNotification({
      ctx: teamCtx,
      input: {
        id: row.id,
        name: `${TEST_PREFIX}-update-renamed`,
        data: { discord: "https://discord.com/api/webhooks/2/def" },
        monitors: [],
      },
    });
    expect(updated.name).toBe(`${TEST_PREFIX}-update-renamed`);

    const assoc = await db
      .select()
      .from(notificationsToMonitors)
      .where(eq(notificationsToMonitors.notificationId, row.id))
      .all();
    expect(assoc).toHaveLength(0);
  });

  test("throws NotFoundError for cross-workspace update", async () => {
    const row = await createNotification({
      ctx: teamCtx,
      input: {
        name: `${TEST_PREFIX}-cross-ws-update`,
        provider: "discord",
        data: { discord: "https://discord.com/api/webhooks/1/abc" },
        monitors: [],
      },
    });
    track(row.id);

    await expect(
      updateNotification({
        ctx: freeCtx,
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

describe("deleteNotification", () => {
  test("removes the row", async () => {
    const row = await createNotification({
      ctx: teamCtx,
      input: {
        name: `${TEST_PREFIX}-delete`,
        provider: "discord",
        data: { discord: "https://discord.com/api/webhooks/1/abc" },
        monitors: [],
      },
    });
    track(row.id);

    await deleteNotification({ ctx: teamCtx, input: { id: row.id } });

    const remaining = await db
      .select()
      .from(notification)
      .where(eq(notification.id, row.id))
      .all();
    expect(remaining).toHaveLength(0);
  });
});

describe("list / get", () => {
  test("list returns enriched monitors scoped to the workspace", async () => {
    const row = await createNotification({
      ctx: teamCtx,
      input: {
        name: `${TEST_PREFIX}-enrich`,
        provider: "discord",
        data: { discord: "https://discord.com/api/webhooks/1/abc" },
        monitors: [teamMonitorId],
      },
    });
    track(row.id);

    const full = await getNotification({
      ctx: teamCtx,
      input: { id: row.id },
    });
    expect(full.monitors.map((m) => m.id)).toEqual([teamMonitorId]);

    await expect(
      getNotification({ ctx: freeCtx, input: { id: row.id } }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const { items: freeItems } = await listNotifications({
      ctx: freeCtx,
      input: { limit: 100, offset: 0, order: "desc" },
    });
    expect(freeItems.find((n) => n.id === row.id)).toBeUndefined();
  });
});
