import { Events } from "@openstatus/analytics";
import type { Workspace } from "@openstatus/db/src/schema";
import {
  beforeEach,
  describe,
  expect,
  type mock,
  test,
} from "@openstatus/test-utils";
import { Hono } from "hono";

import type { Variables } from "@/types";

import { cliTrackMiddleware } from "./track";

// @openstatus/analytics is swapped for a double (test.importmap.json) whose
// setupAnalytics/track spies are exposed here on globalThis.
const { track: mockTrack, setupAnalytics: mockSetupAnalytics } = (
  globalThis as Record<string, unknown>
).__analyticsSpies as {
  track: ReturnType<typeof mock>;
  setupAnalytics: ReturnType<typeof mock>;
};

/** Let the fire-and-forget analytics chain settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const TEST_WORKSPACE = {
  id: 42,
  slug: "test-ws",
  plan: "free",
  name: "",
} as Workspace;

/**
 * Minimal app with `workspace` pre-set (simulating `authMiddleware`) and
 * `cliTrackMiddleware` mounted the way the V1 router mounts it.
 */
function makeApp(opts: { withWorkspace?: boolean } = {}) {
  const app = new Hono<{ Variables: Variables }>();
  app.use("*", async (c, next) => {
    if (opts.withWorkspace !== false) c.set("workspace", TEST_WORKSPACE);
    await next();
  });
  app.use("*", cliTrackMiddleware());
  app.get("/whoami", (c) => c.text("ok"));
  return app;
}

function cliHeaders(invocation: string) {
  return {
    "user-agent": "openstatus-cli/v1.3.2 (darwin; arm64)",
    "x-openstatus-cli-command": "whoami",
    "x-openstatus-cli-invocation": invocation,
  };
}

function cliCommandCalls() {
  return mockTrack.mock.calls.filter(
    ([event]) => (event as { name: string }).name === Events.CliCommand.name,
  );
}

describe("cliTrackMiddleware", () => {
  beforeEach(() => {
    mockSetupAnalytics.mockClear();
    mockTrack.mockClear();
  });

  test("skips requests without CLI headers", async () => {
    const res = await makeApp().request("/whoami", {
      headers: { "user-agent": "curl/8" },
    });
    await flush();

    expect(res.status).toBe(200);
    expect(mockSetupAnalytics).not.toHaveBeenCalled();
    expect(mockTrack).not.toHaveBeenCalled();
  });

  test("skips requests without a workspace", async () => {
    const res = await makeApp({ withWorkspace: false }).request("/whoami", {
      headers: cliHeaders(crypto.randomUUID()),
    });
    await flush();

    expect(res.status).toBe(200);
    expect(mockSetupAnalytics).not.toHaveBeenCalled();
    expect(mockTrack).not.toHaveBeenCalled();
  });

  test("fires cli_command once per invocation", async () => {
    const app = makeApp();
    const invocation = crypto.randomUUID();

    for (let i = 0; i < 2; i++) {
      await app.request("/whoami", { headers: cliHeaders(invocation) });
      await flush();
    }

    expect(cliCommandCalls()).toHaveLength(1);
    expect(cliCommandCalls()[0][0]).toEqual({
      ...Events.CliCommand,
      command: "whoami",
      invocation,
      version: "1.3.2",
      os: "darwin",
      arch: "arm64",
    });
  });
});
