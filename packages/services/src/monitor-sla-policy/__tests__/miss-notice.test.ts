import { db, eq, inArray } from "@openstatus/db";
import {
  monitor,
  monitorSlaPolicy,
  monitorSlaPolicyToMonitor,
  user,
  usersToWorkspaces,
} from "@openstatus/db/src/schema";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  withTestTransaction,
} from "../../../test/helpers";
import type { SlaEpisodesPipes } from "../fetch-episodes";
import { claimMonitorSlaMissNotices } from "../miss-notice";
import { sealMonitorSlaMonths } from "../seal";
import {
  episodesPipesFrom,
  failingEpisodesPipes,
  runsEvery,
} from "./fixtures/episodes-pipes";

const OCT_END = Date.UTC(2026, 10, 1);
const now = new Date(OCT_END + 4 * 24 * 3_600_000);
const beforeOctEnd = new Date(Date.UTC(2026, 9, 10));
const month = "2026-10-01";
const HOUR = 3_600_000;
// covered: Oct 10 to Nov 1
const COVERED_HOURS = 22 * 24;
const uptimeAfter = (downHours: number) =>
  Math.floor(((COVERED_HOURS - downHours) * 100_000) / COVERED_HOURS);

let workspaceId: number;
let ownerEmail: string;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  workspaceId = fixture.workspace.id;
  const owner = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, fixture.userId))
    .get();
  ownerEmail = owner?.email ?? "";
});

type Tx = Parameters<Parameters<typeof withTestTransaction>[0]>[0];
type Db = Tx | typeof db;

const downHoursOf = new Map<number, number>();

/** Runs every 10 minutes; each monitor fails for its first `downHours` from Oct 10. */
const runsOf = (id: string) =>
  runsEvery(Date.UTC(2026, 9, 1), Date.UTC(2026, 10, 10), 600_000, (t) =>
    t - beforeOctEnd.getTime() < (downHoursOf.get(Number(id)) ?? 0) * HOUR &&
    t >= beforeOctEnd.getTime()
      ? "error"
      : "ok",
  );
const readable = episodesPipesFrom(runsOf);
// tcp monitors' episodes cannot be read
const tcpDown: SlaEpisodesPipes = {
  ...readable,
  tcp: failingEpisodesPipes().tcp,
};
const sleep = async () => {};
const seal = (
  tx: Db | undefined,
  at: Date,
  policyId: number,
  episodesPipes = tcpDown,
) =>
  sealMonitorSlaMonths({
    db: tx,
    now: at,
    policyIds: [policyId],
    episodesPipes,
    sleep,
  });

async function setup(
  tx: Db,
  monitors: { name: string; downHours: number; readable?: false }[],
) {
  const policy = await tx
    .insert(monitorSlaPolicy)
    .values({
      workspaceId,
      name: "Partner contract",
      target: 99_500,
      createdAt: beforeOctEnd,
    })
    .returning()
    .get();
  const ids: number[] = [];
  for (const m of monitors) {
    const row = await tx
      .insert(monitor)
      .values({
        workspaceId,
        active: true,
        url: "https://example.com",
        name: m.name,
        periodicity: "10m",
        regions: "ams",
        jobType: m.readable === false ? "tcp" : "http",
      })
      .returning()
      .get();
    ids.push(row.id);
    downHoursOf.set(row.id, m.downHours);
    await tx.insert(monitorSlaPolicyToMonitor).values({
      monitorSlaPolicyId: policy.id,
      monitorId: row.id,
      createdAt: beforeOctEnd,
    });
  }
  return { policy, monitorIds: ids };
}

describe("claimMonitorSlaMissNotices", () => {
  test("one notice per policy and month, listing only the monitors that missed", async () => {
    await withTestTransaction(async (tx) => {
      const { policy, monitorIds } = await setup(tx, [
        { name: "API", downHours: 6 },
        { name: "Web", downHours: 0 },
        { name: "Auth", downHours: 12 },
      ]);
      await seal(tx, now, policy.id);

      const notices = await claimMonitorSlaMissNotices({
        db: tx,
        month,
        policyIds: [policy.id],
      });

      expect(notices).toEqual([
        {
          month,
          workspaceId,
          workspaceName: expect.any(String),
          to: [ownerEmail],
          policy: {
            id: policy.id,
            name: "Partner contract",
            target: 99_500,
            strict: false,
          },
          monitors: [
            {
              id: monitorIds[0],
              name: "API",
              uptime: uptimeAfter(6),
              target: 99_500,
            },
            {
              id: monitorIds[2],
              name: "Auth",
              uptime: uptimeAfter(12),
              target: 99_500,
            },
          ],
        },
      ]);
      expect(
        await claimMonitorSlaMissNotices({
          db: tx,
          month,
          policyIds: [policy.id],
        }),
      ).toEqual([]);
    });
  });

  test("reports the terms the month was sealed with, not the policy row's", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx, [{ name: "API", downHours: 6 }]);
      await seal(tx, now, policy.id);
      await tx
        .update(monitorSlaPolicy)
        .set({ target: 90_000, strict: true })
        .where(eq(monitorSlaPolicy.id, policy.id));
      const [notice] = await claimMonitorSlaMissNotices({
        db: tx,
        month,
        policyIds: [policy.id],
      });
      expect(notice?.policy).toMatchObject({ target: 99_500, strict: false });
    });
  });

  test("no notice when every monitor met the target", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx, [{ name: "API", downHours: 0 }]);
      await seal(tx, now, policy.id);
      expect(
        await claimMonitorSlaMissNotices({
          db: tx,
          month,
          policyIds: [policy.id],
        }),
      ).toEqual([]);
    });
  });

  test("a month missed but not sealed yet gets no notice", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx, [{ name: "API", downHours: 24 }]);
      expect(
        await claimMonitorSlaMissNotices({
          db: tx,
          month,
          policyIds: [policy.id],
        }),
      ).toEqual([]);
    });
  });

  test("an archived policy gets no notice", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx, [{ name: "API", downHours: 24 }]);
      await seal(tx, now, policy.id);
      await tx
        .update(monitorSlaPolicy)
        .set({ archivedAt: now })
        .where(eq(monitorSlaPolicy.id, policy.id));
      expect(
        await claimMonitorSlaMissNotices({
          db: tx,
          month,
          policyIds: [policy.id],
        }),
      ).toEqual([]);
    });
  });

  test("waits while another member's episodes cannot be read, then lists every miss", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx, [
        { name: "API", downHours: 24 },
        { name: "Web", downHours: 24, readable: false },
      ]);
      await seal(tx, now, policy.id);
      const claim = (at: Date) =>
        claimMonitorSlaMissNotices({
          db: tx,
          month,
          now: at,
          policyIds: [policy.id],
        });
      expect(await claim(now)).toEqual([]);

      const next = new Date(now.getTime() + 24 * 3_600_000);
      await seal(tx, next, policy.id, readable);
      const [notice] = await claim(next);
      expect(notice?.monitors.map((m) => m.name)).toEqual(["API", "Web"]);
    });
  });

  test("waits while a member's counts could not be read", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx, [{ name: "API", downHours: 24 }]);
      await seal(tx, now, policy.id);
      expect(
        await claimMonitorSlaMissNotices({
          db: tx,
          month,
          now,
          policyIds: [policy.id],
          unavailablePolicyIds: [policy.id],
        }),
      ).toEqual([]);
    });
  });

  test("on the last day of the seal window it sends with what is sealed", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx, [
        { name: "API", downHours: 24 },
        { name: "Web", downHours: 24, readable: false },
      ]);
      // October started Oct 1; the last daily run inside 45 days is on Nov 14
      const lastDay = new Date(
        Date.UTC(2026, 9, 1) + 45 * 86_400_000 - 3_600_000,
      );
      await seal(tx, lastDay, policy.id);
      const [notice] = await claimMonitorSlaMissNotices({
        db: tx,
        month,
        now: lastDay,
        policyIds: [policy.id],
        unavailablePolicyIds: [policy.id],
      });
      expect(notice?.monitors.map((m) => m.name)).toEqual(["API"]);
    });
  });

  test("only owners receive it", async () => {
    await withTestTransaction(async (tx) => {
      const member = await tx
        .insert(user)
        .values({ email: `sla-member-${Date.now()}@openstatus.dev` })
        .returning()
        .get();
      await tx
        .insert(usersToWorkspaces)
        .values({ userId: member.id, workspaceId, role: "member" });
      const { policy } = await setup(tx, [{ name: "API", downHours: 24 }]);
      await seal(tx, now, policy.id);
      const [notice] = await claimMonitorSlaMissNotices({
        db: tx,
        month,
        policyIds: [policy.id],
      });
      expect(notice?.to).toEqual([ownerEmail]);
    });
  });
});

describe("claimMonitorSlaMissNotices on two machines at once", () => {
  let policyId: number | undefined;
  let monitorIds: number[] = [];

  afterAll(async () => {
    if (policyId) {
      await db
        .delete(monitorSlaPolicy)
        .where(eq(monitorSlaPolicy.id, policyId));
    }
    if (monitorIds.length > 0) {
      await db.delete(monitor).where(inArray(monitor.id, monitorIds));
    }
  });

  test("seal and claim together send one notice", async () => {
    const created = await setup(db, [
      { name: "race-a", downHours: 24 },
      { name: "race-b", downHours: 24 },
    ]);
    policyId = created.policy.id;
    monitorIds = created.monitorIds;

    const machine = async () => {
      await seal(undefined, now, created.policy.id);
      return claimMonitorSlaMissNotices({
        month,
        policyIds: [created.policy.id],
      });
    };
    const results = await Promise.all([machine(), machine()]);

    const notices = results.flat();
    expect(notices).toHaveLength(1);
    expect(notices[0]?.monitors.map((m) => m.name)).toEqual([
      "race-a",
      "race-b",
    ]);
  });
});
