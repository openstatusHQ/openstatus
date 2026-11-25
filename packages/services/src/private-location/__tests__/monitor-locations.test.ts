import {
  privateLocation,
  privateLocationMonitorStatus,
  privateLocationToMonitors,
} from "@openstatus/db/src/schema";
import { createMonitor } from "@openstatus/db/src/test/factories";
import { beforeAll, describe, expect, test } from "vitest";

import {
  type WorkspaceFixture,
  createWorkspaceFixture,
  withTestTransaction,
} from "../../../test/helpers";
import {
  countPrivateLocationsReporting,
  findPrivateLocationAttachment,
} from "../index.ts";

let fixture: WorkspaceFixture;

beforeAll(async () => {
  fixture = await createWorkspaceFixture();
});

describe("private locations of a monitor", () => {
  test("only live attachments count, and only matching reports are affected", async () => {
    await withTestTransaction(async (tx) => {
      const wsId = fixture.workspace.id;
      const m = await createMonitor(wsId, {}, tx);
      const [office, lab, detached] = await tx
        .insert(privateLocation)
        .values(
          ["office", "lab", "detached"].map((name) => ({
            name,
            token: crypto.randomUUID(),
            workspaceId: wsId,
          })),
        )
        .returning();
      if (!office || !lab || !detached) throw new Error("insert failed");

      await tx.insert(privateLocationToMonitors).values([
        { monitorId: m.id, privateLocationId: office.id },
        { monitorId: m.id, privateLocationId: lab.id },
        {
          monitorId: m.id,
          privateLocationId: detached.id,
          deletedAt: new Date(),
        },
      ]);
      await tx.insert(privateLocationMonitorStatus).values(
        [office, lab, detached].map((loc, i) => ({
          monitorId: m.id,
          privateLocationId: loc.id,
          status: i === 1 ? ("active" as const) : ("error" as const),
          cronTimestamp: 1000,
        })),
      );

      expect(
        await findPrivateLocationAttachment({
          monitorId: m.id,
          privateLocationId: office.id,
          db: tx,
        }),
      ).toEqual({ name: "office" });
      expect(
        await findPrivateLocationAttachment({
          monitorId: m.id,
          privateLocationId: detached.id,
          db: tx,
        }),
      ).toBeUndefined();

      // the detached location reports error too, but no longer counts
      expect(
        await countPrivateLocationsReporting({
          monitorId: m.id,
          status: "error",
          db: tx,
        }),
      ).toEqual({ locationCount: 2, affectedCount: 1 });
    });
  });
});
