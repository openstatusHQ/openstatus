import { beforeAll, describe, expect, test } from "bun:test";

import { page, pageComponent } from "@openstatus/db/src/schema";

import { SEEDED_WORKSPACE_TEAM_ID } from "../../../test/fixtures";
import {
  loadSeededWorkspace,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB, ServiceContext } from "../../context";
import {
  getComponentImpactsForUpdate,
  getCurrentImpactsForReport,
} from "../../status-report/internal";
import { agentTools } from "../index";

const TEST_PREFIX = "agent-tools-impacts-test";

let teamCtx: ServiceContext;

beforeAll(async () => {
  const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  teamCtx = makeUserCtx(team, { userId: 1 });
});

async function seedPageWithComponents(tx: DB, workspaceId: number) {
  const pageRow = await tx
    .insert(page)
    .values({
      workspaceId,
      title: `${TEST_PREFIX}-page`,
      description: "test page",
      slug: `${TEST_PREFIX}-page-slug`,
      customDomain: "",
    })
    .returning()
    .get();
  const componentA = await tx
    .insert(pageComponent)
    .values({
      workspaceId,
      pageId: pageRow.id,
      name: `${TEST_PREFIX}-component-a`,
      type: "static",
    })
    .returning()
    .get();
  const componentB = await tx
    .insert(pageComponent)
    .values({
      workspaceId,
      pageId: pageRow.id,
      name: `${TEST_PREFIX}-component-b`,
      type: "static",
    })
    .returning()
    .get();
  return {
    pageId: pageRow.id,
    componentA: componentA.id,
    componentB: componentB.id,
  };
}

describe("status-report agent tools: componentImpacts round-trip", () => {
  test("create_status_report writes impact rows and unions membership", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { pageId, componentA, componentB } = await seedPageWithComponents(
        tx,
        ctx.workspace.id,
      );

      const tool = agentTools.create_status_report;
      const input = tool.inputSchema.parse({
        title: `${TEST_PREFIX}-create`,
        status: "investigating",
        message: "looking into it",
        pageId,
        // componentB appears only via impacts — create must union it in.
        pageComponentIds: [componentA],
        componentImpacts: [
          { pageComponentId: componentA, impact: "major_outage" },
          { pageComponentId: componentB, impact: "degraded_performance" },
        ],
        notify: false,
      });
      const out = await tool.run({ ctx, input });
      expect(tool.outputSchema.safeParse(out).success).toBe(true);

      const impacts = await getCurrentImpactsForReport(tx, out.statusReport.id);
      expect(impacts.get(componentA)).toBe("major_outage");
      expect(impacts.get(componentB)).toBe("degraded_performance");
    });
  });

  test("add_status_report_update changes impact; resolve clears the rest to operational", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { pageId, componentA, componentB } = await seedPageWithComponents(
        tx,
        ctx.workspace.id,
      );

      const created = await agentTools.create_status_report.run({
        ctx,
        input: agentTools.create_status_report.inputSchema.parse({
          title: `${TEST_PREFIX}-lifecycle`,
          status: "investigating",
          message: "down",
          pageId,
          pageComponentIds: [],
          componentImpacts: [
            { pageComponentId: componentA, impact: "major_outage" },
            { pageComponentId: componentB, impact: "partial_outage" },
          ],
          notify: false,
        }),
      });
      const reportId = created.statusReport.id;

      // Only componentA is named — componentB must keep its prior impact.
      await agentTools.add_status_report_update.run({
        ctx,
        input: agentTools.add_status_report_update.inputSchema.parse({
          statusReportId: reportId,
          status: "monitoring",
          message: "recovering",
          componentImpacts: [
            { pageComponentId: componentA, impact: "degraded_performance" },
          ],
          notify: false,
        }),
      });
      const midway = await getCurrentImpactsForReport(tx, reportId);
      expect(midway.get(componentA)).toBe("degraded_performance");
      expect(midway.get(componentB)).toBe("partial_outage");

      const resolved = await agentTools.resolve_status_report.run({
        ctx,
        input: agentTools.resolve_status_report.inputSchema.parse({
          statusReportId: reportId,
          message: "all good again",
          notify: false,
        }),
      });
      expect(resolved.statusReportUpdateId).toBeGreaterThan(0);

      const final = await getCurrentImpactsForReport(tx, reportId);
      expect(final.get(componentA)).toBe("operational");
      expect(final.get(componentB)).toBe("operational");
    });
  });

  test("input schema rejects duplicate pageComponentId in componentImpacts", () => {
    const result = agentTools.create_status_report.inputSchema.safeParse({
      title: "dup",
      status: "investigating",
      message: "msg",
      pageId: 1,
      pageComponentIds: [],
      componentImpacts: [
        { pageComponentId: 1, impact: "major_outage" },
        { pageComponentId: 1, impact: "operational" },
      ],
      notify: false,
    });
    expect(result.success).toBe(false);
  });
});

describe("add_status_report_update carries prior impacts forward", () => {
  async function impactsByComponent(tx: DB, updateId: number) {
    const rows = await getComponentImpactsForUpdate(tx, updateId);
    return new Map(rows.map((r) => [r.pageComponentId, r.impact]));
  }

  test("carries prior non-operational impact into the new update's own rows", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { pageId, componentA } = await seedPageWithComponents(
        tx,
        ctx.workspace.id,
      );

      const created = await agentTools.create_status_report.run({
        ctx,
        input: agentTools.create_status_report.inputSchema.parse({
          title: `${TEST_PREFIX}-carry`,
          status: "investigating",
          message: "down",
          pageId,
          pageComponentIds: [],
          componentImpacts: [
            { pageComponentId: componentA, impact: "major_outage" },
          ],
          notify: false,
        }),
      });

      const update = await agentTools.add_status_report_update.run({
        ctx,
        input: agentTools.add_status_report_update.inputSchema.parse({
          statusReportId: created.statusReport.id,
          status: "monitoring",
          message: "watching it",
          notify: false,
        }),
      });

      const rows = await impactsByComponent(tx, update.statusReportUpdateId);
      expect(rows.get(componentA)).toBe("major_outage");
    });
  });

  test("explicit change wins over carry-forward", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { pageId, componentA } = await seedPageWithComponents(
        tx,
        ctx.workspace.id,
      );

      const created = await agentTools.create_status_report.run({
        ctx,
        input: agentTools.create_status_report.inputSchema.parse({
          title: `${TEST_PREFIX}-explicit`,
          status: "investigating",
          message: "down",
          pageId,
          pageComponentIds: [],
          componentImpacts: [
            { pageComponentId: componentA, impact: "major_outage" },
          ],
          notify: false,
        }),
      });

      const update = await agentTools.add_status_report_update.run({
        ctx,
        input: agentTools.add_status_report_update.inputSchema.parse({
          statusReportId: created.statusReport.id,
          status: "monitoring",
          message: "partial recovery",
          componentImpacts: [
            { pageComponentId: componentA, impact: "degraded_performance" },
          ],
          notify: false,
        }),
      });

      const rows = await impactsByComponent(tx, update.statusReportUpdateId);
      expect(rows.get(componentA)).toBe("degraded_performance");
    });
  });

  test("recovery to operational is preserved, not re-inflated", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { pageId, componentA } = await seedPageWithComponents(
        tx,
        ctx.workspace.id,
      );

      const created = await agentTools.create_status_report.run({
        ctx,
        input: agentTools.create_status_report.inputSchema.parse({
          title: `${TEST_PREFIX}-recovery`,
          status: "investigating",
          message: "down",
          pageId,
          pageComponentIds: [],
          componentImpacts: [
            { pageComponentId: componentA, impact: "major_outage" },
          ],
          notify: false,
        }),
      });

      const update = await agentTools.add_status_report_update.run({
        ctx,
        input: agentTools.add_status_report_update.inputSchema.parse({
          statusReportId: created.statusReport.id,
          status: "monitoring",
          message: "back up",
          componentImpacts: [
            { pageComponentId: componentA, impact: "operational" },
          ],
          notify: false,
        }),
      });

      const rows = await impactsByComponent(tx, update.statusReportUpdateId);
      expect(rows.get(componentA)).toBe("operational");
    });
  });

  test("carries an unchanged component while adding a newly named one", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { pageId, componentA, componentB } = await seedPageWithComponents(
        tx,
        ctx.workspace.id,
      );

      const created = await agentTools.create_status_report.run({
        ctx,
        input: agentTools.create_status_report.inputSchema.parse({
          title: `${TEST_PREFIX}-both`,
          status: "investigating",
          message: "down",
          pageId,
          pageComponentIds: [],
          componentImpacts: [
            { pageComponentId: componentA, impact: "major_outage" },
          ],
          notify: false,
        }),
      });

      const update = await agentTools.add_status_report_update.run({
        ctx,
        input: agentTools.add_status_report_update.inputSchema.parse({
          statusReportId: created.statusReport.id,
          status: "identified",
          message: "another component affected",
          componentImpacts: [
            { pageComponentId: componentB, impact: "partial_outage" },
          ],
          notify: false,
        }),
      });

      const rows = await impactsByComponent(tx, update.statusReportUpdateId);
      expect(rows.get(componentA)).toBe("major_outage");
      expect(rows.get(componentB)).toBe("partial_outage");
    });
  });

  test("prepareDraftInput enriches the confirmation preview with carried impacts", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { pageId, componentA } = await seedPageWithComponents(
        tx,
        ctx.workspace.id,
      );

      const created = await agentTools.create_status_report.run({
        ctx,
        input: agentTools.create_status_report.inputSchema.parse({
          title: `${TEST_PREFIX}-preview`,
          status: "investigating",
          message: "down",
          pageId,
          pageComponentIds: [],
          componentImpacts: [
            { pageComponentId: componentA, impact: "major_outage" },
          ],
          notify: false,
        }),
      });

      const approval = agentTools.add_status_report_update.approval;
      if (!approval?.prepareDraftInput) {
        throw new Error("expected prepareDraftInput to be defined");
      }

      const prepared = await approval.prepareDraftInput({
        ctx,
        input: {
          statusReportId: created.statusReport.id,
          status: "monitoring",
          message: "watching it",
          notify: false,
        },
      });

      const impacts = prepared.componentImpacts ?? [];
      expect(impacts).toContainEqual({
        pageComponentId: componentA,
        impact: "major_outage",
      });

      const summary = approval.summarize(prepared);
      expect(
        summary.lines.some((l) => l.label === "Impacts"),
        "preview should include an Impacts line",
      ).toBe(true);
    });
  });

  test("status=resolved does not carry impacts forward, so resolve clears them", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { pageId, componentA, componentB } = await seedPageWithComponents(
        tx,
        ctx.workspace.id,
      );

      const created = await agentTools.create_status_report.run({
        ctx,
        input: agentTools.create_status_report.inputSchema.parse({
          title: `${TEST_PREFIX}-resolve-clear`,
          status: "investigating",
          message: "down",
          pageId,
          pageComponentIds: [],
          componentImpacts: [
            { pageComponentId: componentA, impact: "major_outage" },
            { pageComponentId: componentB, impact: "partial_outage" },
          ],
          notify: false,
        }),
      });

      await agentTools.add_status_report_update.run({
        ctx,
        input: agentTools.add_status_report_update.inputSchema.parse({
          statusReportId: created.statusReport.id,
          status: "resolved",
          message: "all fixed",
          notify: false,
        }),
      });

      const final = await getCurrentImpactsForReport(
        tx,
        created.statusReport.id,
      );
      expect(final.get(componentA)).toBe("operational");
      expect(final.get(componentB)).toBe("operational");
    });
  });

  test("legacy report (no impacts) stays legacy on follow-up updates", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { pageId } = await seedPageWithComponents(tx, ctx.workspace.id);

      const created = await agentTools.create_status_report.run({
        ctx,
        input: agentTools.create_status_report.inputSchema.parse({
          title: `${TEST_PREFIX}-legacy`,
          status: "investigating",
          message: "down",
          pageId,
          pageComponentIds: [],
          notify: false,
        }),
      });

      const update = await agentTools.add_status_report_update.run({
        ctx,
        input: agentTools.add_status_report_update.inputSchema.parse({
          statusReportId: created.statusReport.id,
          status: "monitoring",
          message: "watching it",
          notify: false,
        }),
      });

      const rows = await getComponentImpactsForUpdate(
        tx,
        update.statusReportUpdateId,
      );
      expect(rows.length).toBe(0);
    });
  });
});
