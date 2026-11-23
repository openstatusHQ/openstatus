import { eq } from "@openstatus/db";
import { page, statusReportsToPageComponents } from "@openstatus/db/src/schema";
import type { ImportSummary } from "@openstatus/importers";
import { expect, test, vi } from "vitest";

import {
  createWorkspaceFixture,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import { runImport } from "../run";

const provider = vi.hoisted(() => ({
  run: vi.fn<() => Promise<ImportSummary>>(),
}));

vi.mock("../provider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../provider")>()),
  createProvider: () => ({
    ...provider,
    validate: async () => ({ valid: true }),
  }),
}));

test("an already imported component does not use the last free slot", async () => {
  const { workspace } = await createWorkspaceFixture("team");
  await withTestTransaction(async (tx) => {
    const ctx = {
      ...makeUserCtx(workspace, { userId: 1 }),
      workspace: {
        ...workspace,
        limits: { ...workspace.limits, "page-components": 2 },
      },
      db: tx,
    };
    const createPage = (slug: string) =>
      tx
        .insert(page)
        .values({
          workspaceId: workspace.id,
          title: slug,
          description: "",
          customDomain: "",
          slug: `${slug}-${workspace.id}`,
        })
        .returning()
        .get();
    const target = await createPage("import-quota");

    const run = async (names: string[], pageId = target.id) => {
      provider.run.mockResolvedValueOnce({
        provider: "statuspage",
        status: "completed",
        startedAt: new Date(),
        completedAt: new Date(),
        errors: [],
        phases: [
          {
            phase: "components",
            status: "completed",
            resources: names.map((name) => ({
              sourceId: name,
              name,
              status: "created",
              data: { name, type: "static", monitorId: null, order: 0 },
            })),
          },
        ],
      });
      const summary = await runImport({
        ctx,
        input: { provider: "statuspage", apiKey: "dummy", pageId },
      });
      return summary.phases[0];
    };

    const {
      resources: [first],
    } = await run(["API"]);
    expect(first.status).toBe("created");

    const {
      resources: [existing, added, overflow],
    } = await run(["API", "Dashboard", "CDN"]);
    expect(existing.openstatusId).toBe(first.openstatusId);
    expect(added.status).toBe("created");
    expect(overflow.status).toBe("skipped");
    expect(overflow.error).toContain("component limit");

    const emptyPage = await createPage("import-quota-empty");
    const full = await run(["CDN"], emptyPage.id);
    expect(full.status).toBe("completed");
    expect(full.resources[0]).toMatchObject({
      status: "skipped",
      error: "Skipped: would exceed component limit (2)",
    });
  });
});

test("re-importing a full workspace still resolves existing components for incident links", async () => {
  const { workspace } = await createWorkspaceFixture("team");
  await withTestTransaction(async (tx) => {
    const ctx = {
      ...makeUserCtx(workspace, { userId: 1 }),
      workspace: {
        ...workspace,
        limits: { ...workspace.limits, "page-components": 1 },
      },
      db: tx,
    };
    const target = await tx
      .insert(page)
      .values({
        workspaceId: workspace.id,
        title: "import-full",
        description: "",
        customDomain: "",
        slug: `import-full-${workspace.id}`,
      })
      .returning()
      .get();

    provider.run.mockResolvedValueOnce({
      provider: "statuspage",
      status: "completed",
      startedAt: new Date(),
      completedAt: new Date(),
      errors: [],
      phases: [
        {
          phase: "components",
          status: "completed",
          resources: [
            {
              sourceId: "API",
              name: "API",
              status: "created",
              data: { name: "API", type: "static", monitorId: null, order: 0 },
            },
          ],
        },
      ],
    });
    const firstSummary = await runImport({
      ctx,
      input: { provider: "statuspage", apiKey: "dummy", pageId: target.id },
    });
    const apiId = firstSummary.phases[0].resources[0].openstatusId;
    expect(apiId).toBeDefined();

    provider.run.mockResolvedValueOnce({
      provider: "statuspage",
      status: "completed",
      startedAt: new Date(),
      completedAt: new Date(),
      errors: [],
      phases: [
        {
          phase: "components",
          status: "completed",
          resources: ["API", "CDN"].map((name) => ({
            sourceId: name,
            name,
            status: "created",
            data: { name, type: "static", monitorId: null, order: 0 },
          })),
        },
        {
          phase: "incidents",
          status: "completed",
          resources: [
            {
              sourceId: "inc_1",
              name: "API outage",
              status: "created",
              data: {
                report: {
                  title: "API outage",
                  status: "resolved",
                  workspaceId: workspace.id,
                  pageId: target.id,
                },
                updates: [
                  {
                    status: "resolved",
                    message: "Recovered",
                    date: new Date("2025-01-01T00:00:00Z"),
                  },
                ],
                sourceComponentIds: ["API", "CDN"],
              },
            },
          ],
        },
      ],
    });
    const rerun = await runImport({
      ctx,
      input: { provider: "statuspage", apiKey: "dummy", pageId: target.id },
    });

    const [existing, overflow] = rerun.phases[0].resources;
    expect(existing.status).toBe("skipped");
    expect(existing.openstatusId).toBe(apiId);
    expect(existing.error).toBeUndefined();
    expect(overflow.status).toBe("skipped");
    expect(overflow.openstatusId).toBeUndefined();
    expect(overflow.error).toContain("component limit");

    const incident = rerun.phases[1].resources[0];
    expect(incident.status).toBe("created");
    expect(incident.openstatusId).toBeDefined();
    if (incident.openstatusId === undefined) return;
    const links = await tx
      .select({
        pageComponentId: statusReportsToPageComponents.pageComponentId,
      })
      .from(statusReportsToPageComponents)
      .where(
        eq(statusReportsToPageComponents.statusReportId, incident.openstatusId),
      );
    expect(links).toEqual([{ pageComponentId: apiId }]);
  });
});
