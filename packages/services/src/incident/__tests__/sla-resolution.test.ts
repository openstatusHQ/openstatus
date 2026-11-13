import { eq } from "@openstatus/db";
import { incident } from "@openstatus/db/src/schema";
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
import { declareIncident, getIncident, setIncidentStatus } from "../index";

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
const apiKey = (tx: DB) => withDb(makeApiKeyCtx(team, { keyId: "k_res" }), tx);

async function declare(tx: DB, resolutionStop: "mitigated" | "resolved") {
  await upsertIncidentReporting({
    ctx: owner(tx),
    input: {
      targets: { critical: { responseMinutes: 60, resolutionMinutes: 240 } },
      resolutionStop,
    },
  });
  return declareIncident({
    ctx: apiKey(tx),
    input: { title: "Checkout down", severity: "critical" },
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

const move = (tx: DB, id: number, status: "open" | "mitigated" | "resolved") =>
  setIncidentStatus({ ctx: apiKey(tx), input: { id, status } });

async function resolution(tx: DB, id: number) {
  const row = await getIncident({ ctx: owner(tx), input: { id } });
  return row?.sla?.resolution ?? null;
}

describe("the resolution clock", () => {
  test("a mitigated stop stops on mitigation and keeps that time on resolve", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declare(tx, "mitigated");
      const mitigated = await move(tx, declared.id, "mitigated");
      expect(mitigated.resolutionStoppedAt).not.toBeNull();
      const resolved = await move(tx, declared.id, "resolved");
      expect(resolved.resolutionStoppedAt).toEqual(
        mitigated.resolutionStoppedAt,
      );
      expect((await resolution(tx, declared.id))?.status).toBe("met");
    });
  });

  test("a direct open to resolved meets a mitigated stop", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declare(tx, "mitigated");
      const resolved = await move(tx, declared.id, "resolved");
      expect(resolved.resolutionStoppedAt).toEqual(resolved.resolvedAt);
    });
  });

  test("a resolved stop keeps running through mitigation", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declare(tx, "resolved");
      const mitigated = await move(tx, declared.id, "mitigated");
      expect(mitigated.resolutionStoppedAt).toBeNull();
      expect((await resolution(tx, declared.id))?.status).toBe("running");
      const resolved = await move(tx, declared.id, "resolved");
      expect(resolved.resolutionStoppedAt).toEqual(resolved.resolvedAt);
    });
  });

  test("a failed mitigation runs the clock again; the next one is judged at its own time", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declare(tx, "mitigated");
      await declaredMinutesAgo(tx, declared.id, 100);
      const first = await move(tx, declared.id, "mitigated");
      expect(first.resolutionBreachDueAt).toBeNull();
      const reopened = await move(tx, declared.id, "open");
      expect(reopened.resolutionStoppedAt).toBeNull();
      expect(reopened.mitigatedAt).toEqual(first.mitigatedAt);
      const declaredAt = await declaredMinutesAgo(tx, declared.id, 300);
      const second = await move(tx, declared.id, "mitigated");
      expect(second.resolutionBreachDueAt).toEqual(
        new Date(declaredAt.getTime() + 240 * 60_000),
      );
      expect((await resolution(tx, declared.id))?.status).toBe("breached");
    });
  });

  test("reopening a resolved incident restarts against the original due time", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declare(tx, "resolved");
      const declaredAt = await declaredMinutesAgo(tx, declared.id, 30);
      await move(tx, declared.id, "resolved");
      await move(tx, declared.id, "open");
      const timer = await resolution(tx, declared.id);
      expect(timer?.metAt).toBeNull();
      expect(timer?.status).toBe("running");
      expect(timer?.dueAt).toEqual(
        new Date(declaredAt.getTime() + 240 * 60_000),
      );
    });
  });

  test("a late stop records the missed due time in the same write", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declare(tx, "resolved");
      const declaredAt = await declaredMinutesAgo(tx, declared.id, 300);
      const resolved = await move(tx, declared.id, "resolved");
      expect(resolved.resolutionBreachDueAt).toEqual(
        new Date(declaredAt.getTime() + 240 * 60_000),
      );
      // a reopen never clears a recorded miss
      const reopened = await move(tx, declared.id, "open");
      expect(reopened.resolutionBreachDueAt).toEqual(
        resolved.resolutionBreachDueAt,
      );
    });
  });

  test("an untracked incident stores no stop time", async () => {
    await withTestTransaction(async (tx) => {
      const declared = await declareIncident({
        ctx: apiKey(tx),
        input: { title: "Untracked", severity: "critical" },
      });
      const mitigated = await move(tx, declared.id, "mitigated");
      expect(mitigated.resolutionStoppedAt).toBeNull();
    });
  });
});
