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
import {
  getIncidentReporting,
  upsertIncidentReporting,
} from "../../incident-reporting";
import { addStatusReportUpdate } from "../../status-report";
import type { Workspace } from "../../types";
import {
  acknowledgeIncident,
  addIncidentNote,
  declareIncident,
  getIncident,
  linkIncidentStatusReport,
  listIncidentEvents,
  setIncidentStatus,
  unlinkIncidentStatusReport,
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
const apiKey = (tx: DB) => withDb(makeApiKeyCtx(team, { keyId: "k_rsr" }), tx);

const MINUTE = 60_000;
const targets = { critical: { responseMinutes: 60, resolutionMinutes: 240 } };

function savePolicy(
  tx: DB,
  responseMet: "acknowledged" | "status_report" = "status_report",
) {
  return upsertIncidentReporting({
    ctx: owner(tx),
    input: { targets, resolutionStop: "resolved", responseMet },
  });
}

// The DB stores seconds.
const seconds = (ms: number) => new Date(Math.floor(ms / 1000) * 1000);

async function declaredMinutesAgo(tx: DB, id: number, minutes: number) {
  const declaredAt = seconds(Date.now() - minutes * MINUTE);
  await tx.update(incident).set({ declaredAt }).where(eq(incident.id, id));
  return declaredAt;
}

async function createReport(tx: DB, updateCreatedAt?: Date) {
  const report = await tx
    .insert(statusReport)
    .values({ workspaceId: team.id, title: "Outage", status: "investigating" })
    .returning()
    .get();
  if (updateCreatedAt) {
    await tx.insert(statusReportUpdate).values({
      statusReportId: report.id,
      status: "investigating",
      message: "Looking into it",
      date: updateCreatedAt,
      createdAt: updateCreatedAt,
    });
  }
  return report.id;
}

const read = (tx: DB, id: number) =>
  getIncident({ ctx: owner(tx), input: { id } });

function postUpdate(tx: DB, statusReportId: number, date?: Date) {
  return addStatusReportUpdate({
    ctx: owner(tx),
    input: {
      statusReportId,
      status: "identified",
      message: "Fix rolling out",
      date,
    },
  });
}

describe("the policy choice", () => {
  test("defaults to acknowledgement and is saved with the policy", async () => {
    await withTestTransaction(async (tx) => {
      const created = await upsertIncidentReporting({
        ctx: owner(tx),
        input: { targets },
      });
      expect(created.responseMet).toBe("acknowledged");
      await savePolicy(tx);
      const saved = await getIncidentReporting({ ctx: owner(tx) });
      expect(saved?.responseMet).toBe("status_report");
    });
  });

  test("is fixed on the incident at declare; a later policy edit does not change it", async () => {
    await withTestTransaction(async (tx) => {
      await savePolicy(tx);
      const declared = await declareIncident({
        ctx: apiKey(tx),
        input: { title: "Checkout down", severity: "critical" },
      });
      await savePolicy(tx, "acknowledged");
      const row = await read(tx, declared.id);
      expect(row.slaSnapshot?.responseMet).toBe("status_report");
      expect(row.sla?.responseMet).toBe("status_report");
    });
  });

  test("a snapshot taken before the choice existed reads as acknowledgement", async () => {
    await withTestTransaction(async (tx) => {
      await savePolicy(tx);
      const declared = await declareIncident({
        ctx: apiKey(tx),
        input: { title: "Checkout down", severity: "critical" },
      });
      await tx
        .update(incident)
        .set({ slaSnapshot: { targets, resolutionStop: "resolved" } })
        .where(eq(incident.id, declared.id));
      await acknowledgeIncident({
        ctx: apiKey(tx),
        input: { id: declared.id },
      });
      const row = await read(tx, declared.id);
      expect(row.sla?.responseMet).toBe("acknowledged");
      expect(row.responseMetAt).not.toBeNull();
    });
  });
});

describe("with status_report, acknowledgement does not meet the response", () => {
  test("a person's declare acknowledges but leaves the response open", async () => {
    await withTestTransaction(async (tx) => {
      await savePolicy(tx);
      const declared = await declareIncident({
        ctx: owner(tx),
        input: { title: "Checkout down", severity: "critical" },
      });
      expect(declared.acknowledgedAt).not.toBeNull();
      expect(declared.responseMetAt).toBeNull();
    });
  });

  test("the acknowledge action and a person's note leave it open", async () => {
    await withTestTransaction(async (tx) => {
      await savePolicy(tx);
      const declared = await declareIncident({
        ctx: apiKey(tx),
        input: { title: "Checkout down", severity: "critical" },
      });
      const acked = await acknowledgeIncident({
        ctx: apiKey(tx),
        input: { id: declared.id },
      });
      expect(acked.acknowledgedAt).not.toBeNull();
      expect(acked.responseMetAt).toBeNull();
      await addIncidentNote({
        ctx: owner(tx),
        input: { id: declared.id, message: "Looking" },
      });
      expect((await read(tx, declared.id)).responseMetAt).toBeNull();
    });
  });
});

describe("with status_report, a report update meets the response", () => {
  test("posting an update on the linked report, at the time of that write", async () => {
    await withTestTransaction(async (tx) => {
      await savePolicy(tx);
      const declared = await declareIncident({
        ctx: apiKey(tx),
        input: { title: "Checkout down", severity: "critical" },
      });
      await declaredMinutesAgo(tx, declared.id, 10);
      const reportId = await createReport(tx);
      const linked = await linkIncidentStatusReport({
        ctx: apiKey(tx),
        input: { id: declared.id, statusReportId: reportId },
      });
      expect(linked.responseMetAt).toBeNull();
      await tx
        .update(incident)
        .set({ updatedAt: seconds(Date.now() - 60 * MINUTE) })
        .where(eq(incident.id, declared.id));

      const before = seconds(Date.now());
      // a backdated `date` does not move the met time
      await postUpdate(tx, reportId, new Date(Date.now() - 60 * MINUTE));
      const row = await read(tx, declared.id);
      expect(row.responseMetAt?.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(row.updatedAt?.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(row.responseBreachDueAt).toBeNull();
      expect(row.sla?.response?.status).toBe("met");
    });
  });

  test("linking a report that already has an update since the clock start", async () => {
    await withTestTransaction(async (tx) => {
      await savePolicy(tx);
      const declared = await declareIncident({
        ctx: apiKey(tx),
        input: { title: "Checkout down", severity: "critical" },
      });
      const declaredAt = await declaredMinutesAgo(tx, declared.id, 10);
      const reportId = await createReport(
        tx,
        new Date(declaredAt.getTime() + 5 * MINUTE),
      );
      const before = seconds(Date.now());
      const linked = await linkIncidentStatusReport({
        ctx: apiKey(tx),
        input: { id: declared.id, statusReportId: reportId },
      });
      expect(linked.responseMetAt?.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
    });
  });

  test("an update created before the clock start does not count", async () => {
    await withTestTransaction(async (tx) => {
      await savePolicy(tx);
      const declared = await declareIncident({
        ctx: apiKey(tx),
        input: { title: "Checkout down", severity: "critical" },
      });
      const declaredAt = await declaredMinutesAgo(tx, declared.id, 10);
      const reportId = await createReport(
        tx,
        new Date(declaredAt.getTime() - MINUTE),
      );
      const linked = await linkIncidentStatusReport({
        ctx: apiKey(tx),
        input: { id: declared.id, statusReportId: reportId },
      });
      expect(linked.responseMetAt).toBeNull();
    });
  });

  test("declaring with a report that has an update since the clock start", async () => {
    await withTestTransaction(async (tx) => {
      await savePolicy(tx);
      // created after the declare's second, so it is at or after the clock start
      const reportId = await createReport(tx, seconds(Date.now() + MINUTE));
      const before = seconds(Date.now());
      const declared = await declareIncident({
        ctx: apiKey(tx),
        input: {
          title: "Checkout down",
          severity: "critical",
          statusReportId: reportId,
        },
      });
      const row = await read(tx, declared.id);
      expect(row.responseMetAt?.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
    });
  });

  test("declaring with a report whose updates are older leaves it open", async () => {
    await withTestTransaction(async (tx) => {
      await savePolicy(tx);
      const reportId = await createReport(tx, seconds(Date.now() - MINUTE));
      const declared = await declareIncident({
        ctx: apiKey(tx),
        input: {
          title: "Checkout down",
          severity: "critical",
          statusReportId: reportId,
        },
      });
      expect((await read(tx, declared.id)).responseMetAt).toBeNull();
    });
  });

  test("unlinking the report afterwards does not reopen it", async () => {
    await withTestTransaction(async (tx) => {
      await savePolicy(tx);
      const declared = await declareIncident({
        ctx: apiKey(tx),
        input: { title: "Checkout down", severity: "critical" },
      });
      const reportId = await createReport(tx);
      await linkIncidentStatusReport({
        ctx: apiKey(tx),
        input: { id: declared.id, statusReportId: reportId },
      });
      await postUpdate(tx, reportId);
      const met = (await read(tx, declared.id)).responseMetAt;
      expect(met).not.toBeNull();
      const unlinked = await unlinkIncidentStatusReport({
        ctx: apiKey(tx),
        input: { id: declared.id },
      });
      expect(unlinked.responseMetAt).toEqual(met);
    });
  });

  test("an update on a report linked to nobody, or in acknowledged mode, changes nothing", async () => {
    await withTestTransaction(async (tx) => {
      await savePolicy(tx, "acknowledged");
      const declared = await declareIncident({
        ctx: apiKey(tx),
        input: { title: "Checkout down", severity: "critical" },
      });
      const reportId = await createReport(tx);
      await linkIncidentStatusReport({
        ctx: apiKey(tx),
        input: { id: declared.id, statusReportId: reportId },
      });
      await postUpdate(tx, reportId);
      await postUpdate(tx, await createReport(tx));
      expect((await read(tx, declared.id)).responseMetAt).toBeNull();
    });
  });

  test("a late update records the miss like a late acknowledgement", async () => {
    await withTestTransaction(async (tx) => {
      await savePolicy(tx);
      const declared = await declareIncident({
        ctx: apiKey(tx),
        input: { title: "Checkout down", severity: "critical" },
      });
      const declaredAt = await declaredMinutesAgo(tx, declared.id, 90);
      const reportId = await createReport(tx);
      await linkIncidentStatusReport({
        ctx: apiKey(tx),
        input: { id: declared.id, statusReportId: reportId },
      });
      await postUpdate(tx, reportId);
      const due = new Date(declaredAt.getTime() + 60 * MINUTE);
      const row = await read(tx, declared.id);
      expect(row.responseMetAt).not.toBeNull();
      expect(row.responseBreachDueAt).toEqual(due);
      const events = await listIncidentEvents({
        ctx: owner(tx),
        input: { id: declared.id },
      });
      const breach = events.filter((e) => e.type === "sla_response_breached");
      expect(breach.map((e) => e.createdAt)).toEqual([due]);
      expect(breach[0]?.source).toBe("system");
    });
  });
});

describe("resolving meets the response in both modes", () => {
  test.each(["acknowledged", "status_report"] as const)("%s", async (mode) => {
    await withTestTransaction(async (tx) => {
      await savePolicy(tx, mode);
      const declared = await declareIncident({
        ctx: apiKey(tx),
        input: { title: "Checkout down", severity: "critical" },
      });
      await acknowledgeIncident({
        ctx: apiKey(tx),
        input: { id: declared.id },
      });
      const resolved = await setIncidentStatus({
        ctx: apiKey(tx),
        input: { id: declared.id, status: "resolved" },
      });
      expect(resolved.responseMetAt).not.toBeNull();
    });
  });
});
