import { db, eq } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";
import { createMonitor } from "@openstatus/db/src/test/factories";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  clearAuditLog,
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError } from "../../errors";
import { createMonitorReporting } from "../create";
import { previewMonitorReportingExcusedWindow } from "../preview-excused-window";
import {
  type EpisodesCall,
  episodesPipesFrom,
  failingEpisodesPipes,
  runsEvery,
} from "./fixtures/episodes-pipes";

const now = new Date(Date.UTC(2026, 10, 13, 12));
const nov = (d: number, h = 0) => new Date(Date.UTC(2026, 10, d, h));
const MIN = 60_000;

let ownerCtx: ServiceContext;
let otherCtx: ServiceContext;
let freeCtx: ServiceContext;
let apiId: number;
let webId: number;
const workspaceIds: number[] = [];

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  const other = await createWorkspaceFixture("team");
  const free = await createWorkspaceFixture("free");
  workspaceIds.push(team.workspace.id, other.workspace.id, free.workspace.id);
  ownerCtx = makeUserCtx(team.workspace, { userId: team.userId });
  otherCtx = makeUserCtx(other.workspace, { userId: other.userId });
  freeCtx = makeUserCtx(free.workspace, { userId: free.userId });
  apiId = (
    await createMonitor(team.workspace.id, {
      name: "API",
      regions: "fra",
      periodicity: "1m",
    })
  ).id;
  webId = (
    await createMonitor(team.workspace.id, {
      name: "Web",
      regions: "fra",
      periodicity: "1m",
    })
  ).id;
});

afterAll(async () => {
  for (const id of workspaceIds) {
    await clearAuditLog(id);
    await db.delete(monitor).where(eq(monitor.workspaceId, id));
  }
});

type Tx = Parameters<Parameters<typeof withTestTransaction>[0]>[0];

function policyIn(tx: Tx) {
  return createMonitorReporting({
    ctx: { ...ownerCtx, db: tx },
    input: { name: "Partner", target: 99_500, monitorIds: [apiId, webId] },
  });
}

describe("previewMonitorReportingExcusedWindow", () => {
  test("counts the runs each monitor recorded inside the window", async () => {
    await withTestTransaction(async (tx) => {
      const policy = await policyIn(tx);
      // API ran through the window; Web was paused for it
      const pipes = episodesPipesFrom((id) =>
        id === String(apiId)
          ? runsEvery(nov(1).getTime(), nov(3).getTime(), MIN)
          : [
              ...runsEvery(nov(1).getTime(), nov(1, 22).getTime(), MIN),
              ...runsEvery(nov(2, 22).getTime(), nov(3).getTime(), MIN),
            ],
      );

      const res = await previewMonitorReportingExcusedWindow({
        ctx: { ...ownerCtx, db: tx },
        input: { policyId: policy.id, from: nov(1, 22), to: nov(2, 22) },
        now,
        episodesPipes: pipes,
      });

      expect(res.monitors).toEqual([
        { id: apiId, name: "API", runs: 24 * 60 },
        { id: webId, name: "Web", runs: 0 },
      ]);
    });
  });

  test("a window that has not ended cannot be told, and is not read", async () => {
    await withTestTransaction(async (tx) => {
      const policy = await policyIn(tx);
      const calls: EpisodesCall[] = [];

      const res = await previewMonitorReportingExcusedWindow({
        ctx: { ...ownerCtx, db: tx },
        input: { policyId: policy.id, from: nov(13), to: nov(14) },
        now,
        episodesPipes: episodesPipesFrom(() => [], calls),
      });

      expect(res.monitors.map((m) => m.runs)).toEqual([null, null]);
      expect(calls).toHaveLength(0);
    });
  });

  test("a failed read cannot be told", async () => {
    await withTestTransaction(async (tx) => {
      const policy = await policyIn(tx);

      const res = await previewMonitorReportingExcusedWindow({
        ctx: { ...ownerCtx, db: tx },
        input: { policyId: policy.id, from: nov(1), to: nov(2) },
        now,
        episodesPipes: failingEpisodesPipes(),
        sleep: async () => {},
      });

      expect(res.monitors.map((m) => m.runs)).toEqual([null, null]);
    });
  });

  test("a window longer than 7 days is refused", async () => {
    await expect(
      previewMonitorReportingExcusedWindow({
        ctx: ownerCtx,
        input: { policyId: 1, from: nov(1), to: nov(9) },
        now,
      }),
    ).rejects.toThrow();
  });

  test("another workspace's policy is not found", async () => {
    await withTestTransaction(async (tx) => {
      const policy = await policyIn(tx);
      await expect(
        previewMonitorReportingExcusedWindow({
          ctx: { ...otherCtx, db: tx },
          input: { policyId: policy.id, from: nov(1), to: nov(2) },
          now,
          episodesPipes: failingEpisodesPipes(),
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("needs the monitor-sla limit", async () => {
    await expect(
      previewMonitorReportingExcusedWindow({
        ctx: freeCtx,
        input: { policyId: 1, from: nov(1), to: nov(2) },
        now,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("a key needs monitors:read", async () => {
    const key = makeApiKeyCtx(ownerCtx.workspace, {
      keyId: "k",
      scopes: ["incidents:read"],
    });
    await expect(
      previewMonitorReportingExcusedWindow({
        ctx: key,
        input: { policyId: 1, from: nov(1), to: nov(2) },
        now,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
