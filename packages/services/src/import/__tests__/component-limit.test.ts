import { page } from "@openstatus/db/src/schema";
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
    expect(full.status).toBe("skipped");
    expect(full.resources[0]).toMatchObject({
      status: "skipped",
      error: "Skipped: component limit reached (2)",
    });
  });
});
