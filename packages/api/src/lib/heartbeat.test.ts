import { afterEach, describe, expect, test, vi } from "vitest";

async function load(env: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import("./heartbeat");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isHeartbeatEnabled", () => {
  test("only allowlisted workspaces", async () => {
    const { isHeartbeatEnabled } = await load({
      SELF_HOST: "false",
      HEARTBEAT_WORKSPACE_IDS: "1, 7",
    });
    expect(isHeartbeatEnabled(7)).toBe(true);
    expect(isHeartbeatEnabled(2)).toBe(false);
  });

  test("a wildcard opens it to everyone", async () => {
    const { isHeartbeatEnabled } = await load({
      SELF_HOST: "false",
      HEARTBEAT_WORKSPACE_IDS: "*",
    });
    expect(isHeartbeatEnabled(42)).toBe(true);
  });

  test("closed when unset", async () => {
    const { isHeartbeatEnabled } = await load({
      SELF_HOST: "false",
      HEARTBEAT_WORKSPACE_IDS: "",
    });
    expect(isHeartbeatEnabled(1)).toBe(false);
  });

  test("self-hosted instances always have it", async () => {
    const { isHeartbeatEnabled } = await load({ SELF_HOST: "true" });
    expect(isHeartbeatEnabled(1)).toBe(true);
  });
});

test("heartbeatPingUrl uses the configured base", async () => {
  const { heartbeatPingUrl } = await load({
    HEARTBEAT_PING_BASE_URL: "https://hb.example.com",
  });
  expect(heartbeatPingUrl("abc")).toBe("https://hb.example.com/heartbeat/abc");
});
