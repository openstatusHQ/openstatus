import { eq } from "@openstatus/db";
import {
  monitor,
  monitorMaintenanceWindow,
  page,
  pageComponent,
} from "@openstatus/db/src/schema";
import type { PhaseResult } from "@openstatus/importers";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { monitorIdsOf } from "../../maintenance-window/internal";
import { writeMaintenancesPhase } from "../phase-writers";

const TEST_PREFIX = "svc-import-maintenances-test";

let teamCtx: ServiceContext;

beforeAll(async () => {
  const team = (await createWorkspaceFixture("team")).workspace;
  teamCtx = makeUserCtx(team, { userId: 1 });
});

describe("writeMaintenancesPhase", () => {
  test("an imported maintenance on a monitor-backed component gets its derived window", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const pageRow = await tx
        .insert(page)
        .values({
          workspaceId: ctx.workspace.id,
          title: `${TEST_PREFIX}-page`,
          description: "",
          slug: `${TEST_PREFIX}-page-slug`,
          customDomain: "",
        })
        .returning()
        .get();
      const api = await tx
        .insert(monitor)
        .values({
          workspaceId: ctx.workspace.id,
          name: `${TEST_PREFIX}-api`,
          url: "https://example.com",
          regions: "ams",
          active: true,
        })
        .returning()
        .get();
      const backed = await tx
        .insert(pageComponent)
        .values({
          workspaceId: ctx.workspace.id,
          pageId: pageRow.id,
          name: `${TEST_PREFIX}-backed`,
          type: "monitor",
          monitorId: api.id,
        })
        .returning()
        .get();
      const plain = await tx
        .insert(pageComponent)
        .values({
          workspaceId: ctx.workspace.id,
          pageId: pageRow.id,
          name: `${TEST_PREFIX}-plain`,
          type: "static",
        })
        .returning()
        .get();

      const resource = (title: string, sourceComponentIds: string[]) => ({
        sourceId: title,
        name: title,
        status: "created" as const,
        data: {
          title,
          message: "m",
          from: new Date("2024-01-01T00:00:00Z"),
          to: new Date("2024-01-01T02:00:00Z"),
          workspaceId: ctx.workspace.id,
          pageId: pageRow.id,
          sourceComponentIds,
        },
      });
      const phase: PhaseResult = {
        phase: "maintenances",
        status: "completed",
        resources: [
          resource(`${TEST_PREFIX}-backed`, ["src_backed", "src_plain"]),
          resource(`${TEST_PREFIX}-plain`, ["src_plain"]),
        ],
      };
      await writeMaintenancesPhase(
        { ctx, tx, provider: "statuspage" },
        phase,
        pageRow.id,
        new Map([
          ["src_backed", backed.id],
          ["src_plain", plain.id],
        ]),
      );

      expect(phase.resources.map((r) => r.status)).toEqual([
        "created",
        "created",
      ]);
      const [withMonitor, withoutMonitor] = phase.resources.map(
        (r) => r.openstatusId as number,
      );
      const derived = await tx
        .select()
        .from(monitorMaintenanceWindow)
        .where(eq(monitorMaintenanceWindow.maintenanceId, withMonitor))
        .get();
      expect(derived).toMatchObject({
        mode: "pause",
        title: `${TEST_PREFIX}-backed`,
        from: new Date("2024-01-01T00:00:00Z"),
        to: new Date("2024-01-01T02:00:00Z"),
      });
      expect(await monitorIdsOf(tx, derived?.id ?? 0)).toEqual([api.id]);
      expect(
        await tx
          .select()
          .from(monitorMaintenanceWindow)
          .where(eq(monitorMaintenanceWindow.maintenanceId, withoutMonitor))
          .get(),
      ).toBeUndefined();
    });
  });
});
