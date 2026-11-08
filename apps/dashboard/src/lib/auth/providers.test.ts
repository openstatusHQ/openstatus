import "@/test-preload";
import { AuthError } from "@auth/core/errors";
import { redis } from "@openstatus/upstash";
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
  type MockInstance,
} from "vitest";

import { ResendProvider } from "./providers";

let evalStub: MockInstance | undefined;
let logStub: MockInstance | undefined;

afterEach(() => {
  evalStub?.mockRestore();
  logStub?.mockRestore();
});

function sendTo(identifier: string, ip = "1.2.3.4") {
  // `Resend()` keeps overrides under `options`; Auth.js merges them at init.
  const send = ResendProvider.options?.sendVerificationRequest;
  if (!send) throw new Error("sendVerificationRequest override missing");
  return send({
    identifier,
    url: "https://app.openstatus.dev/api/auth/callback/resend?token=t",
    token: "t",
    expires: new Date(Date.now() + 60_000),
    provider: ResendProvider,
    request: new Request("https://app.openstatus.dev/api/auth/signin/resend", {
      headers: { "x-forwarded-for": ip },
    }),
    theme: {},
  });
}

describe("ResendProvider.sendVerificationRequest", () => {
  test("refuses disposable domains before touching the rate limit", async () => {
    evalStub = vi
      .spyOn(redis, "eval")
      .mockImplementation(() => undefined as never);

    await expect(sendTo("a@mailinator.com")).rejects.toThrow(AuthError);
    await expect(sendTo("a@mailinator.com")).rejects.toThrow(
      "disposable domain",
    );
    expect(evalStub.mock.calls).toHaveLength(0);
  });

  test("refuses throttled addresses", async () => {
    evalStub = vi
      .spyOn(redis, "eval")
      .mockImplementation(() => Promise.resolve([1, 4]));

    await expect(sendTo("gilfoyle@piedpiper.dev")).rejects.toThrow(
      "rate limited",
    );
  });

  test("sends when screening passes, keyed by client ip and address", async () => {
    evalStub = vi
      .spyOn(redis, "eval")
      .mockImplementation(() => Promise.resolve([1, 1]));
    logStub = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined as never);

    await sendTo("gilfoyle@piedpiper.dev", "9.9.9.9");

    expect(evalStub.mock.calls[0]?.[1]).toEqual([
      "ratelimit:magic-link:ip:9.9.9.9",
      "ratelimit:magic-link:email:gilfoyle@piedpiper.dev",
    ]);
    const printed = logStub.mock.calls.map((c) => String(c[0])).join("\n");
    expect(printed).toContain(
      "https://app.openstatus.dev/api/auth/callback/resend?token=t",
    );
  });
});
