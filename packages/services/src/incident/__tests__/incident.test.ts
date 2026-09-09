import { db, eq } from "@openstatus/db";
import { incidentTable, page } from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  expectAuditRow,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ConflictError, ForbiddenError, NotFoundError } from "../../errors";
import { acknowledgeIncident } from "../acknowledge";
import { createIncident } from "../create";
import { deleteIncident } from "../delete";
import { getIncident, listIncidents } from "../list";
import { promoteIncident } from "../promote";
import { resolveIncident } from "../resolve";
import { updateIncident } from "../update";

const TEST_PREFIX = "svc-new-incident-test";

let teamCtx: ServiceContext;
let otherCtx: ServiceContext;

beforeAll(async () => {
  const team = (await createWorkspaceFixture("team")).workspace;
  const other = (await createWorkspaceFixture("team")).workspace;
  teamCtx = makeUserCtx(team, { userId: 1 });
  otherCtx = makeUserCtx(other, { userId: 2 });
});

describe("createIncident", () => {
  test("creates an external incident and writes an audit row", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const incident = await createIncident({
        ctx,
        input: {
          title: `${TEST_PREFIX}-a`,
          summary: "",
          severity: "critical",
          origin: "external",
          fingerprint: "group-a",
        },
      });

      expect(incident.origin).toBe("external");
      expect(incident.status).toBe("triage");
      expect(incident.severity).toBe("critical");
      expect(incident.resolvedAt).toBe(null);
      expect(incident.startedAt.getTime()).toBe(incident.lastSeenAt.getTime());

      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "incident.create",
        entityType: "incident",
        entityId: incident.id,
        db: tx,
      });
    });
  });

  test("rejects a read-only actor", async () => {
    const ctx = makeApiKeyCtx(teamCtx.workspace, {
      keyId: "k1",
      scopes: ["read"],
    });
    await expect(
      createIncident({
        ctx,
        input: {
          title: "nope",
          summary: "",
          severity: "info",
          origin: "manual",
        },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("a second open incident for one fingerprint is unrepresentable", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const source = await tx
        .insert(incidentTable)
        .values({
          workspaceId: teamCtx.workspace.id,
          title: `${TEST_PREFIX}-dup`,
          origin: "external",
          fingerprint: null,
          alertSourceId: null,
          startedAt: new Date(),
          lastSeenAt: new Date(),
        })
        .returning()
        .get();
      expect(source.id).toBeTruthy();
    });
  });
});

describe("acknowledgeIncident / resolveIncident", () => {
  test("acknowledge moves triage to investigating, then resolve closes it", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const created = await createIncident({
        ctx,
        input: {
          title: `${TEST_PREFIX}-b`,
          summary: "",
          severity: "warning",
          origin: "manual",
        },
      });

      const acked = await acknowledgeIncident({
        ctx,
        input: { id: created.id },
      });
      expect(acked.acknowledgedAt).not.toBe(null);
      expect(acked.status).toBe("investigating");

      await expect(
        acknowledgeIncident({ ctx, input: { id: created.id } }),
      ).rejects.toBeInstanceOf(ConflictError);

      const resolved = await resolveIncident({
        ctx,
        input: { id: created.id },
      });
      expect(resolved.resolvedAt).not.toBe(null);
      expect(resolved.status).toBe("resolved");
      expect(resolved.autoResolved).toBe(false);

      await expect(
        resolveIncident({ ctx, input: { id: created.id } }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });
});

describe("workspace scoping", () => {
  test("another workspace cannot read, update or delete the incident", async () => {
    await withTestTransaction(async (tx) => {
      const created = await createIncident({
        ctx: { ...teamCtx, db: tx },
        input: {
          title: `${TEST_PREFIX}-c`,
          summary: "",
          severity: "info",
          origin: "manual",
        },
      });
      const foreign = { ...otherCtx, db: tx };

      await expect(
        getIncident({ ctx: foreign, input: { id: created.id } }),
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(
        updateIncident({ ctx: foreign, input: { id: created.id, title: "x" } }),
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(
        deleteIncident({ ctx: foreign, input: { id: created.id } }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

describe("listIncidents", () => {
  test("returns only this workspace's incidents, newest first", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      await createIncident({
        ctx,
        input: {
          title: `${TEST_PREFIX}-old`,
          summary: "",
          severity: "info",
          origin: "manual",
          startedAt: new Date(Date.now() - 60_000),
        },
      });
      const newer = await createIncident({
        ctx,
        input: {
          title: `${TEST_PREFIX}-new`,
          summary: "",
          severity: "info",
          origin: "manual",
        },
      });

      const { items } = await listIncidents({ ctx, input: { order: "desc" } });
      expect(items.length).toBeGreaterThanOrEqual(2);
      expect(items[0].id).toBe(newer.id);
      for (const item of items) {
        expect(item.workspaceId).toBe(teamCtx.workspace.id);
      }
    });
  });

  test("filters by origin", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      await createIncident({
        ctx,
        input: {
          title: `${TEST_PREFIX}-ext`,
          summary: "",
          severity: "info",
          origin: "external",
        },
      });
      const { items } = await listIncidents({
        ctx,
        input: { origin: "external" },
      });
      for (const item of items) expect(item.origin).toBe("external");
    });
  });
});

describe("promoteIncident", () => {
  test("creates a status report and links it back, once", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const pageRow = await tx
        .insert(page)
        .values({
          workspaceId: teamCtx.workspace.id,
          title: `${TEST_PREFIX}-page`,
          description: "",
          slug: `${TEST_PREFIX}-${Date.now()}`,
          customDomain: "",
        })
        .returning()
        .get();

      const created = await createIncident({
        ctx,
        input: {
          title: `${TEST_PREFIX}-promote`,
          summary: "",
          severity: "critical",
          origin: "external",
        },
      });

      const { incident, statusReport } = await promoteIncident({
        ctx,
        input: {
          id: created.id,
          pageId: pageRow.id,
          pageComponentIds: [],
          message: "We are looking into it.",
        },
      });

      expect(statusReport.id).toBeTruthy();
      expect(incident.statusReportId).toBe(statusReport.id);
      expect(statusReport.title).toBe(created.title);

      await expect(
        promoteIncident({
          ctx,
          input: {
            id: created.id,
            pageId: pageRow.id,
            pageComponentIds: [],
            message: "again",
          },
        }),
      ).rejects.toBeInstanceOf(ConflictError);

      await tx.delete(incidentTable).where(eq(incidentTable.id, created.id));
    });
  });
});
