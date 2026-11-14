import { db, eq } from "@openstatus/db";
import {
  monitor,
  monitorSlaPolicy,
  monitorSlaPolicyTerms,
  monitorSlaSealedMonth,
} from "@openstatus/db/src/schema";
import { createMonitor } from "@openstatus/db/src/test/factories";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  clearAuditLog,
  createWorkspaceFixture,
  makeUserCtx,
  readAuditLog,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB, ServiceContext } from "../../context";
import { PreconditionFailedError } from "../../errors";
import { createMonitorReporting } from "../create";
import { termsForMonth } from "../internal";
import { updateMonitorReporting } from "../update";

const now = new Date(Date.UTC(2026, 10, 15, 12));

let ownerCtx: ServiceContext;
let workspaceId: number;
let apiId: number;

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  workspaceId = team.workspace.id;
  ownerCtx = makeUserCtx(team.workspace, { userId: team.userId });
  apiId = (await createMonitor(workspaceId, { name: "API", regions: "fra" }))
    .id;
});

afterAll(async () => {
  await clearAuditLog(workspaceId);
  await db.delete(monitor).where(eq(monitor.workspaceId, workspaceId));
});

function termsRows(tx: DB, policyId: number) {
  return tx
    .select({
      target: monitorSlaPolicyTerms.target,
      strict: monitorSlaPolicyTerms.strict,
      effectiveFrom: monitorSlaPolicyTerms.effectiveFrom,
    })
    .from(monitorSlaPolicyTerms)
    .where(eq(monitorSlaPolicyTerms.monitorSlaPolicyId, policyId))
    .all();
}

async function seal(tx: DB, policyId: number) {
  await tx.insert(monitorSlaSealedMonth).values({
    workspaceId,
    monitorSlaPolicyId: policyId,
    monitorId: apiId,
    month: "2026-10-01",
    target: 99_500,
    strict: false,
    ok: 1,
    degraded: 0,
    error: 0,
    total: 1,
    up: 1,
    uptime: 100_000,
    met: true,
  });
}

describe("policy time zone", () => {
  test("defaults to UTC and accepts an IANA zone", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const utc = await createMonitorReporting({
        ctx,
        input: { name: "UTC", target: 99_500 },
      });
      expect(utc.timeZone).toBe("UTC");
      const berlin = await createMonitorReporting({
        ctx,
        input: { name: "Berlin", target: 99_500, timeZone: "Europe/Berlin" },
      });
      expect(berlin.timeZone).toBe("Europe/Berlin");
    });
  });

  test("zones are stored canonical; UTC aliases become UTC", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const etc = await createMonitorReporting({
        ctx,
        input: { name: "Etc", target: 99_500, timeZone: "Etc/UTC" },
      });
      expect(etc.timeZone).toBe("UTC");
      const lower = await createMonitorReporting({
        ctx,
        input: { name: "Lower", target: 99_500, timeZone: "europe/berlin" },
      });
      expect(lower.timeZone).toBe("Europe/Berlin");
      await expect(
        createMonitorReporting({
          ctx,
          input: { name: "Offset", target: 99_500, timeZone: "+05:00" },
        }),
      ).rejects.toThrow();

      await seal(tx, etc.id);
      // an alias of the stored zone is no zone change, so the seal lock does not trip
      const same = await updateMonitorReporting({
        ctx,
        input: { id: etc.id, timeZone: "Zulu", name: "Still UTC" },
        now,
      });
      expect(same).toMatchObject({ name: "Still UTC", timeZone: "UTC" });
    });
  });

  test("an unknown zone is rejected on create and update", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      await expect(
        createMonitorReporting({
          ctx,
          input: { name: "Bad", target: 99_500, timeZone: "Mars/Olympus" },
        }),
      ).rejects.toThrow();
      const policy = await createMonitorReporting({
        ctx,
        input: { name: "Ok", target: 99_500 },
      });
      await expect(
        updateMonitorReporting({
          ctx,
          input: { id: policy.id, timeZone: "Nowhere" },
          now,
        }),
      ).rejects.toThrow();
    });
  });

  test("changes while nothing is sealed, audited", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await createMonitorReporting({
        ctx,
        input: { name: "Move", target: 99_500 },
      });
      const updated = await updateMonitorReporting({
        ctx,
        input: { id: policy.id, timeZone: "America/New_York" },
        now,
      });
      expect(updated.timeZone).toBe("America/New_York");
      const [row] = await readAuditLog({
        workspaceId,
        entityType: "monitor_sla_policy",
        entityId: policy.id,
        db: tx,
      });
      expect(row?.action).toBe("monitor_sla_policy.update");
      expect(row?.before).toMatchObject({ timeZone: "UTC" });
      expect(row?.after).toMatchObject({ timeZone: "America/New_York" });
    });
  });

  test("is locked once a month is sealed", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await createMonitorReporting({
        ctx,
        input: { name: "Locked", target: 99_500, monitorIds: [apiId] },
      });
      await seal(tx, policy.id);
      await expect(
        updateMonitorReporting({
          ctx,
          input: { id: policy.id, timeZone: "Asia/Tokyo" },
          now,
        }),
      ).rejects.toBeInstanceOf(PreconditionFailedError);
      // resending the same zone is not a change
      const same = await updateMonitorReporting({
        ctx,
        input: { id: policy.id, timeZone: "UTC", name: "Still UTC" },
        now,
      });
      expect(same).toMatchObject({ name: "Still UTC", timeZone: "UTC" });
    });
  });
});

describe("terms in effect", () => {
  test("a new target applies from next month; this month keeps its terms", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await createMonitorReporting({
        ctx,
        input: { name: "Next", target: 99_500 },
      });
      const updated = await updateMonitorReporting({
        ctx,
        input: { id: policy.id, target: 99_900, strict: true },
        now,
      });
      expect(updated).toMatchObject({
        target: 99_900,
        strict: true,
        termsEffectiveFrom: "2026-12-01",
      });
      expect(await termsRows(tx, policy.id)).toEqual([
        { target: 99_900, strict: true, effectiveFrom: "2026-12-01" },
      ]);
      const row = await tx
        .select()
        .from(monitorSlaPolicy)
        .where(eq(monitorSlaPolicy.id, policy.id))
        .get();
      expect(row).toMatchObject({ target: 99_500, strict: false });

      expect(await termsForMonth(tx, policy, "2026-11-01")).toEqual({
        target: 99_500,
        strict: false,
        effectiveFrom: null,
      });
      expect(await termsForMonth(tx, policy, "2026-12-01")).toEqual({
        target: 99_900,
        strict: true,
        effectiveFrom: "2026-12-01",
      });

      const [audit] = await readAuditLog({
        workspaceId,
        entityType: "monitor_sla_policy",
        entityId: policy.id,
        db: tx,
      });
      expect(audit?.before).toMatchObject({ target: 99_500, strict: false });
      expect(audit?.after).toMatchObject({
        target: 99_900,
        strict: true,
        termsEffectiveFrom: "2026-12-01",
      });
    });
  });

  test("next month is taken in the policy's zone", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await createMonitorReporting({
        ctx,
        input: { name: "Tokyo", target: 99_500, timeZone: "Asia/Tokyo" },
      });
      // 2026-11-30 20:00 UTC is already 1 December in Tokyo
      await updateMonitorReporting({
        ctx,
        input: { id: policy.id, target: 99_000 },
        now: new Date(Date.UTC(2026, 10, 30, 20)),
      });
      expect(await termsRows(tx, policy.id)).toEqual([
        { target: 99_000, strict: false, effectiveFrom: "2027-01-01" },
      ]);
    });
  });

  test("a zone change keeps pending terms set before their month starts there", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await createMonitorReporting({
        ctx,
        input: { name: "Auckland", target: 99_500 },
      });
      await updateMonitorReporting({
        ctx,
        input: { id: policy.id, target: 99_900 },
        now: new Date(Date.UTC(2026, 10, 10)),
      });
      // 14:00 UTC on 30 November is already 1 December in Auckland
      const moved = await updateMonitorReporting({
        ctx,
        input: { id: policy.id, timeZone: "Pacific/Auckland" },
        now: new Date(Date.UTC(2026, 10, 30, 14)),
      });
      expect(await termsRows(tx, policy.id)).toEqual([
        { target: 99_900, strict: false, effectiveFrom: "2026-12-01" },
      ]);
      expect(moved).toMatchObject({
        timeZone: "Pacific/Auckland",
        target: 99_900,
        termsEffectiveFrom: "2026-12-01",
      });
    });
  });

  test("a zone change moves pending terms set after their month started there", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await createMonitorReporting({
        ctx,
        input: { name: "Late", target: 99_500 },
      });
      // set at 12:00 UTC on 30 November, after December began in Auckland (11:00 UTC)
      await updateMonitorReporting({
        ctx,
        input: { id: policy.id, target: 99_900 },
        now: new Date(Date.UTC(2026, 10, 30, 12)),
      });
      const moved = await updateMonitorReporting({
        ctx,
        input: { id: policy.id, timeZone: "Pacific/Auckland" },
        now: new Date(Date.UTC(2026, 10, 30, 14)),
      });
      expect(await termsRows(tx, policy.id)).toEqual([
        { target: 99_900, strict: false, effectiveFrom: "2027-01-01" },
      ]);
      expect(moved.termsEffectiveFrom).toBe("2027-01-01");
      expect(await termsForMonth(tx, policy, "2026-12-01")).toMatchObject({
        target: 99_500,
      });
    });
  });

  test("a zone change to an earlier zone keeps pending terms", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await createMonitorReporting({
        ctx,
        input: { name: "West", target: 99_500, timeZone: "Asia/Tokyo" },
      });
      await updateMonitorReporting({
        ctx,
        input: { id: policy.id, strict: true },
        now,
      });
      // 20:00 UTC on 30 November: December in Tokyo, still November in Los Angeles
      const boundary = new Date(Date.UTC(2026, 10, 30, 20));
      expect(await termsForMonth(tx, policy, "2026-12-01")).toMatchObject({
        strict: true,
      });
      const moved = await updateMonitorReporting({
        ctx,
        input: { id: policy.id, timeZone: "America/Los_Angeles" },
        now: boundary,
      });
      expect(await termsRows(tx, policy.id)).toEqual([
        { target: 99_500, strict: true, effectiveFrom: "2026-12-01" },
      ]);
      expect(moved.termsEffectiveFrom).toBe("2026-12-01");
      const after = { ...policy, timeZone: "America/Los_Angeles" };
      expect(await termsForMonth(tx, after, "2026-11-01")).toMatchObject({
        strict: false,
      });
    });
  });

  test("edits in one month upsert one row; reverting drops it", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await createMonitorReporting({
        ctx,
        input: { name: "Upsert", target: 99_500 },
      });
      await updateMonitorReporting({
        ctx,
        input: { id: policy.id, target: 99_900 },
        now,
      });
      await updateMonitorReporting({
        ctx,
        input: { id: policy.id, strict: true },
        now,
      });
      expect(await termsRows(tx, policy.id)).toEqual([
        { target: 99_900, strict: true, effectiveFrom: "2026-12-01" },
      ]);

      const reverted = await updateMonitorReporting({
        ctx,
        input: { id: policy.id, target: 99_500, strict: false },
        now,
      });
      expect(reverted).toMatchObject({
        target: 99_500,
        strict: false,
        termsEffectiveFrom: null,
      });
      expect(await termsRows(tx, policy.id)).toEqual([]);
    });
  });

  test("a save with the pending terms changes nothing", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await createMonitorReporting({
        ctx,
        input: { name: "Pending", target: 99_500 },
      });
      await updateMonitorReporting({
        ctx,
        input: { id: policy.id, target: 99_900 },
        now,
      });
      await updateMonitorReporting({
        ctx,
        input: { id: policy.id, target: 99_900, name: "Pending" },
        now,
      });
      const rows = await readAuditLog({
        workspaceId,
        entityType: "monitor_sla_policy",
        entityId: policy.id,
        db: tx,
      });
      expect(rows).toHaveLength(2);
    });
  });

  test("termsForMonth picks the latest row in effect, else the policy row", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await createMonitorReporting({
        ctx,
        input: { name: "History", target: 99_000 },
      });
      await tx.insert(monitorSlaPolicyTerms).values([
        {
          workspaceId,
          monitorSlaPolicyId: policy.id,
          target: 99_500,
          strict: false,
          effectiveFrom: "2026-03-01",
        },
        {
          workspaceId,
          monitorSlaPolicyId: policy.id,
          target: 99_900,
          strict: true,
          effectiveFrom: "2026-06-01",
        },
      ]);
      const at = async (month: string) =>
        (await termsForMonth(tx, policy, month)).target;
      expect(await at("2026-01-01")).toBe(99_000);
      expect(await at("2026-03-01")).toBe(99_500);
      expect(await at("2026-05-01")).toBe(99_500);
      expect(await at("2026-06-01")).toBe(99_900);
      expect(await at("2027-02-01")).toBe(99_900);

      // a live-month edit stacks on the June terms, not the policy row
      await updateMonitorReporting({
        ctx,
        input: { id: policy.id, strict: false },
        now,
      });
      expect(await termsForMonth(tx, policy, "2026-12-01")).toEqual({
        target: 99_900,
        strict: false,
        effectiveFrom: "2026-12-01",
      });
      expect(await at("2026-11-01")).toBe(99_900);
    });
  });
});
