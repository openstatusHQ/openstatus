import { eq } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";
import { createMonitor } from "@openstatus/db/src/test/factories";
import { beforeAll, describe, expect, test } from "vitest";

import {
  type WorkspaceFixture,
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeSystemCtx,
  withTestTransaction,
} from "../../../test/helpers";
import { ForbiddenError } from "../../errors";
import { setMonitorStatus } from "../index.ts";

let fixture: WorkspaceFixture;
let other: WorkspaceFixture;

beforeAll(async () => {
  fixture = await createWorkspaceFixture();
  other = await createWorkspaceFixture();
});

describe("setMonitorStatus", () => {
  test("updates a monitor of the workspace only", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor(fixture.workspace.id, {}, tx);
      const read = () =>
        tx.select().from(monitor).where(eq(monitor.id, row.id)).get();

      const foreign = {
        ...makeSystemCtx(other.workspace, { job: "checker" }),
        db: tx,
      };
      expect(
        await setMonitorStatus({
          ctx: foreign,
          input: { id: row.id, status: "error" },
        }),
      ).toBe(false);
      expect((await read())?.status).toBe("active");

      const ctx = {
        ...makeSystemCtx(fixture.workspace, { job: "checker" }),
        db: tx,
      };
      expect(
        await setMonitorStatus({ ctx, input: { id: row.id, status: "error" } }),
      ).toBe(true);
      expect((await read())?.status).toBe("error");
    });
  });

  test("rejects read-only actor", async () => {
    const ctx = makeApiKeyCtx(fixture.workspace, {
      keyId: "ro",
      scopes: ["monitors:read"],
    });
    await expect(
      setMonitorStatus({ ctx, input: { id: 1, status: "error" } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
