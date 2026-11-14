import { incidentSlaPolicy } from "@openstatus/db/src/schema";
import type { IncidentSlaSnapshot } from "@openstatus/db/src/schema/incident_sla_policies/constants";
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
import { ForbiddenError } from "../../errors";
import type { Workspace } from "../../types";
import { getIncidentSlaAttainment } from "../attainment";

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

const snapshot: IncidentSlaSnapshot = {
  targets: {
    critical: { responseMinutes: 60, resolutionMinutes: 240 },
    major: { responseMinutes: 240, resolutionMinutes: 1440 },
    minor: { updateMinutes: 720 },
  },
  resolutionStop: "mitigated",
};

const empty = { within: 0, missed: 0, open: 0, total: 0 };

describe("getIncidentSlaAttainment", () => {
  test("the last twelve UTC months, oldest first, empty months carry zero incidents", async () => {
    await withTestTransaction(async (tx) => {
      const { months } = await getIncidentSlaAttainment({
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
        missedUpdates: 0,
        misses: 0,
        creditPct: null,
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
          slaSnapshot: snapshot,
          responseMetAt: at("2026-10-03T10:10:00Z"),
          resolutionStoppedAt: at("2026-10-03T12:00:00Z"),
        },
        tx,
      );
      // response met late (recorded miss), resolution still running, two missed updates
      const late = await createIncident(
        ws,
        {
          severity: "major",
          status: "open",
          declaredAt: at("2026-10-31T23:59:00Z"),
          startedAt: at("2026-10-31T23:59:00Z"),
          slaSnapshot: snapshot,
          responseMetAt: at("2026-11-01T05:00:00Z"),
          responseBreachDueAt: at("2026-11-01T03:59:00Z"),
        },
        tx,
      );
      for (const due of ["2026-11-01T11:59:00Z", "2026-11-01T23:59:00Z"]) {
        await createIncidentEvent(
          late.id,
          {
            type: "sla_update_missed",
            source: "system",
            createdAt: at(due),
            message: `Update due ${due} missed (every 12h)`,
          },
          tx,
        );
      }
      // severity without targets: counted as an incident, no timers
      await createIncident(
        ws,
        {
          severity: "minor",
          status: "resolved",
          declaredAt: at("2026-10-10T08:00:00Z"),
          startedAt: at("2026-10-10T08:00:00Z"),
          slaSnapshot: snapshot,
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
          slaSnapshot: snapshot,
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
          slaSnapshot: snapshot,
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
          slaSnapshot: snapshot,
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
          slaSnapshot: snapshot,
          responseMetAt: at("2025-11-30T23:10:00Z"),
        },
        tx,
      );

      const { months } = await getIncidentSlaAttainment({
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
        missedUpdates: 2,
        misses: 3,
        creditPct: null,
      });
      expect(byMonth["2026-11-01"]).toEqual({
        month: "2026-11-01",
        incidents: 2,
        response: { within: 1, missed: 0, open: 1, total: 2 },
        resolution: { within: 0, missed: 0, open: 2, total: 2 },
        missedUpdates: 0,
        misses: 0,
        creditPct: null,
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
          slaSnapshot: snapshot,
        },
        tx,
      );
      const { months } = await getIncidentSlaAttainment({
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
        getIncidentSlaAttainment({ ctx: key, now: NOW }),
      ).resolves.toHaveProperty("months");

      const noScope = makeApiKeyCtx(team, {
        keyId: "k_att2",
        scopes: ["monitors:read"],
      });
      await expect(
        getIncidentSlaAttainment({ ctx: noScope, now: NOW }),
      ).rejects.toBeInstanceOf(ForbiddenError);

      const freeCtx = { ...makeUserCtx(free, { userId: ownerId }), db: tx };
      await expect(
        getIncidentSlaAttainment({ ctx: freeCtx, now: NOW }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("support credit per month: every recorded miss times the current credit per miss, explained or not", async () => {
    await withTestTransaction(async (tx) => {
      const ws = team.id;
      await tx.insert(incidentSlaPolicy).values({
        workspaceId: ws,
        targets: snapshot.targets,
        creditPerMissPct: 5,
      });
      // response and resolution both missed, one explained; one missed update
      const missed = await createIncident(
        ws,
        {
          severity: "critical",
          status: "resolved",
          declaredAt: at("2026-09-02T10:00:00Z"),
          startedAt: at("2026-09-02T10:00:00Z"),
          slaSnapshot: snapshot,
          responseMetAt: at("2026-09-02T12:00:00Z"),
          responseBreachDueAt: at("2026-09-02T11:00:00Z"),
          responseMissReason: "Paged the wrong rotation",
          resolutionStoppedAt: at("2026-09-02T16:00:00Z"),
          resolutionBreachDueAt: at("2026-09-02T14:00:00Z"),
        },
        tx,
      );
      await createIncidentEvent(
        missed.id,
        {
          type: "sla_update_missed",
          source: "system",
          createdAt: at("2026-09-02T12:00:00Z"),
          message: "Update due 2026-09-02T12:00:00.000Z missed (every 2h)",
        },
        tx,
      );
      // met in time: earns nothing
      await createIncident(
        ws,
        {
          severity: "critical",
          status: "resolved",
          declaredAt: at("2026-08-02T10:00:00Z"),
          startedAt: at("2026-08-02T10:00:00Z"),
          slaSnapshot: snapshot,
          responseMetAt: at("2026-08-02T10:10:00Z"),
          resolutionStoppedAt: at("2026-08-02T11:00:00Z"),
        },
        tx,
      );
      // canceled with a miss: earns nothing
      await createIncident(
        ws,
        {
          severity: "critical",
          status: "canceled",
          declaredAt: at("2026-09-05T10:00:00Z"),
          startedAt: at("2026-09-05T10:00:00Z"),
          slaSnapshot: snapshot,
          responseBreachDueAt: at("2026-09-05T11:00:00Z"),
        },
        tx,
      );

      const { months } = await getIncidentSlaAttainment({
        ctx: owner(tx),
        now: NOW,
      });
      const byMonth = Object.fromEntries(months.map((m) => [m.month, m]));
      expect(byMonth["2026-09-01"]).toMatchObject({ misses: 3, creditPct: 15 });
      expect(byMonth["2026-08-01"]).toMatchObject({ misses: 0, creditPct: 0 });
      // an empty month earns no credit rather than zero
      expect(byMonth["2026-07-01"]).toMatchObject({
        incidents: 0,
        misses: 0,
        creditPct: null,
      });
    });
  });

  test("credits are summed without float drift", async () => {
    await withTestTransaction(async (tx) => {
      const ws = team.id;
      await tx.insert(incidentSlaPolicy).values({
        workspaceId: ws,
        targets: snapshot.targets,
        creditPerMissPct: 0.1,
      });
      for (const day of ["01", "02", "03"]) {
        await createIncident(
          ws,
          {
            severity: "critical",
            status: "resolved",
            declaredAt: at(`2026-09-${day}T10:00:00Z`),
            startedAt: at(`2026-09-${day}T10:00:00Z`),
            slaSnapshot: snapshot,
            responseMetAt: at(`2026-09-${day}T10:10:00Z`),
            resolutionStoppedAt: at(`2026-09-${day}T16:00:00Z`),
            resolutionBreachDueAt: at(`2026-09-${day}T14:00:00Z`),
          },
          tx,
        );
      }
      const { months } = await getIncidentSlaAttainment({
        ctx: owner(tx),
        now: NOW,
      });
      expect(months.find((m) => m.month === "2026-09-01")?.creditPct).toBe(0.3);
    });
  });
});
