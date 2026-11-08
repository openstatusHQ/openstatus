import "@/test-preload";
import { redis } from "@openstatus/upstash";
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
  type MockInstance,
} from "vitest";

import { magicLinkRateLimit } from "./magic-link";

let evalStub: MockInstance | undefined;
let warnStub: MockInstance | undefined;

function stubCounts(counts: number[] | Error) {
  evalStub = vi
    .spyOn(redis, "eval")
    .mockImplementation(() =>
      counts instanceof Error
        ? Promise.reject(counts)
        : Promise.resolve(counts),
    );
}

afterEach(() => {
  evalStub?.mockRestore();
  warnStub?.mockRestore();
});

describe("magicLinkRateLimit", () => {
  test("keys the counters by ip and email", async () => {
    stubCounts([1, 1]);

    await magicLinkRateLimit({ ip: "1.2.3.4", email: "a@b.c" });

    expect(evalStub?.mock.calls[0]?.[1]).toEqual([
      "ratelimit:magic-link:ip:1.2.3.4",
      "ratelimit:magic-link:email:a@b.c",
    ]);
    expect(evalStub?.mock.calls[0]?.[2]).toEqual([600]);
  });

  test("lowercases the email key", async () => {
    stubCounts([1, 1]);

    await magicLinkRateLimit({ ip: "ip", email: " Gilfoyle@PiedPiper.dev " });

    expect(evalStub?.mock.calls[0]?.[1]).toEqual([
      "ratelimit:magic-link:ip:ip",
      "ratelimit:magic-link:email:gilfoyle@piedpiper.dev",
    ]);
  });

  test("allows at the limits", async () => {
    stubCounts([10, 3]);
    expect(await magicLinkRateLimit({ ip: "ip", email: "e" })).toBe(true);
  });

  test("refuses past the ip limit", async () => {
    stubCounts([11, 1]);
    expect(await magicLinkRateLimit({ ip: "ip", email: "e" })).toBe(false);
  });

  test("refuses past the email limit", async () => {
    stubCounts([1, 4]);
    expect(await magicLinkRateLimit({ ip: "ip", email: "e" })).toBe(false);
  });

  test("fails open with a warning when redis is down", async () => {
    stubCounts(new Error("redis down"));
    warnStub = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined as never);

    expect(await magicLinkRateLimit({ ip: "ip", email: "e" })).toBe(true);
    expect(warnStub.mock.calls).toHaveLength(1);
  });
});
