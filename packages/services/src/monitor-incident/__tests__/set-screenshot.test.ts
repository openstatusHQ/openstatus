import { eq } from "@openstatus/db";
import { monitorIncidentTable } from "@openstatus/db/src/schema";
import { createMonitor } from "@openstatus/db/src/test/factories";
import { beforeAll, describe, expect, test } from "vitest";

import {
  type WorkspaceFixture,
  createWorkspaceFixture,
  expectAuditRow,
  withTestTransaction,
} from "../../../test/helpers";
import { NotFoundError } from "../../errors";
import { setMonitorIncidentScreenshot } from "../index.ts";

let fixture: WorkspaceFixture;

beforeAll(async () => {
  fixture = await createWorkspaceFixture();
});

describe("setMonitorIncidentScreenshot", () => {
  test("stores each kind in its own column and audits as system", async () => {
    await withTestTransaction(async (tx) => {
      const monitor = await createMonitor(fixture.workspace.id, {}, tx);
      const incident = await tx
        .insert(monitorIncidentTable)
        .values({ monitorId: monitor.id, workspaceId: fixture.workspace.id })
        .returning()
        .get();

      await setMonitorIncidentScreenshot({
        input: { id: incident.id, kind: "incident", url: "https://s.test/a" },
        job: "screenshot-service",
        db: tx,
      });
      await setMonitorIncidentScreenshot({
        input: { id: incident.id, kind: "recovery", url: "https://s.test/b" },
        job: "screenshot-service",
        db: tx,
      });

      const row = await tx
        .select()
        .from(monitorIncidentTable)
        .where(eq(monitorIncidentTable.id, incident.id))
        .get();
      expect(row?.incidentScreenshotUrl).toBe("https://s.test/a");
      expect(row?.recoveryScreenshotUrl).toBe("https://s.test/b");

      await expectAuditRow({
        workspaceId: fixture.workspace.id,
        action: "monitor_incident.update",
        entityType: "monitor_incident",
        entityId: incident.id,
        actorType: "system",
        db: tx,
      });
    });
  });

  test("throws for an unknown incident", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        setMonitorIncidentScreenshot({
          input: { id: -1, kind: "incident", url: "https://s.test/a" },
          job: "screenshot-service",
          db: tx,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
