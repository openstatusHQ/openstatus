import { eq } from "@openstatus/db";
import { incident } from "@openstatus/db/src/schema";
import {
  addUserToWorkspace,
  createUser,
} from "@openstatus/db/src/test/factories";
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
  closeIncident,
  declareIncident,
  getIncident,
  listIncidentEvents,
  setIncidentStatus,
  updateIncident,
} from "../index";
import {
  dueIncidentSlaBreaches,
  stampIncidentSlaBreach,
} from "../sla-breaches";

let team: Workspace;
let ownerId: number;
let memberId: number;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  team = fixture.workspace;
  ownerId = fixture.userId;
  memberId = (await createUser()).id;
  await addUserToWorkspace(memberId, team.id, "member");
});

const withDb = (ctx: ServiceContext, tx: DB): ServiceContext => ({
  ...ctx,
  db: tx,
});
const owner = (tx: DB) => withDb(makeUserCtx(team, { userId: ownerId }), tx);
const member = (tx: DB) => withDb(makeUserCtx(team, { userId: memberId }), tx);
const apiKey = (tx: DB) => withDb(makeApiKeyCtx(team, { keyId: "k_rep" }), tx);

const MINUTE = 60_000;
// the DB stores seconds
const minutesAgo = (minutes: number) =>
  new Date(Math.floor((Date.now() - minutes * MINUTE) / 1000) * 1000);
const minutesAfter = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * MINUTE);

async function policy(tx: DB) {
  await upsertIncidentSlaPolicy({
    ctx: owner(tx),
    input: {
      targets: {
        critical: {
          responseMinutes: 60,
          resolutionMinutes: 240,
          updateMinutes: 120,
        },
      },
      resolutionStop: "resolved",
    },
  });
}

async function view(tx: DB, id: number) {
  const row = await getIncident({ ctx: member(tx), input: { id } });
  if (!row) throw new Error("incident missing");
  return row;
}

async function events(tx: DB, id: number) {
  return listIncidentEvents({ ctx: member(tx), input: { id } });
}

describe("reported at, at declare", () => {
  test("starts both timers at the report time", async () => {
    await withTestTransaction(async (tx) => {
      await policy(tx);
      const reportedAt = minutesAgo(40);
      const declared = await declareIncident({
        ctx: apiKey(tx),
        input: { title: "Down", severity: "critical", reportedAt },
      });
      expect(declared.reportedAt).toEqual(reportedAt);
      const { sla } = await view(tx, declared.id);
      expect(sla?.response?.dueAt).toEqual(minutesAfter(reportedAt, 60));
      expect(sla?.response?.status).toBe("running");
      expect(sla?.resolution?.dueAt).toEqual(minutesAfter(reportedAt, 240));
    });
  });

  test("is null and changes nothing when omitted", async () => {
    await withTestTransaction(async (tx) => {
      await policy(tx);
      const declared = await declareIncident({
        ctx: apiKey(tx),
        input: { title: "Down", severity: "critical" },
      });
      expect(declared.reportedAt).toBeNull();
      expect((await view(tx, declared.id)).sla?.response?.dueAt).toEqual(
        minutesAfter(declared.declaredAt, 60),
      );
    });
  });

  test("rejects a time after the declare or more than 30 days before it", async () => {
    await withTestTransaction(async (tx) => {
      for (const reportedAt of [
        new Date(Date.now() + 5 * MINUTE),
        minutesAgo(30 * 24 * 60 + 5),
      ]) {
        await expect(
          declareIncident({
            ctx: apiKey(tx),
            input: { title: "Down", severity: "critical", reportedAt },
          }),
        ).rejects.toThrow(/30 days before/);
      }
    });
  });

  test("a person's declare past the response due records the miss and its event at once", async () => {
    await withTestTransaction(async (tx) => {
      await policy(tx);
      const reportedAt = minutesAgo(90);
      const declared = await declareIncident({
        ctx: member(tx),
        input: { title: "Down", severity: "critical", reportedAt },
      });
      const due = minutesAfter(reportedAt, 60);
      expect(declared.responseMetAt).toEqual(declared.declaredAt);
      expect(declared.responseBreachDueAt).toEqual(due);
      expect((await view(tx, declared.id)).sla?.response?.status).toBe(
        "breached",
      );
      const breach = (await events(tx, declared.id)).filter(
        (e) => e.type === "sla_response_breached",
      );
      expect(breach.map((e) => [e.createdAt, e.source])).toEqual([
        [due, "system"],
      ]);
    });
  });

  test("the update interval still counts from declare", async () => {
    await withTestTransaction(async (tx) => {
      await policy(tx);
      const declared = await declareIncident({
        ctx: apiKey(tx),
        input: {
          title: "Down",
          severity: "critical",
          reportedAt: minutesAgo(100),
        },
      });
      expect((await view(tx, declared.id)).updateCadence?.dueAt).toEqual(
        minutesAfter(declared.declaredAt, 120),
      );
    });
  });
});

describe("editing reported at", () => {
  test("moves a running timer and writes a timeline event", async () => {
    await withTestTransaction(async (tx) => {
      await policy(tx);
      const declared = await declareIncident({
        ctx: apiKey(tx),
        input: { title: "Down", severity: "critical" },
      });
      const reportedAt = new Date(declared.declaredAt.getTime() - 20 * MINUTE);
      const updated = await updateIncident({
        ctx: apiKey(tx),
        input: { id: declared.id, reportedAt },
      });
      expect(updated.reportedAt).toEqual(reportedAt);
      expect(updated.acknowledgedAt).toBeNull();
      expect((await view(tx, declared.id)).sla?.response?.dueAt).toEqual(
        minutesAfter(reportedAt, 60),
      );
      const changed = (await events(tx, declared.id)).filter(
        (e) => e.type === "reported_at_changed",
      );
      expect(changed.map((e) => e.message)).toEqual([
        `Reported at changed to ${reportedAt.toISOString()}`,
      ]);
    });
  });

  test("clearing it returns the clock to the declare", async () => {
    await withTestTransaction(async (tx) => {
      await policy(tx);
      const declared = await declareIncident({
        ctx: apiKey(tx),
        input: {
          title: "Down",
          severity: "critical",
          reportedAt: minutesAgo(10),
        },
      });
      await updateIncident({
        ctx: apiKey(tx),
        input: { id: declared.id, reportedAt: null },
      });
      const row = await view(tx, declared.id);
      expect(row.reportedAt).toBeNull();
      expect(row.sla?.response?.dueAt).toEqual(
        minutesAfter(declared.declaredAt, 60),
      );
      expect(
        (await events(tx, declared.id))
          .filter((e) => e.type === "reported_at_changed")
          .map((e) => e.message),
      ).toEqual(["Reported at cleared"]);
    });
  });

  test("does not re-judge a met response", async () => {
    await withTestTransaction(async (tx) => {
      await policy(tx);
      const declared = await declareIncident({
        ctx: member(tx),
        input: { title: "Down", severity: "critical" },
      });
      await updateIncident({
        ctx: member(tx),
        input: { id: declared.id, reportedAt: minutesAgo(120) },
      });
      const row = await view(tx, declared.id);
      expect(row.responseBreachDueAt).toBeNull();
      expect(row.sla?.response?.status).toBe("met");
      expect(
        (await events(tx, declared.id)).some(
          (e) => e.type === "sla_response_breached",
        ),
      ).toBe(false);
    });
  });

  test("does not move a recorded miss", async () => {
    await withTestTransaction(async (tx) => {
      await policy(tx);
      const reportedAt = minutesAgo(90);
      const declared = await declareIncident({
        ctx: member(tx),
        input: { title: "Down", severity: "critical", reportedAt },
      });
      await updateIncident({
        ctx: member(tx),
        input: { id: declared.id, reportedAt: null },
      });
      const response = (await view(tx, declared.id)).sla?.response;
      expect(response?.status).toBe("breached");
      expect(response?.dueAt).toEqual(minutesAfter(reportedAt, 60));
    });
  });

  test("rejects a time outside the declare's window", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declareIncident({
        ctx: apiKey(tx),
        input: { title: "Down", severity: "critical" },
      });
      for (const reportedAt of [
        new Date(declared.declaredAt.getTime() + 1000),
        new Date(declared.declaredAt.getTime() - 30 * 24 * 60 * MINUTE - 1000),
      ]) {
        await expect(
          updateIncident({
            ctx: apiKey(tx),
            input: { id: declared.id, reportedAt },
          }),
        ).rejects.toThrow(/30 days before/);
      }
    });
  });

  test("is refused once the incident is closed", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declareIncident({
        ctx: member(tx),
        input: { title: "Down", severity: "critical" },
      });
      await setIncidentStatus({
        ctx: member(tx),
        input: { id: declared.id, status: "resolved" },
      });
      await closeIncident({
        ctx: owner(tx),
        input: { id: declared.id, skipPostmortem: true },
      });
      await expect(
        updateIncident({
          ctx: member(tx),
          input: {
            id: declared.id,
            reportedAt: new Date(declared.declaredAt.getTime() - MINUTE),
          },
        }),
      ).rejects.toThrow(/closed/);
    });
  });

  test("between the tick's read and write, the miss is not stamped", async () => {
    await withTestTransaction(async (tx) => {
      await policy(tx);
      const declared = await declareIncident({
        ctx: apiKey(tx),
        input: {
          title: "Down",
          severity: "critical",
          reportedAt: minutesAgo(61),
        },
      });
      const [due] = await dueIncidentSlaBreaches({
        db: tx,
        now: new Date(),
        workspaceIds: [team.id],
      });
      if (due?.incident.id !== declared.id) throw new Error("expected a due");
      await updateIncident({
        ctx: apiKey(tx),
        input: { id: declared.id, reportedAt: null },
      });
      expect(await stampIncidentSlaBreach({ db: tx, due })).toBeNull();
      const row = await tx
        .select()
        .from(incident)
        .where(eq(incident.id, declared.id))
        .get();
      expect(row?.responseBreachDueAt).toBeNull();
    });
  });
});
