import {
  createMonitor,
  createNotification,
} from "@openstatus/db/src/test/factories";
import { beforeAll, describe, expect, test } from "vitest";

import {
  type WorkspaceFixture,
  createWorkspaceFixture,
  withTestTransaction,
} from "../../../test/helpers";
import { claimNotificationTrigger } from "../index.ts";

let fixture: WorkspaceFixture;

beforeAll(async () => {
  fixture = await createWorkspaceFixture();
});

describe("claimNotificationTrigger", () => {
  test("only the first claim per check run wins", async () => {
    await withTestTransaction(async (tx) => {
      const monitor = await createMonitor(fixture.workspace.id, {}, tx);
      const notification = await createNotification(
        fixture.workspace.id,
        {},
        tx,
      );
      const claim = (cronTimestamp: number) =>
        claimNotificationTrigger({
          input: {
            monitorId: monitor.id,
            notificationId: notification.id,
            cronTimestamp,
          },
          db: tx,
        });

      expect(await claim(1000)).toBe(true);
      expect(await claim(1000)).toBe(false);
      expect(await claim(2000)).toBe(true);
    });
  });
});
