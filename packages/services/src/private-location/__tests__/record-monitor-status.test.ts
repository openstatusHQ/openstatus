import { and, eq } from "@openstatus/db";
import {
  privateLocation,
  privateLocationMonitorStatus,
} from "@openstatus/db/src/schema";
import { createMonitor } from "@openstatus/db/src/test/factories";
import { beforeAll, describe, expect, test } from "vitest";

import {
  type WorkspaceFixture,
  createWorkspaceFixture,
  withTestTransaction,
} from "../../../test/helpers";
import { recordPrivateLocationMonitorStatus } from "../index.ts";

let fixture: WorkspaceFixture;

beforeAll(async () => {
  fixture = await createWorkspaceFixture();
});

describe("recordPrivateLocationMonitorStatus", () => {
  test("reports a change only for a newer report with another status", async () => {
    await withTestTransaction(async (tx) => {
      const monitor = await createMonitor(fixture.workspace.id, {}, tx);
      const location = await tx
        .insert(privateLocation)
        .values({
          name: "office",
          token: crypto.randomUUID(),
          workspaceId: fixture.workspace.id,
        })
        .returning()
        .get();
      const record = (status: "active" | "error", cronTimestamp: number) =>
        recordPrivateLocationMonitorStatus({
          input: {
            monitorId: monitor.id,
            privateLocationId: location.id,
            status,
            cronTimestamp,
          },
          db: tx,
        });

      // no stored row counts as active
      expect(await record("active", 1000)).toEqual({ changed: false });
      expect(await record("error", 2000)).toEqual({ changed: true });
      expect(await record("error", 3000)).toEqual({ changed: false });
      // older than the stored report: ignored
      expect(await record("active", 2500)).toEqual({ changed: false });

      const stored = await tx
        .select()
        .from(privateLocationMonitorStatus)
        .where(
          and(
            eq(privateLocationMonitorStatus.monitorId, monitor.id),
            eq(privateLocationMonitorStatus.privateLocationId, location.id),
          ),
        )
        .get();
      expect(stored?.status).toBe("error");
      expect(stored?.cronTimestamp).toBe(3000);
    });
  });
});
