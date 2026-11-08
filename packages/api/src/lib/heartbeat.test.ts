import { afterEach, expect, test, vi } from "vitest";

async function load(env: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import("./heartbeat");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

test("heartbeatPingUrl uses the configured base", async () => {
  const { heartbeatPingUrl } = await load({
    HEARTBEAT_PING_BASE_URL: "https://hb.example.com",
  });
  expect(heartbeatPingUrl("abc")).toBe("https://hb.example.com/heartbeat/abc");
});
