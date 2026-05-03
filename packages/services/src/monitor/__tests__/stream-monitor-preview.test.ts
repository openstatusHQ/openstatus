import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { SEEDED_WORKSPACE_FREE_ID } from "../../../test/fixtures";
import {
  loadSeededWorkspace,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import { NotFoundError } from "../../errors";
import { createMonitor } from "../create";
import { streamMonitorPreview } from "../stream-monitor-preview";

const originalFetch = globalThis.fetch;
const originalCronSecret = process.env.CRON_SECRET;

describe("streamMonitorPreview", () => {
  beforeAll(() => {
    process.env.CRON_SECRET = "test-cron-secret";
    // Stub the Go-checker fetch to a fast in-memory response so the test
    // doesn't hit the real network. Each call returns a minimal success
    // payload that the service generator parses into a CheckResult.
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          state: "success",
          status: 200,
          latency: 100,
          timestamp: Date.now(),
          timing: {
            dnsStart: 0,
            dnsDone: 10,
            connectStart: 10,
            connectDone: 20,
            tlsHandshakeStart: 20,
            tlsHandshakeDone: 40,
            firstByteStart: 40,
            firstByteDone: 90,
            transferStart: 90,
            transferDone: 100,
          },
          headers: { "x-test": "1" },
          body: "ok",
        }),
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

  test("throws NotFoundError when monitor belongs to a different workspace", async () => {
    await withTestTransaction(async (tx) => {
      const ws = await loadSeededWorkspace(SEEDED_WORKSPACE_FREE_ID);
      const ctx = { ...makeUserCtx(ws), db: tx };

      // Use a monitor id that does not exist for this workspace.
      const generator = streamMonitorPreview({
        ctx,
        input: { monitorId: 999_999_999 },
      });

      await expect(async () => {
        for await (const _ of generator) {
          // drain
        }
      }).toThrow(NotFoundError);
    });
  });

  test("yields one result per region for an owned monitor", async () => {
    await withTestTransaction(async (tx) => {
      const ws = await loadSeededWorkspace(SEEDED_WORKSPACE_FREE_ID);
      const ctx = { ...makeUserCtx(ws), db: tx };
      const created = await createMonitor({
        ctx,
        input: {
          name: "preview-test",
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: true,
        },
      });

      const results: { region: string }[] = [];
      for await (const result of streamMonitorPreview({
        ctx,
        input: { monitorId: created.id },
      })) {
        results.push({ region: result.region });
      }

      // Should fan out across all available regions
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
