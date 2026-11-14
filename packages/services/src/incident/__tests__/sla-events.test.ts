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
import { upsertIncidentReporting } from "../../incident-reporting";
import type { Workspace } from "../../types";
import {
  acknowledgeIncident,
  addIncidentNote,
  declareIncident,
  getIncident,
  listIncidentEvents,
  setIncidentStatus,
  updateIncident,
} from "../index";
import { appendIncidentSlaBreach } from "../internal";

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
const apiKey = (tx: DB) => withDb(makeApiKeyCtx(team, { keyId: "k_ev" }), tx);

async function declare(
  tx: DB,
  args: {
    resolutionStop?: "mitigated" | "resolved";
    severity?: "critical" | "minor";
  } = {},
) {
  await upsertIncidentReporting({
    ctx: owner(tx),
    input: {
      targets: {
        critical: { responseMinutes: 60, resolutionMinutes: 240 },
        minor: { resolutionMinutes: 4320 },
      },
      resolutionStop: args.resolutionStop ?? "resolved",
    },
  });
  return declareIncident({
    ctx: apiKey(tx),
    input: { title: "Checkout down", severity: args.severity ?? "critical" },
  });
}

// Moves the declare back; the DB stores seconds.
async function declaredMinutesAgo(tx: DB, id: number, minutes: number) {
  const declaredAt = new Date(
    Math.floor((Date.now() - minutes * 60_000) / 1000) * 1000,
  );
  await tx.update(incident).set({ declaredAt }).where(eq(incident.id, id));
  return declaredAt;
}

const minutesAfter = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60_000);

async function events(tx: DB, id: number) {
  return listIncidentEvents({ ctx: member(tx), input: { id } });
}

async function breaches(tx: DB, id: number) {
  return (await events(tx, id)).filter(
    (e) =>
      e.type === "sla_response_breached" ||
      e.type === "sla_resolution_breached",
  );
}

describe("a late response writes one system event", () => {
  test("on a late explicit acknowledge, at the due time, by the system", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declare(tx);
      const declaredAt = await declaredMinutesAgo(tx, declared.id, 90);
      await acknowledgeIncident({
        ctx: member(tx),
        input: { id: declared.id },
      });
      const due = minutesAfter(declaredAt, 60);
      const timeline = await events(tx, declared.id);
      // newest first: the miss sits before the late action
      const types = timeline.map((e) => e.type);
      expect(types.indexOf("sla_response_breached")).toBeGreaterThan(
        types.indexOf("acknowledged"),
      );
      const breach = timeline.find((e) => e.type === "sla_response_breached");
      expect(breach?.createdAt).toEqual(due);
      expect(breach?.createdBy).toBeNull();
      expect(breach?.source).toBe("system");
      expect(breach?.sourceRef).toBeNull();
      expect(breach?.message).toBe(
        `Response target of 1h breached, due ${due.toISOString()}`,
      );
    });
  });

  test("on a late implicit acknowledge", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declare(tx);
      await declaredMinutesAgo(tx, declared.id, 90);
      await addIncidentNote({
        ctx: member(tx),
        input: { id: declared.id, message: "Looking" },
      });
      const found = await breaches(tx, declared.id);
      expect(found.map((e) => e.type)).toEqual(["sla_response_breached"]);
      expect(found[0]?.createdBy).toBeNull();
    });
  });

  test("on a late resolve of an unacknowledged incident, with the resolution miss", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declare(tx);
      const declaredAt = await declaredMinutesAgo(tx, declared.id, 300);
      await setIncidentStatus({
        ctx: apiKey(tx),
        input: { id: declared.id, status: "resolved" },
      });
      const found = await breaches(tx, declared.id);
      expect(found.map((e) => [e.type, e.createdAt])).toEqual([
        ["sla_resolution_breached", minutesAfter(declaredAt, 240)],
        ["sla_response_breached", minutesAfter(declaredAt, 60)],
      ]);
      expect(found[0]?.message).toBe(
        `Resolution target of 4h breached, due ${minutesAfter(declaredAt, 240).toISOString()}`,
      );
    });
  });

  test("not when the response was on time", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declare(tx);
      await declaredMinutesAgo(tx, declared.id, 30);
      await acknowledgeIncident({
        ctx: member(tx),
        input: { id: declared.id },
      });
      expect(await breaches(tx, declared.id)).toEqual([]);
    });
  });
});

describe("a late stop writes one resolution event", () => {
  test("once, even across a reopen and a second late stop", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declare(tx, { resolutionStop: "mitigated" });
      await declaredMinutesAgo(tx, declared.id, 300);
      await acknowledgeIncident({
        ctx: owner(tx),
        input: { id: declared.id },
      });
      for (const status of ["mitigated", "open", "mitigated"] as const) {
        await setIncidentStatus({
          ctx: member(tx),
          input: { id: declared.id, status },
        });
      }
      const found = await breaches(tx, declared.id);
      expect(found.map((e) => e.type)).toEqual([
        "sla_resolution_breached",
        "sla_response_breached",
      ]);
    });
  });
});

describe("system events", () => {
  test("are unique per incident, type and due time", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declare(tx);
      const dueAt = minutesAfter(declared.declaredAt, 60);
      const write = () =>
        appendIncidentSlaBreach(tx, owner(tx), {
          incidentId: declared.id,
          kind: "response",
          targetMinutes: 60,
          dueAt,
        });
      expect(await write()).not.toBeNull();
      expect(await write()).toBeNull();
      expect(await breaches(tx, declared.id)).toHaveLength(1);
    });
  });

  test("do not acknowledge, even inside a person's write", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declare(tx);
      await appendIncidentSlaBreach(tx, member(tx), {
        incidentId: declared.id,
        kind: "response",
        targetMinutes: 60,
        dueAt: minutesAfter(declared.declaredAt, 60),
      });
      const row = await getIncident({
        ctx: member(tx),
        input: { id: declared.id },
      });
      expect(row?.acknowledgedAt).toBeNull();
    });
  });
});

describe("severity changes", () => {
  test("a downgrade keeps the recorded miss and its event", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declare(tx);
      await declaredMinutesAgo(tx, declared.id, 90);
      await acknowledgeIncident({
        ctx: member(tx),
        input: { id: declared.id },
      });
      await updateIncident({
        ctx: member(tx),
        input: { id: declared.id, severity: "minor" },
      });
      expect(await breaches(tx, declared.id)).toHaveLength(1);
      const row = await getIncident({
        ctx: member(tx),
        input: { id: declared.id },
      });
      expect(row?.sla?.response?.status).toBe("breached");
    });
  });

  test("an upgrade after the response was met does not turn it into a miss", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declare(tx, { severity: "minor" });
      await declaredMinutesAgo(tx, declared.id, 90);
      await acknowledgeIncident({
        ctx: member(tx),
        input: { id: declared.id },
      });
      await updateIncident({
        ctx: member(tx),
        input: { id: declared.id, severity: "critical" },
      });
      expect(await breaches(tx, declared.id)).toEqual([]);
      const row = await getIncident({
        ctx: member(tx),
        input: { id: declared.id },
      });
      expect(row?.sla?.response?.status).toBe("met");
      expect(row?.responseBreachDueAt).toBeNull();
    });
  });
});
