import { eq } from "@openstatus/db";
import { incident, workspace } from "@openstatus/db/src/schema";
import {
  addUserToWorkspace,
  createUser,
} from "@openstatus/db/src/test/factories";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeUserCtx,
  readAuditLog,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB, ServiceContext } from "../../context";
import { upsertIncidentReporting } from "../../incident-reporting";
import type { Workspace } from "../../types";
import {
  acknowledgeIncident,
  declareIncident,
  listIncidentEvents,
  setIncidentStatus,
  updateIncident,
} from "../index";
import {
  dueIncidentSlaBreaches,
  recordIncidentSlaBreaches,
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
const apiKey = (tx: DB) => withDb(makeApiKeyCtx(team, { keyId: "k_tick" }), tx);

const minutesAfter = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60_000);

async function policy(tx: DB, resolutionStop: "mitigated" | "resolved") {
  await upsertIncidentReporting({
    ctx: owner(tx),
    input: {
      targets: {
        critical: { responseMinutes: 60, resolutionMinutes: 240 },
        minor: { responseMinutes: 1440, resolutionMinutes: 4320 },
      },
      resolutionStop,
    },
  });
}

// Declared by an API key, so nothing acknowledges it. The DB stores seconds.
async function declare(
  tx: DB,
  args: {
    minutesAgo: number;
    severity?: "critical" | "minor";
    resolutionStop?: "mitigated" | "resolved";
  },
) {
  await policy(tx, args.resolutionStop ?? "resolved");
  const declared = await declareIncident({
    ctx: apiKey(tx),
    input: { title: "Checkout down", severity: args.severity ?? "critical" },
  });
  const declaredAt = new Date(
    Math.floor((Date.now() - args.minutesAgo * 60_000) / 1000) * 1000,
  );
  await tx
    .update(incident)
    .set({ declaredAt })
    .where(eq(incident.id, declared.id));
  return { id: declared.id, declaredAt };
}

const tick = (tx: DB) =>
  recordIncidentSlaBreaches({ db: tx, workspaceIds: [team.id] });

async function row(tx: DB, id: number) {
  const found = await tx
    .select()
    .from(incident)
    .where(eq(incident.id, id))
    .get();
  if (!found) throw new Error("incident gone");
  return found;
}

async function breaches(tx: DB, id: number) {
  const events = await listIncidentEvents({ ctx: member(tx), input: { id } });
  return events
    .filter(
      (e) =>
        e.type === "sla_response_breached" ||
        e.type === "sla_resolution_breached",
    )
    .map((e) => [e.type, e.createdAt]);
}

describe("the tick records a running timer past its due time", () => {
  test("an unacknowledged response, in a workspace without Slack", async () => {
    await withTestTransaction(async (tx) => {
      const { id, declaredAt } = await declare(tx, { minutesAgo: 61 });
      const recorded = await tick(tx);
      const due = minutesAfter(declaredAt, 60);
      expect(recorded.map((r) => [r.incident.id, r.kind, r.dueAt])).toEqual([
        [id, "response", due],
      ]);
      expect(await breaches(tx, id)).toEqual([["sla_response_breached", due]]);
      const stored = await row(tx, id);
      expect(stored.responseBreachDueAt).toEqual(due);
      expect(stored.responseMetAt).toBeNull();
      expect(stored.resolutionBreachDueAt).toBeNull();
    });
  });

  test("response and resolution, also while mitigated under a resolved stop", async () => {
    await withTestTransaction(async (tx) => {
      const { id, declaredAt } = await declare(tx, { minutesAgo: 241 });
      await setIncidentStatus({
        ctx: apiKey(tx),
        input: { id, status: "mitigated" },
      });
      await tick(tx);
      expect(await breaches(tx, id)).toEqual([
        ["sla_resolution_breached", minutesAfter(declaredAt, 240)],
        ["sla_response_breached", minutesAfter(declaredAt, 60)],
      ]);
      expect((await row(tx, id)).resolutionBreachDueAt).toEqual(
        minutesAfter(declaredAt, 240),
      );
    });
  });

  test("not before the due time, not a met timer, not twice", async () => {
    await withTestTransaction(async (tx) => {
      const early = await declare(tx, { minutesAgo: 59 });
      expect(await tick(tx)).toEqual([]);
      expect(await breaches(tx, early.id)).toEqual([]);

      const acked = await declare(tx, { minutesAgo: 241 });
      await tx
        .update(incident)
        .set({ responseMetAt: minutesAfter(acked.declaredAt, 10) })
        .where(eq(incident.id, acked.id));
      const first = await tick(tx);
      expect(first.map((r) => [r.incident.id, r.kind])).toEqual([
        [acked.id, "resolution"],
      ]);
      expect(await tick(tx)).toEqual([]);
      expect(await breaches(tx, acked.id)).toEqual([
        ["sla_resolution_breached", minutesAfter(acked.declaredAt, 240)],
      ]);
    });
  });

  test("not for untracked or canceled incidents", async () => {
    await withTestTransaction(async (tx) => {
      const canceled = await declare(tx, { minutesAgo: 300 });
      await setIncidentStatus({
        ctx: apiKey(tx),
        input: { id: canceled.id, status: "canceled" },
      });
      const untracked = await declare(tx, { minutesAgo: 300 });
      await tx
        .update(incident)
        .set({ slaSnapshot: null })
        .where(eq(incident.id, untracked.id));
      expect(await tick(tx)).toEqual([]);
    });
  });

  test("after the workspace lost the limit", async () => {
    await withTestTransaction(async (tx) => {
      const { id } = await declare(tx, { minutesAgo: 61 });
      await tx
        .update(workspace)
        .set({ plan: "free" })
        .where(eq(workspace.id, team.id));
      await tick(tx);
      expect((await breaches(tx, id)).length).toBe(1);
    });
  });
});

describe("concurrent ticks", () => {
  test("record each miss once", async () => {
    await withTestTransaction(async (tx) => {
      const { id } = await declare(tx, { minutesAgo: 241 });
      const [a, b] = await Promise.all([tick(tx), tick(tx)]);
      expect([...a, ...b].map((r) => r.kind).sort()).toEqual([
        "resolution",
        "response",
      ]);
      expect((await breaches(tx, id)).length).toBe(2);
    });
  });
});

describe("a change between the tick's read and its write", () => {
  test("an acknowledgement is not overwritten with a miss", async () => {
    await withTestTransaction(async (tx) => {
      const { id, declaredAt } = await declare(tx, { minutesAgo: 61 });
      const [due] = await dueIncidentSlaBreaches({
        db: tx,
        now: new Date(),
        workspaceIds: [team.id],
      });
      if (!due) throw new Error("expected a due breach");
      // on time from the stamp's point of view: met before the write lands
      await tx
        .update(incident)
        .set({ responseMetAt: minutesAfter(declaredAt, 30) })
        .where(eq(incident.id, id));
      expect(await stampIncidentSlaBreach({ db: tx, due })).toBeNull();
      expect(await breaches(tx, id)).toEqual([]);
      expect((await row(tx, id)).responseBreachDueAt).toBeNull();
      expect(await tick(tx)).toEqual([]);
    });
  });

  test("a severity change is not overwritten; the next tick decides again", async () => {
    await withTestTransaction(async (tx) => {
      const { id } = await declare(tx, { minutesAgo: 61 });
      const [due] = await dueIncidentSlaBreaches({
        db: tx,
        now: new Date(),
        workspaceIds: [team.id],
      });
      if (!due) throw new Error("expected a due breach");
      await updateIncident({
        ctx: apiKey(tx),
        input: { id, severity: "minor" },
      });
      expect(await stampIncidentSlaBreach({ db: tx, due })).toBeNull();
      expect(await tick(tx)).toEqual([]);
      expect(await breaches(tx, id)).toEqual([]);
    });
  });

  test("a late acknowledgement records the miss itself, once", async () => {
    await withTestTransaction(async (tx) => {
      const { id, declaredAt } = await declare(tx, { minutesAgo: 61 });
      const [due] = await dueIncidentSlaBreaches({
        db: tx,
        now: new Date(),
        workspaceIds: [team.id],
      });
      if (!due) throw new Error("expected a due breach");
      await acknowledgeIncident({ ctx: member(tx), input: { id } });
      expect(await stampIncidentSlaBreach({ db: tx, due })).toBeNull();
      expect(await breaches(tx, id)).toEqual([
        ["sla_response_breached", minutesAfter(declaredAt, 60)],
      ]);
    });
  });
});

test("a severity upgrade that puts the due time in the past is recorded on the next tick", async () => {
  await withTestTransaction(async (tx) => {
    const { id, declaredAt } = await declare(tx, {
      minutesAgo: 90,
      severity: "minor",
    });
    expect(await tick(tx)).toEqual([]);
    await updateIncident({
      ctx: apiKey(tx),
      input: { id, severity: "critical" },
    });
    const recorded = await tick(tx);
    expect(recorded.map((r) => [r.kind, r.dueAt])).toEqual([
      ["response", minutesAfter(declaredAt, 60)],
    ]);
    expect(await breaches(tx, id)).toEqual([
      ["sla_response_breached", minutesAfter(declaredAt, 60)],
    ]);
  });
});

describe("the stamp's audit row", () => {
  test("a worker with a stale read audits against the row it actually changed", async () => {
    await withTestTransaction(async (tx) => {
      const { id, declaredAt } = await declare(tx, { minutesAgo: 241 });
      const due = await dueIncidentSlaBreaches({
        db: tx,
        now: new Date(),
        workspaceIds: [team.id],
      });
      const response = due.find((d) => d.kind === "response");
      const resolution = due.find((d) => d.kind === "resolution");
      if (!response || !resolution) throw new Error("expected both dues");
      // another worker stamps the response first, from the same read
      await stampIncidentSlaBreach({ db: tx, due: response });
      await stampIncidentSlaBreach({ db: tx, due: resolution });

      const audits = (
        await readAuditLog({
          workspaceId: team.id,
          entityType: "incident",
          entityId: id,
          db: tx,
        })
      ).filter((a) => a.changedFields?.includes("resolutionBreachDueAt"));
      expect(audits.map((a) => a.changedFields)).toEqual([
        ["resolutionBreachDueAt"],
      ]);
      expect(minutesAfter(declaredAt, 240)).toEqual(
        (await row(tx, id)).resolutionBreachDueAt,
      );
    });
  });
});
