import { db, eq } from "@openstatus/db";
import {
  page,
  statusReport,
  statusReportUpdate,
} from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { afterAll, beforeAll, describe, test } from "@std/testing/bdd";

import { SEEDED_WORKSPACE_TEAM_ID } from "../../../test/fixtures";
import {
  loadSeededWorkspace,
  makeUserCtx,
  readAuditLog,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB, ServiceContext } from "../../context";
import { addStatusReportUpdate } from "../add-update";
import { deleteStatusReportUpdate } from "../delete";
import { deriveReportStatus, recomputeReportStatus } from "../derive-status";
import type { StatusReportStatus } from "../schemas";
import { updateStatusReportUpdate } from "../update";

const TEST_PREFIX = "svc-derive-status-test";

let teamCtx: ServiceContext;
let testPageId: number;

// the page is created outside a transaction and shared by every test —
// inserting it inside each one lengthens the write lock and starves the
// other suites running in parallel (SQLITE_BUSY)
beforeAll(async () => {
  const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  teamCtx = makeUserCtx(team, { userId: 1 });

  const pageRow = await db
    .insert(page)
    .values({
      workspaceId: team.id,
      title: `${TEST_PREFIX}-page`,
      description: "test page",
      slug: `${TEST_PREFIX}-page-slug`,
      customDomain: "",
    })
    .returning()
    .get();
  testPageId = pageRow.id;
});

afterAll(async () => {
  await db
    .delete(page)
    .where(eq(page.id, testPageId))
    .catch(() => undefined);
});

const u = (id: number, status: StatusReportStatus, iso: string) => ({
  id,
  status,
  date: new Date(iso),
});

describe("deriveReportStatus (pure)", () => {
  test("empty set → null", () => {
    expect(deriveReportStatus([])).toBe(null);
  });

  test("single update → its status", () => {
    expect(deriveReportStatus([u(1, "identified", "2026-01-01")])).toBe(
      "identified",
    );
  });

  test("newest date wins", () => {
    expect(
      deriveReportStatus([
        u(1, "investigating", "2026-01-01"),
        u(2, "resolved", "2026-01-03"),
        u(3, "monitoring", "2026-01-02"),
      ]),
    ).toBe("resolved");
  });

  test("result is independent of input order", () => {
    const updates = [
      u(1, "investigating", "2026-01-01"),
      u(2, "resolved", "2026-01-03"),
      u(3, "monitoring", "2026-01-02"),
    ];
    expect(deriveReportStatus(updates)).toBe("resolved");
    expect(deriveReportStatus([...updates].reverse())).toBe("resolved");
  });

  test("date drives the winner, not id", () => {
    // higher id but older date must lose
    expect(
      deriveReportStatus([
        u(99, "investigating", "2026-01-01"),
        u(1, "resolved", "2026-01-09"),
      ]),
    ).toBe("resolved");
  });

  test("highest id breaks a same-timestamp tie", () => {
    const d = "2026-01-01T00:00:00Z";
    expect(
      deriveReportStatus([
        u(7, "monitoring", d),
        u(9, "resolved", d),
        u(8, "identified", d),
      ]),
    ).toBe("resolved");
  });

  test("tie-break is direction-stable", () => {
    const d = "2026-01-01T00:00:00Z";
    // same two updates, opposite input order → same winner (highest id)
    expect(
      deriveReportStatus([u(9, "investigating", d), u(8, "resolved", d)]),
    ).toBe("investigating");
    expect(
      deriveReportStatus([u(8, "resolved", d), u(9, "investigating", d)]),
    ).toBe("investigating");
  });

  test("sub-second differences are respected (getTime, not day)", () => {
    expect(
      deriveReportStatus([
        u(1, "monitoring", "2026-01-01T00:00:00.000Z"),
        u(2, "resolved", "2026-01-01T00:00:00.500Z"),
      ]),
    ).toBe("resolved");
  });

  test("does not mutate the input array", () => {
    const updates = [
      u(2, "resolved", "2026-01-03"),
      u(1, "investigating", "2026-01-01"),
    ];
    const snapshot = updates.map((x) => x.id);
    deriveReportStatus(updates);
    expect(updates.map((x) => x.id)).toEqual(snapshot);
  });

  test("every enum value can be the winner", () => {
    const statuses: StatusReportStatus[] = [
      "investigating",
      "identified",
      "monitoring",
      "resolved",
    ];
    statuses.forEach((status, i) => {
      expect(
        deriveReportStatus([
          u(1, "investigating", "2026-01-01"),
          u(2, status, `2026-01-0${i + 2}`),
        ]),
      ).toBe(status);
    });
  });
});

const STALE_UPDATED_AT = new Date("2020-01-01T00:00:00Z");

async function seedReport(
  tx: DB,
  workspaceId: number,
  status: StatusReportStatus,
) {
  return tx
    .insert(statusReport)
    .values({
      workspaceId,
      pageId: testPageId,
      title: `${TEST_PREFIX}-report`,
      status,
      // far in the past: `updatedAt` is second-precision, so a same-second
      // write would be indistinguishable from no write at all
      updatedAt: STALE_UPDATED_AT,
    })
    .returning()
    .get();
}

async function addUpdate(
  tx: DB,
  statusReportId: number,
  status: StatusReportStatus,
  iso: string,
) {
  return tx
    .insert(statusReportUpdate)
    .values({ statusReportId, status, date: new Date(iso), message: status })
    .returning()
    .get();
}

const readRow = async (tx: DB, id: number) =>
  tx.select().from(statusReport).where(eq(statusReport.id, id)).get();

const readStatus = async (tx: DB, id: number) =>
  (await readRow(tx, id))?.status;

describe("recomputeReportStatus (DB)", () => {
  test("persists the latest update's status onto the report", async () => {
    await withTestTransaction(async (tx) => {
      const report = await seedReport(
        tx,
        teamCtx.workspace.id,
        "investigating",
      );
      await addUpdate(tx, report.id, "identified", "2026-01-02T00:00:00Z");
      await addUpdate(tx, report.id, "monitoring", "2026-01-03T00:00:00Z");

      const updated = await recomputeReportStatus(tx, report.id);

      expect(updated?.status).toBe("monitoring");
      expect(await readStatus(tx, report.id)).toBe("monitoring");
    });
  });

  test("returns the refreshed report row", async () => {
    await withTestTransaction(async (tx) => {
      const report = await seedReport(
        tx,
        teamCtx.workspace.id,
        "investigating",
      );
      await addUpdate(tx, report.id, "resolved", "2026-01-05T00:00:00Z");

      const updated = await recomputeReportStatus(tx, report.id);

      expect(updated?.id).toBe(report.id);
      expect(updated?.status).toBe("resolved");
    });
  });

  test("no updates → returns null and leaves the column untouched", async () => {
    await withTestTransaction(async (tx) => {
      const report = await seedReport(tx, teamCtx.workspace.id, "identified");

      const updated = await recomputeReportStatus(tx, report.id);

      expect(updated).toBe(null);
      expect(await readStatus(tx, report.id)).toBe("identified");
    });
  });

  test("resolves same-timestamp updates by id through the DB query", async () => {
    await withTestTransaction(async (tx) => {
      const report = await seedReport(
        tx,
        teamCtx.workspace.id,
        "investigating",
      );
      const d = "2026-02-01T00:00:00Z";
      // inserted in ascending-id order; the later insert (higher id) must win
      await addUpdate(tx, report.id, "identified", d);
      await addUpdate(tx, report.id, "monitoring", d);

      await recomputeReportStatus(tx, report.id);

      expect(await readStatus(tx, report.id)).toBe("monitoring");
    });
  });

  test("a back-dated update does not become the status", async () => {
    await withTestTransaction(async (tx) => {
      const report = await seedReport(
        tx,
        teamCtx.workspace.id,
        "investigating",
      );
      await addUpdate(tx, report.id, "resolved", "2026-01-05T00:00:00Z");
      await addUpdate(tx, report.id, "identified", "2026-01-02T00:00:00Z");

      await recomputeReportStatus(tx, report.id);

      expect(await readStatus(tx, report.id)).toBe("resolved");
    });
  });

  test("is idempotent", async () => {
    await withTestTransaction(async (tx) => {
      const report = await seedReport(
        tx,
        teamCtx.workspace.id,
        "investigating",
      );
      await addUpdate(tx, report.id, "monitoring", "2026-01-02T00:00:00Z");

      await recomputeReportStatus(tx, report.id);
      const first = await readStatus(tx, report.id);
      await recomputeReportStatus(tx, report.id);
      const second = await readStatus(tx, report.id);

      expect(first).toBe("monitoring");
      expect(second).toBe("monitoring");
    });
  });

  test("only touches the target report", async () => {
    await withTestTransaction(async (tx) => {
      const a = await seedReport(tx, teamCtx.workspace.id, "investigating");
      const b = await seedReport(tx, teamCtx.workspace.id, "investigating");
      await addUpdate(tx, a.id, "resolved", "2026-01-02T00:00:00Z");
      await addUpdate(tx, b.id, "identified", "2026-01-02T00:00:00Z");

      await recomputeReportStatus(tx, a.id);

      expect(await readStatus(tx, a.id)).toBe("resolved");
      expect(await readStatus(tx, b.id)).toBe("investigating");
    });
  });

  // regression: cal.com report 2259. Its updates were edited in place —
  // the last one flipped to `resolved` — but the report column stayed on
  // `identified`, so the badge read degraded for a month.
  test("editing an update's status re-derives the report status", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const report = await seedReport(tx, teamCtx.workspace.id, "identified");
      await addUpdate(tx, report.id, "identified", "2026-06-22T22:00:47Z");
      const last = await addUpdate(
        tx,
        report.id,
        "identified",
        "2026-06-23T14:48:44Z",
      );

      await updateStatusReportUpdate({
        ctx,
        input: { id: last.id, status: "resolved" },
      });

      expect(await readStatus(tx, report.id)).toBe("resolved");
    });
  });

  // `status_report_update.create` carries it; the update/delete rows did
  // not, so an audit reader could not tell which report an edit belonged to
  test("the update audit row carries statusReportId metadata", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const report = await seedReport(tx, teamCtx.workspace.id, "identified");
      const only = await addUpdate(
        tx,
        report.id,
        "identified",
        "2026-01-02T00:00:00Z",
      );

      await updateStatusReportUpdate({
        ctx,
        input: { id: only.id, status: "resolved" },
      });

      const rows = await readAuditLog({
        workspaceId: teamCtx.workspace.id,
        entityType: "status_report_update",
        entityId: String(only.id),
        db: tx,
      });
      const row = rows.find((r) => r.action === "status_report_update.update");
      expect(row).toBeDefined();
      expect(row?.metadata).toEqual({ statusReportId: report.id });
    });
  });

  test("adding a back-dated update does not become the report status", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const report = await seedReport(
        tx,
        teamCtx.workspace.id,
        "investigating",
      );
      await addUpdate(tx, report.id, "resolved", "2026-01-05T00:00:00Z");
      await recomputeReportStatus(tx, report.id);

      // filed late, dated before the resolve
      await addStatusReportUpdate({
        ctx,
        input: {
          statusReportId: report.id,
          status: "identified",
          message: "backfilled detail",
          date: new Date("2026-01-02T00:00:00Z"),
        },
      });

      expect(await readStatus(tx, report.id)).toBe("resolved");
    });
  });

  test("adding a newer update still advances the report status", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const report = await seedReport(
        tx,
        teamCtx.workspace.id,
        "investigating",
      );
      await addUpdate(tx, report.id, "investigating", "2026-01-01T00:00:00Z");
      await recomputeReportStatus(tx, report.id);

      const { statusReport: bumped } = await addStatusReportUpdate({
        ctx,
        input: {
          statusReportId: report.id,
          status: "monitoring",
          message: "moved on",
          date: new Date("2026-01-04T00:00:00Z"),
        },
      });

      expect(bumped.status).toBe("monitoring");
      expect(await readStatus(tx, report.id)).toBe("monitoring");
    });
  });

  test("the delete audit row carries statusReportId metadata", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const report = await seedReport(tx, teamCtx.workspace.id, "identified");
      await addUpdate(tx, report.id, "identified", "2026-01-02T00:00:00Z");
      const doomed = await addUpdate(
        tx,
        report.id,
        "resolved",
        "2026-01-03T00:00:00Z",
      );

      await deleteStatusReportUpdate({ ctx, input: { id: doomed.id } });

      const rows = await readAuditLog({
        workspaceId: teamCtx.workspace.id,
        entityType: "status_report_update",
        entityId: String(doomed.id),
        db: tx,
      });
      const row = rows.find((r) => r.action === "status_report_update.delete");
      expect(row).toBeDefined();
      expect(row?.metadata).toEqual({ statusReportId: report.id });
    });
  });

  test("a message-only edit does not bump the report's updatedAt", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const report = await seedReport(tx, teamCtx.workspace.id, "monitoring");
      const only = await addUpdate(
        tx,
        report.id,
        "monitoring",
        "2026-01-02T00:00:00Z",
      );

      await updateStatusReportUpdate({
        ctx,
        input: { id: only.id, message: "typo fixed" },
      });

      const after = await readRow(tx, report.id);
      expect(after?.status).toBe("monitoring");
      // the RSS/Atom feed dates and sorts items by updatedAt
      expect(after?.updatedAt?.getTime()).toBe(STALE_UPDATED_AT.getTime());
    });
  });

  test("a same-status update still bumps the report's updatedAt", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const report = await seedReport(tx, teamCtx.workspace.id, "monitoring");
      await addUpdate(tx, report.id, "monitoring", "2026-01-02T00:00:00Z");

      await addStatusReportUpdate({
        ctx,
        input: {
          statusReportId: report.id,
          status: "monitoring",
          message: "still working on it",
          date: new Date("2026-01-03T00:00:00Z"),
        },
      });

      const after = await readRow(tx, report.id);
      expect(after?.status).toBe("monitoring");
      // RSS/Atom consumers would miss the update otherwise
      expect(after?.updatedAt?.getTime()).toBeGreaterThan(
        STALE_UPDATED_AT.getTime(),
      );
    });
  });

  test("a back-dated same-status update does not bump updatedAt", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const report = await seedReport(tx, teamCtx.workspace.id, "monitoring");
      await addUpdate(tx, report.id, "monitoring", "2026-01-05T00:00:00Z");

      await addStatusReportUpdate({
        ctx,
        input: {
          statusReportId: report.id,
          status: "monitoring",
          message: "backfilled detail",
          date: new Date("2026-01-02T00:00:00Z"),
        },
      });

      const after = await readRow(tx, report.id);
      expect(after?.updatedAt?.getTime()).toBe(STALE_UPDATED_AT.getTime());
    });
  });

  test("deleting the latest update re-derives the report status", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const report = await seedReport(tx, teamCtx.workspace.id, "resolved");
      await addUpdate(tx, report.id, "investigating", "2026-01-02T00:00:00Z");
      const doomed = await addUpdate(
        tx,
        report.id,
        "resolved",
        "2026-01-03T00:00:00Z",
      );

      await deleteStatusReportUpdate({ ctx, input: { id: doomed.id } });

      expect(await readStatus(tx, report.id)).toBe("investigating");
    });
  });

  test("deleting a non-latest update leaves the report status alone", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const report = await seedReport(tx, teamCtx.workspace.id, "resolved");
      const doomed = await addUpdate(
        tx,
        report.id,
        "investigating",
        "2026-01-02T00:00:00Z",
      );
      await addUpdate(tx, report.id, "resolved", "2026-01-03T00:00:00Z");

      await deleteStatusReportUpdate({ ctx, input: { id: doomed.id } });

      const after = await readRow(tx, report.id);
      expect(after?.status).toBe("resolved");
      expect(after?.updatedAt?.getTime()).toBe(STALE_UPDATED_AT.getTime());
    });
  });

  test("persisted column agrees with the pure function on the same rows", async () => {
    await withTestTransaction(async (tx) => {
      const report = await seedReport(
        tx,
        teamCtx.workspace.id,
        "investigating",
      );
      await addUpdate(tx, report.id, "identified", "2026-01-02T00:00:00Z");
      await addUpdate(tx, report.id, "monitoring", "2026-01-04T00:00:00Z");
      await addUpdate(tx, report.id, "resolved", "2026-01-03T00:00:00Z");

      await recomputeReportStatus(tx, report.id);

      const rows = await tx
        .select({
          id: statusReportUpdate.id,
          status: statusReportUpdate.status,
          date: statusReportUpdate.date,
        })
        .from(statusReportUpdate)
        .where(eq(statusReportUpdate.statusReportId, report.id))
        .all();

      expect(await readStatus(tx, report.id)).toBe(deriveReportStatus(rows));
    });
  });
});
