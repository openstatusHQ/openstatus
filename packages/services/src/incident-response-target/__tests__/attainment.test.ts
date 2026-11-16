import type { IncidentTargetSnapshot } from "@openstatus/db/src/schema/incident_response_targets/constants";
import { createIncident } from "@openstatus/db/src/test/factories";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB, ServiceContext } from "../../context";
import { ForbiddenError } from "../../errors";
import type { Workspace } from "../../types";
import { getIncidentTargetAttainment } from "../attainment";

let team: Workspace;
let free: Workspace;
let ownerId: number;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  team = fixture.workspace;
  ownerId = fixture.userId;
  free = (await createWorkspaceFixture("free")).workspace;
});

const owner = (tx: DB): ServiceContext => ({
  ...makeUserCtx(team, { userId: ownerId }),
  db: tx,
});

const NOW = new Date("2026-11-15T12:00:00.000Z");
const at = (iso: string) => new Date(iso);

const snapshot: IncidentTargetSnapshot = {
  targets: {
    critical: { responseMinutes: 60, resolutionMinutes: 240 },
    major: { responseMinutes: 240, resolutionMinutes: 1440 },
  },
  resolutionStop: "mitigated",
};

const empty = { within: 0, missed: 0, open: 0, total: 0 };

describe("getIncidentTargetAttainment", () => {
  test("the last twelve UTC months, oldest first, empty months carry zero incidents", async () => {
    await withTestTransaction(async (tx) => {
      const { months } = await getIncidentTargetAttainment({
        ctx: owner(tx),
        now: NOW,
      });
      expect(months.map((m) => m.month)).toEqual([
        "2025-12-01",
        "2026-01-01",
        "2026-02-01",
        "2026-03-01",
        "2026-04-01",
        "2026-05-01",
        "2026-06-01",
        "2026-07-01",
        "2026-08-01",
        "2026-09-01",
        "2026-10-01",
        "2026-11-01",
      ]);
      expect(months[0]).toEqual({
        month: "2025-12-01",
        incidents: 0,
        response: empty,
        resolution: empty,
      });
    });
  });

  test("counts within, missed and open per target in the month of the clock start", async () => {
    await withTestTransaction(async (tx) => {
      const ws = team.id;
      // met both in time
      await createIncident(
        ws,
        {
          severity: "critical",
          status: "resolved",
          declaredAt: at("2026-10-03T10:00:00Z"),
          startedAt: at("2026-10-03T10:00:00Z"),
          targetSnapshot: snapshot,
          responseMetAt: at("2026-10-03T10:10:00Z"),
          resolutionStoppedAt: at("2026-10-03T12:00:00Z"),
        },
        tx,
      );
      // response met late (recorded miss), resolution still running
      await createIncident(
        ws,
        {
          severity: "major",
          status: "open",
          declaredAt: at("2026-10-31T23:59:00Z"),
          startedAt: at("2026-10-31T23:59:00Z"),
          targetSnapshot: snapshot,
          responseMetAt: at("2026-11-01T05:00:00Z"),
          responseBreachDueAt: at("2026-11-01T03:59:00Z"),
        },
        tx,
      );
      // severity without targets: counted as an incident, no timers
      await createIncident(
        ws,
        {
          severity: "minor",
          status: "resolved",
          declaredAt: at("2026-10-10T08:00:00Z"),
          startedAt: at("2026-10-10T08:00:00Z"),
          targetSnapshot: snapshot,
        },
        tx,
      );
      // canceled and untracked: not counted
      await createIncident(
        ws,
        {
          severity: "critical",
          status: "canceled",
          declaredAt: at("2026-10-05T08:00:00Z"),
          startedAt: at("2026-10-05T08:00:00Z"),
          targetSnapshot: snapshot,
        },
        tx,
      );
      await createIncident(
        ws,
        {
          severity: "critical",
          status: "resolved",
          declaredAt: at("2026-10-06T08:00:00Z"),
          startedAt: at("2026-10-06T08:00:00Z"),
        },
        tx,
      );
      // November: running, and one past due that the cron has not stamped yet
      await createIncident(
        ws,
        {
          severity: "major",
          status: "open",
          declaredAt: at("2026-11-15T11:00:00Z"),
          startedAt: at("2026-11-15T11:00:00Z"),
          targetSnapshot: snapshot,
        },
        tx,
      );
      await createIncident(
        ws,
        {
          severity: "critical",
          status: "open",
          declaredAt: at("2026-11-01T00:00:00Z"),
          startedAt: at("2026-11-01T00:00:00Z"),
          targetSnapshot: snapshot,
          responseMetAt: at("2026-11-01T00:30:00Z"),
        },
        tx,
      );
      // older than twelve months
      await createIncident(
        ws,
        {
          severity: "critical",
          status: "resolved",
          declaredAt: at("2025-11-30T23:00:00Z"),
          startedAt: at("2025-11-30T23:00:00Z"),
          targetSnapshot: snapshot,
          responseMetAt: at("2025-11-30T23:10:00Z"),
        },
        tx,
      );

      const { months } = await getIncidentTargetAttainment({
        ctx: owner(tx),
        now: NOW,
      });
      const byMonth = Object.fromEntries(months.map((m) => [m.month, m]));

      expect(byMonth["2026-10-01"]).toEqual({
        month: "2026-10-01",
        incidents: 3,
        response: { within: 1, missed: 1, open: 0, total: 2 },
        // past due without a stamp yet: still open until the miss is recorded
        resolution: { within: 1, missed: 0, open: 1, total: 2 },
      });
      expect(byMonth["2026-11-01"]).toEqual({
        month: "2026-11-01",
        incidents: 2,
        response: { within: 1, missed: 0, open: 1, total: 2 },
        resolution: { within: 0, missed: 0, open: 2, total: 2 },
      });
      expect(byMonth["2025-12-01"]?.incidents).toBe(0);
    });
  });

  test("other workspaces' incidents are not counted", async () => {
    await withTestTransaction(async (tx) => {
      await createIncident(
        free.id,
        {
          declaredAt: at("2026-10-03T10:00:00Z"),
          startedAt: at("2026-10-03T10:00:00Z"),
          targetSnapshot: snapshot,
        },
        tx,
      );
      const { months } = await getIncidentTargetAttainment({
        ctx: owner(tx),
        now: NOW,
      });
      expect(months.every((m) => m.incidents === 0)).toBe(true);
    });
  });

  test("a read-only key may read; a plan without the limit may not", async () => {
    await withTestTransaction(async (tx) => {
      const key = {
        ...makeApiKeyCtx(team, { keyId: "k_att", scopes: ["incidents:read"] }),
        db: tx,
      };
      await expect(
        getIncidentTargetAttainment({ ctx: key, now: NOW }),
      ).resolves.toHaveProperty("months");

      const noScope = makeApiKeyCtx(team, {
        keyId: "k_att2",
        scopes: ["monitors:read"],
      });
      await expect(
        getIncidentTargetAttainment({ ctx: noScope, now: NOW }),
      ).rejects.toBeInstanceOf(ForbiddenError);

      const freeCtx = { ...makeUserCtx(free, { userId: ownerId }), db: tx };
      await expect(
        getIncidentTargetAttainment({ ctx: freeCtx, now: NOW }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});
