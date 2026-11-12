import { eq } from "@openstatus/db";
import {
  incident,
  statusReport,
  statusReportUpdate,
} from "@openstatus/db/src/schema";
import { beforeAll, describe, expect, test } from "vitest";

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
  addIncidentNote,
  declareIncident,
  getIncident,
  linkIncidentStatusReport,
  setIncidentStatus,
} from "../index";

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
const apiKey = (tx: DB) => withDb(makeApiKeyCtx(team, { keyId: "k_cad" }), tx);

const MINUTE = 60_000;

// Declared 300 minutes ago with a 120 minute update interval; the DB stores seconds.
async function declare(tx: DB, severity: "critical" | "minor" = "critical") {
  await upsertIncidentSlaPolicy({
    ctx: owner(tx),
    input: {
      targets: {
        critical: { responseMinutes: 60, updateMinutes: 120 },
        minor: { resolutionMinutes: 4320 },
      },
      resolutionStop: "mitigated",
    },
  });
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

async function linkReport(tx: DB, id: number, createdAt: Date, date: Date) {
  const report = await tx
    .insert(statusReport)
    .values({ workspaceId: team.id, title: "Outage", status: "investigating" })
    .returning()
    .get();
  await tx.insert(statusReportUpdate).values({
    statusReportId: report.id,
    status: "investigating",
    message: "Looking into it",
    date,
    createdAt,
  });
  await linkIncidentStatusReport({
    ctx: apiKey(tx),
    input: { id, statusReportId: report.id },
  });
}

const read = async (tx: DB, id: number) =>
  getIncident({ ctx: owner(tx), input: { id } });

describe("the update cadence on the incident read", () => {
  test("counts from declare and turns overdue after the interval", async () => {
    await withTestTransaction(async (tx) => {
      const { id, at } = await declare(tx);
      const row = await read(tx, id);
      expect(row?.updateCadence).toMatchObject({
        intervalMinutes: 120,
        startsAt: at(0),
        dueAt: at(120),
        status: "overdue",
      });
    });
  });

  test("a backdated note restarts the interval at the time it carries", async () => {
    await withTestTransaction(async (tx) => {
      const { id, at } = await declare(tx);
      await addIncidentNote({
        ctx: owner(tx),
        input: { id, message: "Rolled back", createdAt: at(250) },
      });
      const row = await read(tx, id);
      expect(row?.updateActivity.notedAt).toEqual(at(250));
      expect(row?.updateCadence).toMatchObject({
        startsAt: at(250),
        dueAt: at(370),
        status: "running",
      });
    });
  });

  test("with a linked report, its newest update's creation time counts and notes do not", async () => {
    await withTestTransaction(async (tx) => {
      const { id, at } = await declare(tx);
      await linkReport(tx, id, at(200), at(290));
      await addIncidentNote({
        ctx: owner(tx),
        input: { id, message: "Internal detail", createdAt: at(280) },
      });
      const row = await read(tx, id);
      expect(row?.updateActivity).toMatchObject({
        reportLinked: true,
        reportUpdatedAt: at(200),
      });
      expect(row?.updateCadence?.startsAt).toEqual(at(200));
    });
  });

  test("reopening after a report updated long ago starts a fresh interval", async () => {
    await withTestTransaction(async (tx) => {
      const { id, at } = await declare(tx);
      await linkReport(tx, id, at(10), at(10));
      await setIncidentStatus({
        ctx: apiKey(tx),
        input: { id, status: "mitigated" },
      });
      expect((await read(tx, id))?.updateCadence).toBeNull();
      await setIncidentStatus({
        ctx: apiKey(tx),
        input: { id, status: "open" },
      });
      const cadence = (await read(tx, id))?.updateCadence;
      expect(cadence?.status).toBe("running");
      expect(cadence?.startsAt.getTime()).toBeGreaterThan(at(290).getTime());
    });
  });

  test("is null without an update target", async () => {
    await withTestTransaction(async (tx) => {
      const { id } = await declare(tx, "minor");
      expect((await read(tx, id))?.updateCadence).toBeNull();
    });
  });
});
