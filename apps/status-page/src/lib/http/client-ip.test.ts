import { describe, expect, test } from "bun:test";

import { resolveClientIp } from "./client-ip";

function h(map: Record<string, string>) {
  return { get: (name: string) => map[name] ?? null };
}

describe("resolveClientIp", () => {
  test("prefers x-real-ip over x-forwarded-for", () => {
    expect(
      resolveClientIp(
        h({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.2.3.4" }),
      ),
    ).toBe("9.9.9.9");
  });

  test("ignores a spoofed leftmost x-forwarded-for when x-real-ip is present", () => {
    // Attacker injects an allowed IP at the head of the chain; x-real-ip wins.
    expect(
      resolveClientIp(
        h({
          "x-real-ip": "203.0.113.7",
          "x-forwarded-for": "10.0.0.1, 203.0.113.7",
        }),
      ),
    ).toBe("203.0.113.7");
  });

  test("falls back to leftmost x-forwarded-for when x-real-ip is absent", () => {
    expect(resolveClientIp(h({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe(
      "1.2.3.4",
    );
  });

  test("returns null when neither header is present", () => {
    expect(resolveClientIp(h({}))).toBeNull();
  });
});
