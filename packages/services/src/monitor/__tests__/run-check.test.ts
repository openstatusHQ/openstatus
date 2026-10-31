import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import { ForbiddenError, NotFoundError } from "../../errors";
import type { Workspace } from "../../types";
import { createMonitor } from "../create";
import { firstRegion, runMonitorCheck } from "../run-check";

const originalFetch = globalThis.fetch;
const originalCronSecret = process.env.CRON_SECRET;

let workspace: Workspace;
const probed: string[] = [];

beforeAll(async () => {
  workspace = (await createWorkspaceFixture("team")).workspace;
  process.env.CRON_SECRET = "test-cron-secret";
  // Record the checker endpoint instead of hitting the network.
  globalThis.fetch = (async (input: string | URL | Request) => {
    probed.push(String(input));
    return new Response(
      JSON.stringify({ state: "success", status: 200, latency: 120 }),
      { headers: { "Content-Type": "application/json" } },
    );
  }) as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  if (originalCronSecret === undefined) {
    process.env.CRON_SECRET = undefined;
  } else {
    process.env.CRON_SECRET = originalCronSecret;
  }
});

describe("firstRegion", () => {
  test("reads the first stored code", () => {
    expect(firstRegion("ams,fra")).toBe("ams");
    expect(firstRegion(" iad ")).toBe("iad");
    expect(firstRegion("")).toBeUndefined();
    expect(firstRegion(null)).toBeUndefined();
  });
});

describe("runMonitorCheck", () => {
  test("rejects read-only actor before touching the DB", async () => {
    await expect(
      runMonitorCheck({
        ctx: makeApiKeyCtx(workspace, {
          keyId: "ro",
          scopes: ["monitors:read"],
        }),
        input: { monitorId: 1 },
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  test("throws NotFoundError for a monitor outside the workspace", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...makeUserCtx(workspace), db: tx };
      await expect(
        runMonitorCheck({ ctx, input: { monitorId: 999_999_999 } }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  test("probes the first configured region, or the requested one", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...makeUserCtx(workspace), db: tx };
      const created = await createMonitor({
        ctx,
        input: {
          name: "run-check",
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: true,
          regions: ["ams", "fra"],
        },
      });

      probed.length = 0;
      const first = await runMonitorCheck({
        ctx,
        input: { monitorId: created.id },
      });
      expect(first).toMatchObject({
        state: "success",
        region: "ams",
        status: 200,
        latency: 120,
      });
      expect(probed).toHaveLength(1);
      expect(probed[0]).toContain("/ams");

      const second = await runMonitorCheck({
        ctx,
        input: { monitorId: created.id, region: "fra" },
      });
      expect(second?.region).toBe("fra");
    });
  });

  test("returns null for non-http monitors without probing", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...makeUserCtx(workspace), db: tx };
      const created = await createMonitor({
        ctx,
        input: {
          name: "run-check-tcp",
          jobType: "tcp",
          url: "example.com:443",
          method: "GET",
          headers: [],
          assertions: [],
          active: true,
        },
      });
      probed.length = 0;
      await expect(
        runMonitorCheck({ ctx, input: { monitorId: created.id } }),
      ).resolves.toBeNull();
      expect(probed).toHaveLength(0);
    });
  });
});
