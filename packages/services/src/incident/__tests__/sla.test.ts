import { eq } from "@openstatus/db";
import { incident, incidentSlaPolicy } from "@openstatus/db/src/schema";
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
import {
  deleteIncidentSlaPolicy,
  upsertIncidentSlaPolicy,
} from "../../incident-sla-policy";
import type { Workspace } from "../../types";
import {
  acknowledgeIncident,
  addIncidentNote,
  declareIncident,
  getIncident,
  listIncidents,
  setIncidentStatus,
  updateIncident,
} from "../index";

let team: Workspace;
let free: Workspace;
let ownerId: number;
let memberId: number;
let freeOwnerId: number;

beforeAll(async () => {
  const teamFixture = await createWorkspaceFixture("team");
  team = teamFixture.workspace;
  ownerId = teamFixture.userId;
  memberId = (await createUser()).id;
  await addUserToWorkspace(memberId, team.id, "member");
  const freeFixture = await createWorkspaceFixture("free");
  free = freeFixture.workspace;
  freeOwnerId = freeFixture.userId;
});

const withDb = (ctx: ServiceContext, tx: DB): ServiceContext => ({
  ...ctx,
  db: tx,
});
const owner = (tx: DB) => withDb(makeUserCtx(team, { userId: ownerId }), tx);
const member = (tx: DB) => withDb(makeUserCtx(team, { userId: memberId }), tx);
const apiKey = (tx: DB) => withDb(makeApiKeyCtx(team, { keyId: "k_sla" }), tx);

const targets = {
  critical: { responseMinutes: 60, resolutionMinutes: 240 },
  minor: { resolutionMinutes: 4320 },
};

function savePolicy(tx: DB) {
  return upsertIncidentSlaPolicy({
    ctx: owner(tx),
    input: { targets, resolutionStop: "resolved" },
  });
}

function declareByKey(tx: DB, severity: "critical" | "minor" = "critical") {
  return declareIncident({
    ctx: apiKey(tx),
    input: { title: "Checkout down", severity },
  });
}

// Moves the declare back, so the next write lands that many minutes after it.
// The DB stores seconds.
async function declaredMinutesAgo(tx: DB, id: number, minutes: number) {
  const declaredAt = new Date(
    Math.floor((Date.now() - minutes * 60_000) / 1000) * 1000,
  );
  await tx.update(incident).set({ declaredAt }).where(eq(incident.id, id));
  return declaredAt;
}

async function view(tx: DB, id: number) {
  const row = await getIncident({ ctx: member(tx), input: { id } });
  if (!row) throw new Error("incident missing");
  return row;
}

describe("the snapshot at declare", () => {
  test("copies the policy with the limit on", async () => {
    await withTestTransaction(async (tx) => {
      await savePolicy(tx);
      const declared = await declareByKey(tx);
      expect(declared.slaSnapshot).toEqual({
        targets,
        resolutionStop: "resolved",
        responseMet: "acknowledged",
      });
    });
  });

  test("is absent without a policy", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declareByKey(tx);
      expect(declared.slaSnapshot).toBeNull();
      expect((await view(tx, declared.id)).sla).toBeNull();
    });
  });

  test("is absent with the limit off, even with a policy row", async () => {
    await withTestTransaction(async (tx) => {
      await tx.insert(incidentSlaPolicy).values({
        workspaceId: free.id,
        targets,
        resolutionStop: "mitigated",
      });
      const declared = await declareIncident({
        ctx: withDb(makeUserCtx(free, { userId: freeOwnerId }), tx),
        input: { title: "Down", severity: "critical" },
      });
      expect(declared.slaSnapshot).toBeNull();
      expect(declared.responseMetAt).toBeNull();
    });
  });

  test("survives a policy change and delete", async () => {
    await withTestTransaction(async (tx) => {
      await savePolicy(tx);
      const declared = await declareByKey(tx);
      await upsertIncidentSlaPolicy({
        ctx: owner(tx),
        input: { targets: { critical: { responseMinutes: 5 } } },
      });
      await deleteIncidentSlaPolicy({ ctx: owner(tx) });
      const row = await view(tx, declared.id);
      expect(row.slaSnapshot).toEqual({
        targets,
        resolutionStop: "resolved",
        responseMet: "acknowledged",
      });
      expect(row.sla?.response?.targetMinutes).toBe(60);
    });
  });
});

describe("the response time", () => {
  test("is met at declare when a person declares", async () => {
    await withTestTransaction(async (tx) => {
      await savePolicy(tx);
      const declared = await declareIncident({
        ctx: member(tx),
        input: { title: "Down", severity: "critical" },
      });
      expect(declared.responseMetAt).toEqual(declared.declaredAt);
      expect(declared.responseMetAt).toEqual(declared.acknowledgedAt);
      expect((await view(tx, declared.id)).sla?.response?.status).toBe("met");
    });
  });

  test("runs on a key declare and reaches list and get", async () => {
    await withTestTransaction(async (tx) => {
      await savePolicy(tx);
      const declared = await declareByKey(tx);
      expect(declared.responseMetAt).toBeNull();
      expect((await view(tx, declared.id)).sla?.response?.status).toBe(
        "running",
      );
      const { items } = await listIncidents({ ctx: member(tx) });
      const listed = items.find((i) => i.id === declared.id);
      expect(listed?.sla?.response?.dueAt).toEqual(
        new Date(declared.declaredAt.getTime() + 60 * 60_000),
      );
    });
  });

  test("is met by the acknowledge action, returned by it", async () => {
    await withTestTransaction(async (tx) => {
      await savePolicy(tx);
      const declared = await declareByKey(tx);
      const acked = await acknowledgeIncident({
        ctx: member(tx),
        input: { id: declared.id },
      });
      expect(acked.responseMetAt).toEqual(acked.acknowledgedAt);
      expect(acked.responseBreachDueAt).toBeNull();
    });
  });

  test("is met by a person's note, an implicit acknowledgement", async () => {
    await withTestTransaction(async (tx) => {
      await savePolicy(tx);
      const declared = await declareByKey(tx);
      await addIncidentNote({
        ctx: member(tx),
        input: { id: declared.id, message: "Looking" },
      });
      const row = await view(tx, declared.id);
      expect(row.responseMetAt).toEqual(row.acknowledgedAt);
      expect(row.sla?.response?.status).toBe("met");
    });
  });

  test("is met by a key resolving, and the returned row shows it", async () => {
    await withTestTransaction(async (tx) => {
      await savePolicy(tx);
      const declared = await declareByKey(tx);
      const resolved = await setIncidentStatus({
        ctx: apiKey(tx),
        input: { id: declared.id, status: "resolved" },
      });
      expect(resolved.responseMetAt).not.toBeNull();
      expect(resolved.responseMetAt).toEqual(resolved.acknowledgedAt);
    });
  });

  test("is stored even when the severity has no response target", async () => {
    await withTestTransaction(async (tx) => {
      await savePolicy(tx);
      const declared = await declareByKey(tx, "minor");
      const acked = await acknowledgeIncident({
        ctx: member(tx),
        input: { id: declared.id },
      });
      expect(acked.responseMetAt).not.toBeNull();
      expect((await view(tx, declared.id)).sla?.response).toBeNull();
    });
  });

  test("is not stored on an untracked incident", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declareByKey(tx);
      const acked = await acknowledgeIncident({
        ctx: member(tx),
        input: { id: declared.id },
      });
      expect(acked.acknowledgedAt).not.toBeNull();
      expect(acked.responseMetAt).toBeNull();
    });
  });
});

describe("a late response", () => {
  test("acknowledged late records the missed due time in the same write", async () => {
    await withTestTransaction(async (tx) => {
      await savePolicy(tx);
      const declared = await declareByKey(tx);
      const declaredAt = await declaredMinutesAgo(tx, declared.id, 90);
      const acked = await acknowledgeIncident({
        ctx: member(tx),
        input: { id: declared.id },
      });
      expect(acked.responseBreachDueAt).toEqual(
        new Date(declaredAt.getTime() + 60 * 60_000),
      );
      expect((await view(tx, declared.id)).sla?.response?.status).toBe(
        "breached",
      );
    });
  });

  test("met by a late note is a miss too", async () => {
    await withTestTransaction(async (tx) => {
      await savePolicy(tx);
      const declared = await declareByKey(tx);
      await declaredMinutesAgo(tx, declared.id, 90);
      await addIncidentNote({
        ctx: member(tx),
        input: { id: declared.id, message: "Sorry, late" },
      });
      const row = await view(tx, declared.id);
      expect(row.responseBreachDueAt).not.toBeNull();
      expect(row.sla?.response?.status).toBe("breached");
    });
  });

  test("stays missed after a downgrade to a severity without a target", async () => {
    await withTestTransaction(async (tx) => {
      await savePolicy(tx);
      const declared = await declareByKey(tx);
      await declaredMinutesAgo(tx, declared.id, 90);
      await acknowledgeIncident({
        ctx: member(tx),
        input: { id: declared.id },
      });
      await updateIncident({
        ctx: member(tx),
        input: { id: declared.id, severity: "minor" },
      });
      expect((await view(tx, declared.id)).sla?.response?.status).toBe(
        "breached",
      );
    });
  });

  test("a running timer moves with the severity and stamps nothing", async () => {
    await withTestTransaction(async (tx) => {
      await savePolicy(tx);
      const declared = await declareByKey(tx, "minor");
      await declaredMinutesAgo(tx, declared.id, 30);
      // a key's edit does not acknowledge
      const upgraded = await updateIncident({
        ctx: apiKey(tx),
        input: { id: declared.id, severity: "critical" },
      });
      expect(upgraded.responseBreachDueAt).toBeNull();
      expect((await view(tx, declared.id)).sla?.response?.status).toBe(
        "running",
      );
    });
  });
});
