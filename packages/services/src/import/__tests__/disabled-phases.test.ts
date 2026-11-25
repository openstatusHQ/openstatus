import { page } from "@openstatus/db/src/schema";
import type { ImportSummary } from "@openstatus/importers";
import { beforeAll, describe, expect, test, vi } from "vitest";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { Workspace } from "../../types";
import { runImport } from "../run";

vi.mock("../provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../provider")>();
  const resource = (sourceId: string) => ({
    sourceId,
    name: sourceId,
    status: "created" as const,
    data: { secret: sourceId },
  });
  return {
    ...actual,
    createProvider: () => ({
      name: "stub",
      validate: async () => ({ valid: true }),
      run: async (): Promise<ImportSummary> => ({
        provider: "stub",
        status: "completed",
        startedAt: new Date(),
        completedAt: new Date(),
        errors: [],
        phases: [
          {
            phase: "incidents",
            status: "completed",
            resources: [resource("inc")],
          },
          {
            phase: "maintenances",
            status: "completed",
            resources: [resource("mnt")],
          },
          {
            phase: "subscribers",
            status: "completed",
            resources: [resource("sub")],
          },
        ],
      }),
    }),
  };
});

let workspace: Workspace;

beforeAll(async () => {
  workspace = (await createWorkspaceFixture("team")).workspace;
});

describe("runImport disabled phases", () => {
  test("returns no data for phases the key could not import", async () => {
    await withTestTransaction(async (tx) => {
      const pageRow = await tx
        .insert(page)
        .values({
          workspaceId: workspace.id,
          title: "svc-import-disabled",
          description: "",
          slug: `svc-import-disabled-${workspace.id}`,
          customDomain: "",
        })
        .returning()
        .get();

      const ctx = {
        ...makeApiKeyCtx(workspace, {
          keyId: "import-key",
          scopes: ["pages:write", "monitors:write"],
        }),
        db: tx,
      };
      const summary = await runImport({
        ctx,
        input: {
          provider: "statuspage",
          apiKey: "k",
          statuspagePageId: "p",
          pageId: pageRow.id,
          options: { includeStatusReports: false, includeSubscribers: false },
        },
      });

      expect(summary.phases).toHaveLength(3);
      for (const phase of summary.phases) {
        expect(phase.status).toBe("skipped");
        expect(phase.resources).toEqual([]);
      }
    });
  });
});
