import {
  maintenance,
  maintenancesToPageComponents,
  statusReport,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";
import {
  createPage,
  createPageComponent,
} from "@openstatus/db/src/test/factories";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { DrizzleTx, ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError } from "../../errors";
import { getPageOverallStatus } from "../get-overall-status";
import { getPageRow } from "../list";

let teamCtx: ServiceContext;
let otherCtx: ServiceContext;

beforeAll(async () => {
  teamCtx = makeUserCtx((await createWorkspaceFixture("team")).workspace, {
    userId: 1,
  });
  otherCtx = makeUserCtx((await createWorkspaceFixture("team")).workspace, {
    userId: 2,
  });
});

const HOUR = 60 * 60 * 1000;

async function pageWithComponents(tx: DrizzleTx, count: number) {
  const wsId = teamCtx.workspace.id;
  const p = await createPage(wsId, {}, tx);
  const components = [];
  for (let i = 0; i < count; i++) {
    components.push(await createPageComponent(wsId, p.id, { order: i }, tx));
  }
  return { page: p, components };
}

async function addReport(
  tx: DrizzleTx,
  pageId: number,
  componentIds: number[],
  status: "investigating" | "identified" | "monitoring" | "resolved",
) {
  const report = await tx
    .insert(statusReport)
    .values({
      title: "outage",
      status,
      workspaceId: teamCtx.workspace.id,
      pageId,
    })
    .returning()
    .get();
  if (componentIds.length > 0) {
    await tx.insert(statusReportsToPageComponents).values(
      componentIds.map((pageComponentId) => ({
        statusReportId: report.id,
        pageComponentId,
      })),
    );
  }
}

async function addMaintenance(
  tx: DrizzleTx,
  pageId: number,
  componentIds: number[],
  window: { from: Date; to: Date },
) {
  const row = await tx
    .insert(maintenance)
    .values({
      title: "upgrade",
      message: "",
      ...window,
      workspaceId: teamCtx.workspace.id,
      pageId,
    })
    .returning()
    .get();
  if (componentIds.length > 0) {
    await tx.insert(maintenancesToPageComponents).values(
      componentIds.map((pageComponentId) => ({
        maintenanceId: row.id,
        pageComponentId,
      })),
    );
  }
}

const ongoing = () => ({
  from: new Date(Date.now() - HOUR),
  to: new Date(Date.now() + HOUR),
});

describe("getPageOverallStatus", () => {
  test("operational with nothing active", async () => {
    await withTestTransaction(async (tx) => {
      const { page, components } = await pageWithComponents(tx, 2);
      expect(
        await getPageOverallStatus({ ctx: { db: tx }, pageId: page.id }),
      ).toEqual({
        status: "operational",
        components: components.map((c) => ({
          id: c.id,
          status: "operational",
        })),
      });
    });
  });

  test("an active report degrades its components and the page", async () => {
    await withTestTransaction(async (tx) => {
      const { page, components } = await pageWithComponents(tx, 2);
      const [hit, other] = components;
      if (!hit || !other) throw new Error("fixture");
      await addReport(tx, page.id, [hit.id], "identified");

      const result = await getPageOverallStatus({
        ctx: { db: tx },
        pageId: page.id,
      });
      expect(result.status).toBe("degraded");
      expect(result.components).toEqual([
        { id: hit.id, status: "degraded" },
        { id: other.id, status: "operational" },
      ]);
    });
  });

  test("a resolved report counts for nothing", async () => {
    await withTestTransaction(async (tx) => {
      const { page, components } = await pageWithComponents(tx, 1);
      await addReport(tx, page.id, [components[0]?.id ?? 0], "resolved");
      const result = await getPageOverallStatus({
        ctx: { db: tx },
        pageId: page.id,
      });
      expect(result.status).toBe("operational");
      expect(result.components[0]?.status).toBe("operational");
    });
  });

  test("an ongoing maintenance puts its components and the page in maintenance", async () => {
    await withTestTransaction(async (tx) => {
      const { page, components } = await pageWithComponents(tx, 2);
      const [hit, other] = components;
      if (!hit || !other) throw new Error("fixture");
      await addMaintenance(tx, page.id, [hit.id], ongoing());

      const result = await getPageOverallStatus({
        ctx: { db: tx },
        pageId: page.id,
      });
      expect(result.status).toBe("maintenance");
      expect(result.components).toEqual([
        { id: hit.id, status: "maintenance" },
        { id: other.id, status: "operational" },
      ]);
    });
  });

  test("a past or future maintenance counts for nothing", async () => {
    await withTestTransaction(async (tx) => {
      const { page, components } = await pageWithComponents(tx, 1);
      const ids = [components[0]?.id ?? 0];
      const now = Date.now();
      await addMaintenance(tx, page.id, ids, {
        from: new Date(now - 3 * HOUR),
        to: new Date(now - 2 * HOUR),
      });
      await addMaintenance(tx, page.id, ids, {
        from: new Date(now + 2 * HOUR),
        to: new Date(now + 3 * HOUR),
      });
      const result = await getPageOverallStatus({
        ctx: { db: tx },
        pageId: page.id,
      });
      expect(result.status).toBe("operational");
    });
  });

  test("a report outranks a maintenance, on the page and on a component", async () => {
    await withTestTransaction(async (tx) => {
      const { page, components } = await pageWithComponents(tx, 2);
      const [both, maint] = components;
      if (!both || !maint) throw new Error("fixture");
      await addReport(tx, page.id, [both.id], "monitoring");
      await addMaintenance(tx, page.id, [both.id, maint.id], ongoing());

      const result = await getPageOverallStatus({
        ctx: { db: tx },
        pageId: page.id,
      });
      expect(result.status).toBe("degraded");
      expect(result.components).toEqual([
        { id: both.id, status: "degraded" },
        { id: maint.id, status: "maintenance" },
      ]);
    });
  });

  test("a page-wide maintenance without components still sets the page", async () => {
    await withTestTransaction(async (tx) => {
      const { page } = await pageWithComponents(tx, 1);
      await addMaintenance(tx, page.id, [], ongoing());
      const result = await getPageOverallStatus({
        ctx: { db: tx },
        pageId: page.id,
      });
      expect(result.status).toBe("maintenance");
      expect(result.components[0]?.status).toBe("operational");
    });
  });

  test("a page without components is operational", async () => {
    await withTestTransaction(async (tx) => {
      const { page } = await pageWithComponents(tx, 0);
      expect(
        await getPageOverallStatus({ ctx: { db: tx }, pageId: page.id }),
      ).toEqual({ status: "operational", components: [] });
    });
  });

  test("uses the component ids the caller passes, in their order", async () => {
    await withTestTransaction(async (tx) => {
      const { page, components } = await pageWithComponents(tx, 2);
      const [a, b] = components;
      if (!a || !b) throw new Error("fixture");
      await addReport(tx, page.id, [a.id], "investigating");
      const result = await getPageOverallStatus({
        ctx: { db: tx },
        pageId: page.id,
        componentIds: [b.id, a.id],
      });
      expect(result.components).toEqual([
        { id: b.id, status: "operational" },
        { id: a.id, status: "degraded" },
      ]);
    });
  });
});

describe("getPageRow", () => {
  test("returns the raw row in the caller's workspace", async () => {
    await withTestTransaction(async (tx) => {
      const p = await createPage(
        teamCtx.workspace.id,
        { authEmailDomains: "acme.com,example.com" },
        tx,
      );
      const row = await getPageRow({
        ctx: { ...teamCtx, db: tx },
        input: { id: p.id },
      });
      expect(row.id).toBe(p.id);
      expect(row.authEmailDomains).toBe("acme.com,example.com");
    });
  });

  test("another workspace's page is NotFound", async () => {
    await withTestTransaction(async (tx) => {
      const p = await createPage(teamCtx.workspace.id, {}, tx);
      await expect(
        getPageRow({ ctx: { ...otherCtx, db: tx }, input: { id: p.id } }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("needs pages:read", async () => {
    await withTestTransaction(async (tx) => {
      const p = await createPage(teamCtx.workspace.id, {}, tx);
      const keyCtx = (
        scopes: Parameters<typeof makeApiKeyCtx>[1]["scopes"],
      ) => ({
        ...makeApiKeyCtx(teamCtx.workspace, { keyId: "k", scopes }),
        db: tx,
      });
      await expect(
        getPageRow({ ctx: keyCtx(["incidents:write"]), input: { id: p.id } }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      for (const scopes of [["pages:read"], ["pages:write"]] as const) {
        expect(
          (await getPageRow({ ctx: keyCtx([...scopes]), input: { id: p.id } }))
            .id,
        ).toBe(p.id);
      }
    });
  });
});
