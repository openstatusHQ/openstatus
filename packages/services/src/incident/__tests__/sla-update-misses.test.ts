import { eq } from "@openstatus/db";
import { incident } from "@openstatus/db/src/schema";
import {
  createIncident,
  createIncidentEvent,
} from "@openstatus/db/src/test/factories";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB, ServiceContext } from "../../context";
import { upsertIncidentReporting } from "../../incident-reporting";
import type { Workspace } from "../../types";
import {
  addIncidentNote,
  declareIncident,
  listIncidentEvents,
  recordIncidentMissedUpdates,
  setIncidentStatus,
} from "../index";
import { dueStaleReminders } from "../reminders";

let team: Workspace;
let ownerId: number;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  team = fixture.workspace;
  ownerId = fixture.userId;
});

const withDb = (ctx: ServiceContext, tx: DB): ServiceContext => ({
  ...ctx,
  db: tx,
});
const owner = (tx: DB) => withDb(makeUserCtx(team, { userId: ownerId }), tx);
const apiKey = (tx: DB) => withDb(makeApiKeyCtx(team, { keyId: "k_miss" }), tx);

const MINUTE = 60_000;

async function policy(tx: DB) {
  await upsertIncidentReporting({
    ctx: owner(tx),
    input: {
      targets: {
        critical: { responseMinutes: 60, updateMinutes: 60 },
        major: { updateMinutes: 120 },
        minor: { resolutionMinutes: 4320 },
      },
      resolutionStop: "mitigated",
    },
  });
}

// Declared 300 minutes before `at(300)`; the DB stores seconds.
async function declare(
  tx: DB,
  severity: "critical" | "major" | "minor" = "major",
  withPolicy = true,
) {
  if (withPolicy) await policy(tx);
  const row = await declareIncident({
    ctx: apiKey(tx),
    input: { title: "Checkout down", severity },
  });
  const declaredAt = new Date(
    Math.floor((Date.now() - 300 * MINUTE) / 1000) * 1000,
  );
  await tx.update(incident).set({ declaredAt }).where(eq(incident.id, row.id));
  return {
    id: row.id,
    at: (m: number) => new Date(declaredAt.getTime() + m * MINUTE),
  };
}

const tick = (tx: DB, now: Date, limit?: number) =>
  recordIncidentMissedUpdates({
    db: tx,
    now,
    workspaceIds: [team.id],
    limit,
  });

async function misses(tx: DB, id: number) {
  const events = await listIncidentEvents({ ctx: owner(tx), input: { id } });
  return events
    .filter((e) => e.type === "sla_update_missed")
    .map((e) => [e.createdAt, e.message, e.createdBy, e.source])
    .reverse();
}

describe("the tick records missed updates", () => {
  test("one event per elapsed interval at its due time, never twice", async () => {
    await withTestTransaction(async (tx) => {
      const { id, at } = await declare(tx);
      const recorded = await tick(tx, at(300));
      expect(recorded.map((r) => [r.incident.id, r.dueAt])).toEqual([
        [id, at(120)],
        [id, at(240)],
      ]);
      expect(await misses(tx, id)).toEqual([
        [
          at(120),
          `Update due ${at(120).toISOString()} missed (every 2h)`,
          null,
          "system",
        ],
        [
          at(240),
          `Update due ${at(240).toISOString()} missed (every 2h)`,
          null,
          "system",
        ],
      ]);
      expect(await tick(tx, at(300))).toEqual([]);
      expect(await misses(tx, id)).toHaveLength(2);
    });
  });

  test("a long gap is written oldest first, a bounded number per tick", async () => {
    await withTestTransaction(async (tx) => {
      const { id, at } = await declare(tx, "critical");
      const dueTimes = async (now: Date) =>
        (await tick(tx, now, 2)).map((r) => r.dueAt);
      expect(await dueTimes(at(300))).toEqual([at(60), at(120)]);
      expect(await dueTimes(at(300))).toEqual([at(180), at(240)]);
      expect(await dueTimes(at(300))).toEqual([]);
      expect((await misses(tx, id)).map(([at]) => at)).toEqual([
        at(60),
        at(120),
        at(180),
        at(240),
      ]);
    });
  });

  test("an update restarts the interval; nothing is recorded before its new due time", async () => {
    await withTestTransaction(async (tx) => {
      const { id, at } = await declare(tx);
      expect((await tick(tx, at(130))).map((r) => r.dueAt)).toEqual([at(120)]);
      await addIncidentNote({
        ctx: owner(tx),
        input: { id, message: "Rolled back", createdAt: at(200) },
      });
      expect(await tick(tx, at(300))).toEqual([]);
      expect((await tick(tx, at(330))).map((r) => r.dueAt)).toEqual([at(320)]);
    });
  });

  test("nothing after the stop state", async () => {
    await withTestTransaction(async (tx) => {
      const { id, at } = await declare(tx);
      await setIncidentStatus({
        ctx: apiKey(tx),
        input: { id, status: "mitigated" },
      });
      expect(await tick(tx, at(300))).toEqual([]);
      expect(await misses(tx, id)).toEqual([]);
    });
  });

  test("nothing for an untracked incident or a severity without an update target", async () => {
    await withTestTransaction(async (tx) => {
      const untracked = await declare(tx, "major", false);
      const minor = await declare(tx, "minor");
      expect(await tick(tx, untracked.at(300))).toEqual([]);
      expect(await misses(tx, untracked.id)).toEqual([]);
      expect(await misses(tx, minor.id)).toEqual([]);
    });
  });

  test("recorded misses never count as activity", async () => {
    await withTestTransaction(async (tx) => {
      const { at } = await declare(tx);
      await tick(tx, at(130));
      expect((await tick(tx, at(250))).map((r) => r.dueAt)).toEqual([at(240)]);
    });
  });
});

describe("the stale reminder", () => {
  const dueIds = async (tx: DB, now?: Date) =>
    (await dueStaleReminders({ db: tx, now: now ?? new Date() })).map(
      (d) => d.incident.id,
    );

  test("is replaced by an active update cadence", async () => {
    await withTestTransaction(async (tx) => {
      const { id } = await declare(tx);
      expect(await dueIds(tx)).not.toContain(id);
    });
  });

  test("applies once the cadence ends, and ignores system events", async () => {
    await withTestTransaction(async (tx) => {
      const { id, at } = await declare(tx);
      await tick(tx, at(300));
      await setIncidentStatus({
        ctx: apiKey(tx),
        input: { id, status: "mitigated" },
      });
      // the status change is the last activity; a later system event is not
      await createIncidentEvent(
        id,
        { type: "sla_update_missed", createdAt: at(600) },
        tx,
      );
      const due = (
        await dueStaleReminders({ db: tx, now: at(300 + 5 * 60) })
      ).find((d) => d.incident.id === id);
      expect(due?.lastActivity.getTime()).toBeLessThan(at(301).getTime());
    });
  });

  test("is unchanged for an untracked incident", async () => {
    await withTestTransaction(async (tx) => {
      const stale = new Date(Date.now() - 5 * 60 * MINUTE);
      const row = await createIncident(
        team.id,
        { declaredAt: stale, severity: "major" },
        tx,
      );
      await createIncidentEvent(row.id, { createdAt: stale }, tx);
      expect(await dueIds(tx)).toContain(row.id);
    });
  });
});
