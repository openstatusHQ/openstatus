import { and, eq } from "@openstatus/db";
import { incident, incidentEvent } from "@openstatus/db/src/schema";
import { beforeAll, describe, expect, test, vi } from "vitest";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB, ServiceContext } from "../../context";
import { upsertIncidentSlaPolicy } from "../../incident-sla-policy";
import type { Workspace } from "../../types";
import {
  declareIncident,
  recordIncidentSlaBreaches,
  setIncidentStatus,
} from "../index";

// the next incident read returns this stale copy once, as if the cron stamped after it
const stale = vi.hoisted(() => ({
  next: null as Record<string, unknown> | null,
}));
vi.mock("../internal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../internal")>();
  return {
    ...actual,
    getIncidentInWorkspace: async (
      ...args: Parameters<typeof actual.getIncidentInWorkspace>
    ) => {
      const row = await actual.getIncidentInWorkspace(...args);
      const override = stale.next;
      stale.next = null;
      return override ? { ...row, ...override } : row;
    },
  };
});

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

describe("a stop racing the cron's miss stamp", () => {
  test("lands as a late stop and keeps the stamped miss, once", async () => {
    await withTestTransaction(async (tx) => {
      await upsertIncidentSlaPolicy({
        ctx: withDb(makeUserCtx(team, { userId: ownerId }), tx),
        input: {
          targets: {
            critical: { responseMinutes: 60, resolutionMinutes: 240 },
          },
          resolutionStop: "mitigated",
        },
      });
      const apiKey = withDb(makeApiKeyCtx(team, { keyId: "k_race" }), tx);
      const declared = await declareIncident({
        ctx: apiKey,
        input: { title: "Checkout down", severity: "critical" },
      });
      const declaredAt = new Date(
        Math.floor((Date.now() - 300 * 60_000) / 1000) * 1000,
      );
      await tx
        .update(incident)
        .set({ declaredAt })
        .where(eq(incident.id, declared.id));
      await recordIncidentSlaBreaches({ db: tx, workspaceIds: [team.id] });

      stale.next = { resolutionBreachDueAt: null };
      const mitigated = await setIncidentStatus({
        ctx: apiKey,
        input: { id: declared.id, status: "mitigated" },
      });

      expect(mitigated.resolutionStoppedAt).not.toBeNull();
      expect(mitigated.resolutionBreachDueAt).toEqual(
        new Date(declaredAt.getTime() + 240 * 60_000),
      );
      const breaches = await tx
        .select()
        .from(incidentEvent)
        .where(
          and(
            eq(incidentEvent.incidentId, declared.id),
            eq(incidentEvent.type, "sla_resolution_breached"),
          ),
        )
        .all();
      expect(breaches).toHaveLength(1);
    });
  });
});
